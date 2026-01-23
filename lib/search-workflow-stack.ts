import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";

interface SearchWorkflowStackProps extends cdk.StackProps {
  mediaBucketName: string;
  vectorBucketName: string;
  vectorIndexName: string;
  eventBusName: string;
}

export class SearchWorkflowStack extends cdk.Stack {
  public readonly searchCutWorkflowFunctionArn: string;

  constructor(scope: Construct, id: string, props: SearchWorkflowStackProps) {
    super(scope, id, props);

    const ffmpegLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "FfmpegLayer",
      "arn:aws:lambda:us-east-1:132260253285:layer:ffmpeg-executable-file:1"
    );

    const searchFunctionLogs = new logs.LogGroup(
      this,
      "searchFunctionLogs",
      {
        retention: logs.RetentionDays.ONE_WEEK,
      }
    );

    // Create search function
    const searchCutWorkflowFunction = new PythonFunction(this, "SearchCutWorkflowFunction", {
      entry: "./src/py/",
      handler: "lambda_handler",
      index: "search_cut_workflow.py",
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
      memorySize: 1024, 
      functionName: "SearchCutWorkflowFunction", // Fixed name for cross-region lookup
      durableConfig: {
          executionTimeout: cdk.Duration.days(365),
         retentionPeriod: cdk.Duration.days(7),
        },
      
      logGroup: searchFunctionLogs,
      tracing: cdk.aws_lambda.Tracing.ACTIVE,
      layers: [
        // TODO: (Exercise 8) Attach the FFmpeg Layer to the function
        // Hint: Use the ffmpegLayer variable defined above
        // ffmpegLayer
      ],
      environment: {
        // TODO: (Exercise 1) Define environment variables needed for the search function
        // Hint: You need VECTOR_BUCKET_NAME, VECTOR_INDEX_NAME, EVENT_BUS_NAME, and SOURCE_BUCKET_NAME from props
      }
    });

 
       // TODO: (Exercise 9) Create a Lambda Version and Alias for the search function
       // Hint: AWS Durable Execution requires a specific version/alias for checkpointing to work.
       // Create a version and an alias named 'prod'.
       /*
       const version = searchCutWorkflowFunction.currentVersion;
       const alias = new lambda.Alias(this, 'ProdAlias', {
         aliasName: 'prod',
         version: version,
       });
       this.searchCutWorkflowFunctionArn = alias.functionArn;
       */
       this.searchCutWorkflowFunctionArn = searchCutWorkflowFunction.functionArn; // Placeholder



       // Add checkpoint permissions
    searchCutWorkflowFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'lambda:CheckpointDurableExecutions',
        'lambda:GetDurableExecutionState',
         'lambda:SendDurableExecutionCallbackSuccess',
        'lambda:SendDurableExecutionCallbackFailure',
      ],
      resources: ["*"],
    }));

    // Grant permissions
    
    // S3 Vector Bucket Access
    searchCutWorkflowFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:ListBucket"],
          resources: [
            `arn:aws:s3:::${props.vectorBucketName}`,
            `arn:aws:s3:::${props.vectorBucketName}/*`
          ],
          effect: iam.Effect.ALLOW,
        })
      );
  
      // Bedrock Access
      // TODO: (Exercise 2) Add IAM permissions for Bedrock model invocation
      // Hint: Allow 'bedrock:InvokeModel' on the specific Nova multimodal embeddings model ARN
      /*
      searchCutWorkflowFunction.addToRolePolicy(
        new iam.PolicyStatement({
          // ...
        })
      );
      */
  
      // S3 Vectors & KMS
      searchCutWorkflowFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["s3vectors:QueryVectors","s3vectors:GetVectors","kms:Decrypt"], 
          resources: ["*"], 
        })
      );

      // Media Bucket Access (Cross-region S3 access works naturally via ARN)
      searchCutWorkflowFunction.addToRolePolicy(
        new iam.PolicyStatement({
            actions: ["s3:GetObject", "s3:ListBucket", "s3:PutObject"],
            resources: [
                `arn:aws:s3:::${props.mediaBucketName}`,
                `arn:aws:s3:::${props.mediaBucketName}/*`
            ],
            effect: iam.Effect.ALLOW
        })
      );


      /*
      // TODO: (Exercise 16) Grant the function permission to put events onto the VideoAgentEventBus
      // Hint: Allow 'events:PutEvents' on the EventBridge bus ARN from props
      searchCutWorkflowFunction.addToRolePolicy(
          new iam.PolicyStatement({
              actions: ["events:PutEvents"],
              resources: [`arn:aws:events:us-east-1:${this.account}:event-bus/${props.eventBusName}`],
              effect: iam.Effect.ALLOW
          })
      );
      */
  }
}
