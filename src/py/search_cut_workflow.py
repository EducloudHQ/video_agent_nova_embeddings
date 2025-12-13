import boto3
import json
import os
from botocore.config import Config
import uuid
import subprocess
from aws_durable_execution_sdk_python import (
    DurableContext,
    StepContext,
    durable_execution,
    durable_step,
)
from aws_durable_execution_sdk_python.config import (
    Duration,
    StepConfig,
    CallbackConfig,
)
from aws_durable_execution_sdk_python.retries import (
    RetryStrategyConfig,
    create_retry_strategy,
)
VECTOR_BUCKET_NAME = os.environ.get('VECTOR_BUCKET_NAME')
VECTOR_INDEX_NAME = os.environ.get('VECTOR_INDEX_NAME', '')
s3_vectors = boto3.client('s3vectors')
config = Config(read_timeout=3600)
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1', config=config)
s3_client = boto3.client('s3')

events_client = boto3.client("events")


EVENT_BUS_NAME = os.environ.get("EVENT_BUS_NAME")
VECTOR_DIMENSION = 1024 


def send_event(request_id: str, status: str, callback_id: str = None, video_url: str = None, message: str = None):
    """
    Sends status updates to EventBridge. 
    Includes 'videoUrl' and 'callbackId' specifically for the Approval stage.
    """
    try:
        detail = {
            "requestId": request_id,
            "status": status,
            "message": message,
            "callbackId": callback_id,
            "videoUrl": video_url
        }
        
        events_client.put_events(
            Entries=[
                {
                    "Source": "video.pipeline",
                    "DetailType": "video.processing.status",
                    "Detail": json.dumps(detail),
                    "EventBusName": EVENT_BUS_NAME,
                }
            ]
        )
        print(f"Event sent: {status}")
    except Exception as e:
        print(f"Failed to send event: {e}")

# --- STEP 1: SEMANTIC SEARCH ---
@durable_step
def search_video_step(step_context: StepContext, query: str) -> dict:
    """
    Embeds query and searches S3 Vector Index. 
    Returns the metadata of the BEST match.
    """
    step_context.logger.info(f"Searching for: {query}")
    
    # 1. Embed Query
    request_body = {
        "taskType": "SINGLE_EMBEDDING",
        "singleEmbeddingParams": {
            "embeddingPurpose": "VIDEO_RETRIEVAL",
            "embeddingDimension": VECTOR_DIMENSION,
            "text": {"truncationMode": "NONE", "value": query},
        },
    }
    
    response = bedrock_runtime.invoke_model(
        modelId='amazon.nova-2-multimodal-embeddings-v1:0', 
        body=json.dumps(request_body),
        accept="application/json",
        contentType="application/json",
    )
    query_embedding = json.loads(response['body'].read())['embedding']

    # 2. Search Vector Index
    search_response = s3_vectors.query_vectors(
        vectorBucketName=VECTOR_BUCKET_NAME,
        indexName=VECTOR_INDEX_NAME,
        queryVector={'float32': query_embedding},
        topK=1, # We only want the best match for this workflow
        returnMetadata=True,
        returnDistance=True
    )

    if not search_response.get('vectors'):
        raise Exception("No matching video found.")

    # 3. Extract Info
    best_match = search_response['vectors'][0]
    metadata = best_match['metadata']
    
    result = {
        "s3_uri": metadata.get('s3_uri'), # e.g. s3://bucket/video.mp4
        "start_time": metadata.get('start_seconds'),
        "end_time": metadata.get('end_seconds'),
        "score": best_match.get('score')
    }
    step_context.logger.info(f"Found match: {result}")
    return result

# --- STEP 2: FFmpeg CUT ---
@durable_step
def cut_video_step(step_context: StepContext, match_data: dict, request_id: str) -> dict:
    """
    Downloads, cuts, and re-uploads the video.
    Returns a Presigned URL for viewing.
    """
    step_context.logger.info(f"Cutting video: {match_data['s3_uri']}")
    
    s3_uri = match_data['s3_uri']
    # Parse Bucket and Key from s3://bucket/key
    parts = s3_uri.replace("s3://", "").split("/", 1)
    bucket = parts[0]
    key = parts[1]
    
    input_path = f"/tmp/{uuid.uuid4()}_input.mp4"
    output_path = f"/tmp/{uuid.uuid4()}_output.mp4"
    output_key = f"cuts/{request_id}_cut.mp4"

    try:
        # 1. Download
        s3_client.download_file(bucket, key, input_path)
        
        # 2. Cut with FFmpeg
        command = [
            "/opt/bin/ffmpeg",
            "-ss", str(match_data['start_time']),
            "-i", input_path,
            "-to", str(match_data['end_time']),
            "-c", "copy", # Fast cut
            "-y",
            output_path
        ]
        subprocess.check_call(command)
        
        # 3. Upload Cut
        s3_client.upload_file(output_path, bucket, output_key)
        
        # 4. Generate Presigned URL (Valid for 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': output_key},
            ExpiresIn=3600
        )
        
        return {
            "cut_key": output_key,
            "presigned_url": presigned_url
        }

    except Exception as e:
        step_context.logger.error(f"FFmpeg failed: {e}")
        raise e
    finally:
        # Cleanup
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)


# --- MAIN ORCHESTRATOR ---
@durable_execution
def lambda_handler(event: dict, context: DurableContext) -> dict:
    
    # Extract input
    # Assuming event format: { "query": "Find the dog", "requestId": "123" }
    request_id = event.get("requestId", str(uuid.uuid4()))
    user_query = event.get("query") 

    try:
        # --- PHASE 1: SEARCH ---
        send_event(request_id, "SEARCHING", message=f"Searching for '{user_query}'")
        
        search_result = context.step(search_video_step(user_query))
        
        # --- PHASE 2: PROCESSING (With Retries) ---
        send_event(request_id, "PROCESSING", message="Cutting video clip...")
        
        # Retry strategy: If FFmpeg fails (timeout/glitch), try 3 times
        retry_config = RetryStrategyConfig(max_attempts=3, backoff_rate=1.5)
        
        cut_result = context.step(
            cut_video_step(search_result, request_id),
            config=StepConfig(retry_strategy=create_retry_strategy(retry_config))
        )
        
        # --- PHASE 3: HUMAN APPROVAL ---
        # Create a callback token (valid for 24 hours)
        callback = context.create_callback(
            name="user-approval",
            config=CallbackConfig(timeout=Duration.from_hours(24))
        )
        
        # CRITICAL: Send the Presigned URL + Callback ID to the frontend/user
        send_event(
            request_id=request_id, 
            status="WAITING_FOR_APPROVAL", 
            callback_id=callback.callback_id,
            video_url=cut_result['presigned_url'],
            message="Clip ready. Please approve."
        )
        
        context.logger.info(f"Waiting for approval on callback: {callback.callback_id}")
        
        # Pause execution here until external API calls SendTaskSuccess
        approval_result = callback.result() 
        
        # --- PHASE 4: FINALIZATION ---
        # The approval_result comes from the external system (e.g., {"action": "approve"})
        if approval_result.get('action') == 'approve':
            send_event(request_id, "COMPLETED", message="Video approved and finalized.")
            return {
                "status": "COMPLETED",
                "final_video": cut_result['presigned_url']
            }
        else:
            send_event(request_id, "REJECTED", message="User rejected the clip.")
            return {"status": "REJECTED"}

    except Exception as e:
        context.logger.error(f"Pipeline Failed: {e}")
        send_event(request_id, "FAILED", message=str(e))
        raise e