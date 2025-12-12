import json
import boto3
import os

# Initialize Lambda Client
lambda_client = boto3.client('lambda')
SEARCH_CUT_WORKFLOW_FUNCTION_ARN = os.environ.get('SEARCH_CUT_WORKFLOW_FUNCTION_ARN')

def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    # AppSync invokes the lambda with "arguments"
    # Mutation: createOrder(input: String!)
    input_data = event.get('arguments', {}).get('text')
    
    
    if not input_data:
        print("No input provided")
        return False

    try:
        # Construct the payload for the durable function
        # The durable function expects "order_id" (based on our reading of it)
        payload = json.dumps({"query": input_data})
        
        # Invoke the durable order function
        response = lambda_client.invoke(
            FunctionName=SEARCH_CUT_WORKFLOW_FUNCTION_ARN,
            InvocationType='Event', # Async invocation to start the process
            Payload=payload
        )
        
        print(f"Invoked order function: {response}")
        
        return True
    
    except Exception as e:
        print(f"Error invoking order function: {e}")
        return False