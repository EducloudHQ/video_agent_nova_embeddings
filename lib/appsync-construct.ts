import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import * as kms from "aws-cdk-lib/aws-kms";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as s3Vectors from "cdk-s3-vectors";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";


import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { readFileSync } from "fs";
import { BEDROCK_MODELS, DEFAULT_API_KEY_EXPIRATION_DAYS } from "./constants";

interface AppSyncConstructProps {

}
/**
 * Construct for AppSync API and related resources
 */
export class AppSyncConstruct extends Construct {
  /**
   * The AppSync GraphQL API
   */
  public readonly api: appsync.GraphqlApi;
  public readonly customDs: bedrock.CfnDataSource;
  public readonly invokeWorkflowFunction: NodejsFunction;
  public readonly saveEmbeddingsFunction: NodejsFunction;
  public readonly mediaBucket: s3.Bucket;
  public readonly generateEmbeddingsStateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: AppSyncConstructProps={}) {
    super(scope, id);

    // Calculate API key expiration date
    const currentDate = new Date();
    const keyExpirationDate = new Date(
      currentDate.getTime() +
        DEFAULT_API_KEY_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    );

    // Create KMS key for encryption (optional)
    const encryptionKey = new kms.Key(this, "VectorBucketKey", {
      description: "KMS key for S3 vector bucket encryption",
      enableKeyRotation: true,
    });

   

    // Create an S3 bucket for storing generated videos and thumbnails
    this.mediaBucket = new s3.Bucket(this, "VideoMediaBucket", {
      bucketName: `${cdk.Stack.of(this).account}-${
        cdk.Stack.of(this).region
      }-video-media-bucket`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: "DeleteOldVersions",
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // Create a vector bucket with all options
    const vectorBucket = new s3Vectors.Bucket(this, "VideoAgentVectorBucket", {
      vectorBucketName: "video-agent-vector-bucket",
      encryptionConfiguration: {
        sseType: "aws:kms", // 'AES256' | 'aws:kms'
        kmsKey: encryptionKey, // Required when sseType is 'aws:kms'
      },
    });
    // Create a vector index with all options
    const vectorIndex = new s3Vectors.Index(this, "VideoAgentVectorIndex", {
      vectorBucketName: vectorBucket.vectorBucketName, // REQUIRED
      indexName: "video-agent-vector-index", // REQUIRED
      dataType: "float32", // REQUIRED (only 'float32' supported)
      dimension: 1024, // REQUIRED (1-4096)
      distanceMetric: "cosine", // REQUIRED ('euclidean' | 'cosine')
      // Optional metadata configuration
      metadataConfiguration: {
        nonFilterableMetadataKeys: ["source", "timestamp", "category"],
      },
    });
    // REQUIRED - add dependency for vector index
    vectorIndex.node.addDependency(vectorBucket);

  
  
  
  

    // Create the AppSync API
    this.api = new appsync.GraphqlApi(this, "video-agent-api", {
      name: "VideoAgentAPI",
      definition: appsync.Definition.fromFile("schema/schema.graphql"),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            name: "default",
            description: "Default API key for Ai Writer API",
            expires: cdk.Expiration.atDate(keyExpirationDate),
          },
        },
      },
      xrayEnabled: true,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
    });

    // Create data sources
    const noneDs = this.api.addNoneDataSource("None");

       // Create a data source for Bedrock Retrieve and Generate
    const bedrockRetrieveAndGenerateDS = this.api.addHttpDataSource(
      "BedrockRetrieveAndGenerateDS",
      `https://bedrock-agent-runtime.us-east-1.amazonaws.com`,
      {
        authorizationConfig: {
          signingRegion: "us-east-1",
          signingServiceName: "bedrock",
        },
      }
    );

   
  
    // dedicated log group (avoid logRetention deprecation)
    const workflowFunctionLogs = new logs.LogGroup(
      this,
      "workflowFunctionLogs",
      {
        retention: logs.RetentionDays.ONE_WEEK,
      }
    );
     const embeddingsFunctionLogs = new logs.LogGroup(
      this,
      "embeddingsFunctionLogs",
      {
        retention: logs.RetentionDays.ONE_WEEK,
      }
    );
     const invokeWorkflowFunctionLogs = new logs.LogGroup(
      this,
      "invokeWorkflowFunctionLogs",
      {
        retention: logs.RetentionDays.ONE_WEEK,
      }
    );
         const searchFunctionLogs = new logs.LogGroup(
      this,
      "searchFunctionLogs",
      {
        retention: logs.RetentionDays.ONE_WEEK,
      }
    );

      this.saveEmbeddingsFunction = new PythonFunction(
      this,
      "saveEmbeddingsFunction",
      {
        entry: "./src/py/",
        handler: "lambda_handler",
        index: "save_embeddings.py",
        runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
        memorySize: 512,
        timeout: cdk.Duration.minutes(10),
        logGroup: embeddingsFunctionLogs,
        tracing: cdk.aws_lambda.Tracing.ACTIVE,
       
        environment: {

        
          VECTOR_BUCKET_NAME: vectorBucket.vectorBucketName,
          VECTOR_INDEX_NAME: vectorIndex.indexName,
          SOURCE_BUCKET_NAME: this.mediaBucket.bucketName,
        },
      }
    );

      // Create an IAM role for Step Functions
    const stateMachineRole = new iam.Role(this, "StateMachineRole", {
      assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
      description: "IAM Role assumed by the Step Functions state machine",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaRole"
        ),
      ],
    });

        // Create the state machine for generating embeddings 
    this.generateEmbeddingsStateMachine = new sfn.StateMachine(
      this,
      "GenerateEmbeddingsStateMachine",
      {
        stateMachineName: "GenerateEmbeddingsStateMachine",
        role: stateMachineRole,
        definitionBody: sfn.DefinitionBody.fromFile(path.join(__dirname, "../workflow/generate_embeddings.asl.json")),

        definitionSubstitutions: {
          FUNCTION_ARN: this.saveEmbeddingsFunction.functionArn,
        },
        tracingEnabled: true,
        logs: {
          destination: new cdk.aws_logs.LogGroup(this, "WithContextLogGroup", {
            logGroupName:
              "/aws/stepfunctions/GenerateEmbeddingsStateMachine",
            retention: cdk.aws_logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
          level: sfn.LogLevel.ALL,
        },
      }
    );

     // Grant permission to access the media bucket
    this.mediaBucket.grantReadWrite(stateMachineRole);

    // Grant permission to invoke the Lambda function
    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [this.saveEmbeddingsFunction.functionArn],
        effect: iam.Effect.ALLOW,
      })
    );

    // Grant permission to invoke bedrock nova embeddings
    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel","bedrock:startAsyncInvoke","bedrock:getAsyncInvoke"],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

    this.invokeWorkflowFunction = new NodejsFunction(
      this,
      "invokeWorkflowFunction",
      {
        entry: path.join(
          __dirname,
          "../src/ts/invokeWorkflowFunction.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        memorySize: 256,
        logGroup: invokeWorkflowFunctionLogs,
        tracing: lambda.Tracing.ACTIVE,
        environment: {
          STATE_MACHINE_ARN:this.generateEmbeddingsStateMachine.stateMachineArn,
           SOURCE_BUCKET_NAME: this.mediaBucket.bucketName,

        },
        bundling: {
          minify: true,
        },
      }
    );

  
     // Configure the S3 bucket to trigger the Lambda function when files are uploaded to the videos/ path
    this.mediaBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.invokeWorkflowFunction),
      {
        prefix: "videos/",
      }
    );

    this.mediaBucket.grantReadWrite(this.invokeWorkflowFunction);
    this.invokeWorkflowFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["states:StartExecution","states:DescribeExecution"],
        resources: [this.generateEmbeddingsStateMachine.stateMachineArn],
        effect: iam.Effect.ALLOW,
      })
    );
   
  
    this.saveEmbeddingsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:ListBucket"],
        resources: [this.mediaBucket.bucketArn, `${this.mediaBucket.bucketArn}/*`],
      })
    );

    // Create EventBridge EventBus for Video Agent
    const videoAgentEventBus = new cdk.aws_events.EventBus(this, "VideoAgentEventBus", {
      eventBusName: "VideoAgentEventBus",
    });

    // Import FFmpeg Layer
    const ffmpegLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "FfmpegLayer",
      "arn:aws:lambda:us-east-2:132260253285:layer:ffmpeg:1"
    );

   

  
    // Create search function
    const searchCutWorkflowFunction = new PythonFunction(this, "SearchCutWorkflowFunction", {
      entry: "./src/py/",
      handler: "lambda_handler",
      index: "search_cut_workflow.py",
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
      memorySize: 1024, 
     
      durableConfig: {
          executionTimeout: cdk.Duration.days(365),
         retentionPeriod: cdk.Duration.days(7),
        },
      
      logGroup: searchFunctionLogs,
      tracing: cdk.aws_lambda.Tracing.ACTIVE,
      layers: [ffmpegLayer],
      environment: {
        VECTOR_BUCKET_NAME: vectorBucket.vectorBucketName,
        VECTOR_INDEX_NAME: vectorIndex.indexName,
        EVENT_BUS_NAME: videoAgentEventBus.eventBusName,
        SOURCE_BUCKET_NAME: this.mediaBucket.bucketName,
      }
    });
        // Create version and alias
    const version = searchCutWorkflowFunction.currentVersion;
    const alias = new lambda.Alias(this, 'ProdAlias', {
      aliasName: 'prod',
      version: version,
    });
          const invokeSearchCutWorkflowFunction = new PythonFunction(this,
      "invokeSearchCutWorkflowFunction",
      {
        entry: "./src/py/",
        handler: "handler",
        index: "invoke_search_cut_workflow.py",
        runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(30),
        logGroup: new logs.LogGroup(
      this,
      "invokeSearchCutWorkflowFunctionLogs",
      {
        retention: logs.RetentionDays.ONE_WEEK,
      }
    ),
        environment: {
          SEARCH_CUT_WORKFLOW_FUNCTION_ARN: alias.functionArn,
        },
      }
    );

      searchCutWorkflowFunction.grantInvoke(invokeSearchCutWorkflowFunction);

       // Add checkpoint permissions
    searchCutWorkflowFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'lambda:CheckpointDurableExecutions',
        'lambda:GetDurableExecutionState',
      ],
      resources: ["*"],
    }));


    // Permissions for searchFunction
    this.mediaBucket.grantReadWrite(searchCutWorkflowFunction);
    videoAgentEventBus.grantPutEventsTo(searchCutWorkflowFunction);

    // Grant Read Access to Vector Bucket (Manual Policy as s3Vectors.Bucket might not expose grantRead)
    searchCutWorkflowFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:ListBucket"],
        resources: [
          `arn:aws:s3:::${vectorBucket.vectorBucketName}`,
          `arn:aws:s3:::${vectorBucket.vectorBucketName}/*`
        ],
        effect: iam.Effect.ALLOW,
      })
    );

    searchCutWorkflowFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-embed-multimodal-v1:0"],
        effect: iam.Effect.ALLOW,
      })
    );

    // Grant s3vectors permissions
    searchCutWorkflowFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3vectors:QueryVectors"], 
        resources: ["*"], // Granulize if possible
      })
    );

     this.api.addEnvironmentVariable(
      "FOUNDATION_MODEL_ARN",
      BEDROCK_MODELS.CLAUDE_3_5_SONNET
    );
        



    //export graphq api endpoint
    new cdk.CfnOutput(this, "GraphQLAPIEndpoint", {
      value: this.api.graphqlUrl,
      description: " The GraphQL API Endpoint",
    });
  

  }
}
