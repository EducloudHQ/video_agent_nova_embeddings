#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { VideoAiAgentCdkStack } from '../lib/video-ai-agent-cdk-stack';
import { SearchWorkflowStack } from '../lib/search-workflow-stack';

const app = new cdk.App();
// Main Stack (us-east-1)
const mainStack = new VideoAiAgentCdkStack(app, 'VideoAiAgentCdkStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
});

// Search Workflow Stack (us-east-2) - depends on resources from Main Stack
new SearchWorkflowStack(app, 'SearchWorkflowStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-2" },
  crossRegionReferences: true,
  mediaBucketName: mainStack.appSyncConstruct.mediaBucket.bucketName,
  vectorBucketName: mainStack.appSyncConstruct.vectorBucketName,
  vectorIndexName: mainStack.appSyncConstruct.vectorIndexName,
  eventBusName: mainStack.appSyncConstruct.eventBusName,
});
