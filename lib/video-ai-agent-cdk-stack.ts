import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { AppSyncConstruct } from './appsync-construct';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class VideoAiAgentCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new AppSyncConstruct(this, "AppSyncConstruct",{});
  }
}
