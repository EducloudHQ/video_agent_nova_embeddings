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
      layers: [ffmpegLayer],
      environment: {
        VECTOR_BUCKET_NAME: props.vectorBucketName,
        VECTOR_INDEX_NAME: props.vectorIndexName,
        EVENT_BUS_NAME: props.eventBusName,
        SOURCE_BUCKET_NAME: props.mediaBucketName,
      }
    });

 
     // Create version and alias
    const version = searchCutWorkflowFunction.currentVersion;
    const alias = new lambda.Alias(this, 'ProdAlias', {
      aliasName: 'prod',
      version: version,
    });

       this.searchCutWorkflowFunctionArn = alias.functionArn;



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
      searchCutWorkflowFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModel"],
          resources: ["arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0"],
          effect: iam.Effect.ALLOW,
        })
      );
  
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

      // EventBridge Access
      searchCutWorkflowFunction.addToRolePolicy(
          new iam.PolicyStatement({
              actions: ["events:PutEvents"],
              resources: [`arn:aws:events:us-east-1:${this.account}:event-bus/${props.eventBusName}`],
              effect: iam.Effect.ALLOW
          })
      );
  }
}
