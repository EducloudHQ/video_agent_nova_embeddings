import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { AppSyncConstruct } from './appsync-construct';


export class VideoAiAgentCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new AppSyncConstruct(this, "AppSyncConstruct",{});
  }
}
