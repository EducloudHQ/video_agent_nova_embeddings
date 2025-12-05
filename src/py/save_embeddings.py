import boto3
import json
import os
import logging
from botocore.exceptions import ClientError

# --- CONFIGURATION FROM ENV VARS ---
# Define these in your CDK Lambda environment definition
SOURCE_BUCKET_NAME = os.environ.get('SOURCE_BUCKET_NAME') 
VECTOR_BUCKET_NAME = os.environ.get('VECTOR_BUCKET_NAME')
VECTOR_INDEX_NAME = os.environ.get('VECTOR_INDEX_NAME', '')
VECTOR_DIMENSION = int(os.environ.get('VECTOR_DIMENSION', '1024')) # Default to Titan v2 dimension

# Setup Logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Clients
s3_client = boto3.client('s3')
# Note: 's3vectors' is a preview/specific namespace. 
# Ensure your Lambda Layer has a boto3 version that supports this.
s3_vectors_client = boto3.client('s3vectors')

def ensure_vector_infrastructure():
    """
    Idempotent check to create Vector Bucket and Index if they don't exist.
    """
    # 1. Create Vector Bucket
    try:
        s3_vectors_client.create_vector_bucket(vectorBucketName=VECTOR_BUCKET_NAME)
        logger.info(f"Created Vector Bucket: {VECTOR_BUCKET_NAME}")
    except s3_vectors_client.exceptions.ResourceAlreadyExistsException:
        logger.info(f"Vector Bucket {VECTOR_BUCKET_NAME} already exists.")
    except Exception as e:
        logger.error(f"Error checking/creating vector bucket: {e}")
        raise e

    # 2. Create Vector Index
    try:
        s3_vectors_client.create_index(
            vectorBucketName=VECTOR_BUCKET_NAME,
            indexName=VECTOR_INDEX_NAME,
            dimension=VECTOR_DIMENSION,
            distanceMetric='cosine', # Common for embeddings
            dataType='float32'
        )
        logger.info(f"Created Vector Index: {VECTOR_INDEX_NAME}")
    except s3_vectors_client.exceptions.ResourceAlreadyExistsException:
        logger.info(f"Vector Index {VECTOR_INDEX_NAME} already exists.")
    except Exception as e:
        logger.error(f"Error checking/creating vector index: {e}")
        raise e

def process_jsonl_file(key):
    """
    Streams a JSONL file from S3, parses vectors, and pushes to S3 Vector Index.
    Expected JSONL format per line:
    {"id": "abc", "embedding": [0.1, 0.2...], "metadata": {"key": "value"}}
    """
    logger.info(f"Processing file: {key}")
    
    try:
        response = s3_client.get_object(Bucket=SOURCE_BUCKET_NAME, Key=key)
        # Use line iteration on the streaming body to be memory efficient
        stream = response['Body'].iter_lines()
        
        batch = []
        batch_size = 20 # Adjust based on S3 Vector API limits/throughput
        
        for line in stream:
            if not line: continue
            
            try:
                record = json.loads(line)
                
                # Map JSONL fields to S3 PutVectors format
                # Assuming JSONL has 'id' and 'embedding' keys
                vector_entry = {
                    'vectorId': str(record.get('id')),
                    'vectorData': record.get('embedding'),
                }
                
                # Add metadata if it exists
                if 'metadata' in record:
                    # Ensure metadata values are strings as typically required by vector stores
                    # or strictly typed depending on S3 Vector requirements
                    vector_entry['metadata'] = record.get('metadata')

                batch.append(vector_entry)

                if len(batch) >= batch_size:
                    flush_batch(batch)
                    batch = []
                    
            except json.JSONDecodeError:
                logger.warning(f"Skipping invalid JSON line in {key}")
                continue

        # Flush remaining
        if batch:
            flush_batch(batch)
            
    except Exception as e:
        logger.error(f"Failed to process file {key}: {e}")
        raise e

def flush_batch(batch):
    """
    Sends a batch of vectors to the S3 Vector Index
    """
    try:
        # Construct the ARN required for the API call
        # Format: arn:aws:s3vectors:region:account:bucket/bucket-name/index/index-name
        account_id = boto3.client('sts').get_caller_identity().get('Account')
        region = boto3.session.Session().region_name
        
        # Note: Check the specific Boto3 version documentation for 'put_vectors' arguments.
        # Some versions imply the ARN, some take Bucket/Index names directly.
        # Based on your reference pattern, we assume ARN usage or specific parameters.
        
        s3_vectors_client.put_vectors(
            vectorBucketName=VECTOR_BUCKET_NAME,
            indexName=VECTOR_INDEX_NAME,
            vectors=batch
        )
        logger.info(f"Successfully ingested batch of {len(batch)} vectors.")
    except Exception as e:
        logger.error(f"Error flushing batch: {e}")
        # In production, you might want a Dead Letter Queue (DLQ) strategy here
        raise e

def lambda_handler(event, context):
    """
    here's the event format: {
  "ClientRequestToken": "0fcc4f66-637f-4740-aefb-175e522833a8",
  "EndTime": "2025-12-05T18:08:52Z",
  "InvocationArn": "arn:aws:bedrock:us-east-1:132260253285:async-invoke/quy2fplc31iw",
  "LastModifiedTime": "2025-12-05T18:09:23Z",
  "ModelArn": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0",
  "OutputDataConfig": {
    "S3OutputDataConfig": {
      "S3Uri": "s3://132260253285-us-east-1-video-media-bucket/quy2fplc31iw"
    }
  },
  "Status": "Completed",
  "SubmitTime": "2025-12-05T18:08:22Z"
}
    """
    # Extract the prefix from the S3Uri in the event
    s3_uri = event.get('OutputDataConfig', {}).get('S3OutputDataConfig', {}).get('S3Uri', '')
    # S3Uri format: s3://bucket-name/prefix
    # We split by '/' and take the last part
    prefix = s3_uri.split('/')[-1] if s3_uri else ''


    logger.info("events {event}")
    prefix = event.get('prefix', '')
    
    logger.info("--- Starting Vector Ingestion Job ---")
    logger.info(f"Source Bucket: {SOURCE_BUCKET_NAME}")
    logger.info(f"Target Vector Index: {VECTOR_INDEX_NAME}")

    # 1. Ensure Infrastructure Exists
    # ensure_vector_infrastructure()

    # 2. List JSONL files in Source Bucket
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(Bucket=SOURCE_BUCKET_NAME, Prefix=prefix)

        file_count = 0
        for page in page_iterator:
            if 'Contents' not in page:
                continue
                
            for obj in page['Contents']:
                key = obj['Key']
                if key.endswith('.jsonl'):
                    process_jsonl_file(key)
                    file_count += 1
        
        return {
            'statusCode': 200,
            'body': json.dumps(f"Processed {file_count} files successfully.")
        }

    except Exception as e:
        logger.error(f"Fatal error in execution: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(str(e))
        }
