import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { LfsApi } from './api'

export class ServerlessLfsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    new LfsApi(this, 'lfs-api')
  }
}
