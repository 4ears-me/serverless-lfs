import { Construct } from 'constructs'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
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
      description: 'validates authentication tokens',
      environment: config.envVars,
      handler: 'verifyHandler',
      entry: 'functions/auth-token.ts',
      role: authLambdaRole,
      runtime: Runtime.NODEJS_22_X,
      tracing: Tracing.ACTIVE,
      bundling: {
        format: OutputFormat.ESM,
        minify: false,
        esbuildArgs: {
          '--tree-shaking': 'true',
        },
        bundleAwsSDK: false,
      },
    })
  }
}
