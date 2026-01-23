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
                "action": "approve",
                "status": "APPROVED",
                "message": message,
                "callback_id": callback_id,
            })
            # TODO: (Exercise 12) Send success callback to the Durable Execution engine
            # Hint: Use lambda_client.send_durable_execution_callback_success
            print(f"Would send success callback for {callback_id}")
        else:
            # TODO: (Exercise 12) Send failure callback to the Durable Execution engine
            # Hint: Use lambda_client.send_durable_execution_callback_failure
            print(f"Would send failure callback for {callback_id}")
                
        return True
    
    except Exception as e:
        print(f"Fatal error in handler: {e}")
        return False

