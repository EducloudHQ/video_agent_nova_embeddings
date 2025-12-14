import boto3
import json

def verify_bucket():
    s3 = boto3.client('s3', region_name='us-east-1')
    bucket_name = 'video-agent-vector-bucket'
    
    print(f"Checking bucket: {bucket_name}")
    
    try:
        # Check if bucket exists/accessible
        s3.head_bucket(Bucket=bucket_name)
        print("Bucket exists and is accessible.")
        
        # List objects
        paginator = s3.get_paginator('list_objects_v2')
        response_iterator = paginator.paginate(Bucket=bucket_name)
        
        count = 0
        for page in response_iterator:
            if 'Contents' in page:
                for obj in page['Contents']:
                    print(f" - Found object: {obj['Key']}")
                    count += 1
        
        print(f"Total objects found: {count}")
        
    except Exception as e:
        print(f"Error accessing bucket: {e}")

if __name__ == "__main__":
    verify_bucket()
