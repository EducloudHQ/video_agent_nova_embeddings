import * as cdk from 'aws-cdk-lib';
import { VideoAiAgentCdkStack } from '../lib/video-ai-agent-cdk-stack';
import { SearchWorkflowStack } from '../lib/search-workflow-stack';

const app = new cdk.App();
const account = "132260253285";

// Main Stack (us-east-1)
const mainStack = new VideoAiAgentCdkStack(app, 'VideoAiAgentCdkStack', {
  env: { account, region: "us-east-1" },
});

// Search Workflow Stack (us-east-1)
new SearchWorkflowStack(app, 'SearchWorkflowStack', {
  env: { account, region: "us-east-1" },
  mediaBucketName: mainStack.appSyncConstruct.mediaBucket.bucketName,
  vectorBucketName: mainStack.appSyncConstruct.vectorBucketName,
  vectorIndexName: mainStack.appSyncConstruct.vectorIndexName,
  eventBusName: mainStack.appSyncConstruct.eventBusName,
});
