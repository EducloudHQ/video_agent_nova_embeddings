import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { AppSyncConstruct } from './appsync-construct';


export class VideoAiAgentCdkStack extends cdk.Stack {
  public readonly appSyncConstruct: AppSyncConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.appSyncConstruct = new AppSyncConstruct(this, "AppSyncConstruct",{});
  }
}
