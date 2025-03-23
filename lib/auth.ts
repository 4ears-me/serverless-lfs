import { Construct } from 'constructs'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Architecture, Code, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import path from 'node:path'
import { FunctionConfig } from './config'

export class AuthorizerFunctions extends Construct {
  readonly authFunction: NodejsFunction

  constructor(scope: Construct, id: string, config: FunctionConfig) {
    super(scope, id)

    const authLambdaRole = new Role(this, 'auth-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    })

    this.authFunction = new NodejsFunction(this, 'token-validator', {
      architecture: Architecture.ARM_64,
      code: Code.fromAsset(path.join(__dirname, 'functions')),
      description: 'validates authentication tokens',
      environment: config.envVars,
      handler: 'auth-token.verifyHandler',
      role: authLambdaRole,
      runtime: Runtime.NODEJS_22_X,
      tracing: Tracing.ACTIVE,
    })
  }
}
