import json
import boto3
import os

# Initialize Lambda Client
lambda_client = boto3.client('lambda')

def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    # AppSync invokes the lambda with "arguments"
    # Mutation: approveOrder(input: ApproveOrderResponseInput!)
    # Input has: status, orderId, callbackId
    input_data = event.get('arguments', {})
   
    status = input_data.get('status')
    callback_id = input_data.get('callbackId')
    message = input_data.get('message')
   
    
    if not status or not callback_id:
        print("Missing status or callbackId")
        return False

    try:
        if status == "APPROVED":
            payload = json.dumps({
                "status": "APPROVED",
                "message": message,
                "callback_id": callback_id,
            
            })
            print(f"Sending success callback for {callback_id}")
            lambda_client.send_durable_execution_callback_success(
                CallbackId=callback_id,
                Result=payload
            )
        else:

            print(f"Sending failure callback for {callback_id}")
            lambda_client.send_durable_execution_callback_failure(
                CallbackId=callback_id,
                Error={
                    'ErrorMessage':f"Video rejected with status: {status}",
                    'ErrorType':"VideoRejected"
                }
            )
            
        return True
    
    except Exception as e:
        print(f"Error processing approval: {e}")
        return False
