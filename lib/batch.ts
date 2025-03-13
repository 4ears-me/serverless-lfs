import { Construct } from 'constructs'
import { Architecture, Code, IFunction, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import { S3Storage } from './s3-storage'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import path from 'node:path'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'

export class BatchApi extends Construct {
  readonly batchHandler: IFunction

  constructor(scope: Construct, id: string) {
    super(scope, id)

    const publicRead: boolean = this.node.tryGetContext('publicRead') as boolean
    const publicWrite: boolean = this.node.tryGetContext('publicWrite') as boolean
    const s3 = new S3Storage(this, 'lfs-storage')

    const role = new Role(this, 'batch-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'role for batch API handler',
      managedPolicies: [s3.bucketAccessPolicy],
    })

    this.batchHandler = new NodejsFunction(this, 'batch-function', {
      architecture: Architecture.ARM_64,
      code: Code.fromAsset(path.join(__dirname, 'functions')),
      description: 'validates authentication tokens',
      environment: {
        BUCKET: s3.bucketName,
        ALLOW_PUBLIC_READ: publicRead ? 'true' : 'false',
        ALLOW_PUBLIC_WRITE: publicWrite ? 'true' : 'false',
      },
      handler: 'auth-token.verifyHandler',
      role: role,
      runtime: Runtime.NODEJS_22_X,
      tracing: Tracing.ACTIVE,
    })
  }
}
