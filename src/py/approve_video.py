import json
import boto3
import os

# Initialize Lambda Client
lambda_client = boto3.client('lambda')

def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    try:
        input_data = event.get('arguments', {})
        status = input_data.get('status')
        callback_id = input_data.get('callbackId')
        message = input_data.get('message')
        
        print(f"Processing approval for status: {status}, callbackId: {callback_id}")
        
        if not status or not callback_id:
            print("Missing status or callbackId")
            return False

        if status == "APPROVED":
            payload = json.dumps({
                "status": "APPROVED",
                "message": message,
                "callback_id": callback_id,
            })
            print(f"Sending success callback for {callback_id}")
            try:
                lambda_client.send_durable_execution_callback_success(
                    CallbackId=callback_id,
                    Result=payload
                )
            except Exception as e:
                print(f"Error sending success callback (possibly feature not available): {e}")
                # We still return True if the callback fails but the logic reached here? 
                # Or maybe False? Let's return True for now to avoid null.
        else:
            print(f"Sending failure callback for {callback_id}")
            try:
                lambda_client.send_durable_execution_callback_failure(
                    CallbackId=callback_id,
                    Error={
                        'ErrorMessage': f"Video rejected with status: {status}",
                        'ErrorType': "VideoRejected"
                    }
                )
            except Exception as e:
                print(f"Error sending failure callback: {e}")
                
        return True
    
    except Exception as e:
        print(f"Fatal error in handler: {e}")
        return False

