import { Construct } from 'constructs'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Architecture, Code, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import path from 'node:path'

export class AuthorizerFunctions extends Construct {
  readonly authFunction: NodejsFunction

  constructor(scope: Construct, id: string) {
    super(scope, id)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { publicRead, publicWrite, userInfoEndpoint, emailClaim } = this.node.getAllContext({
      publicRead: false,
      publicWrite: false,
      emailClaim: undefined,
    })

    const authLambdaRole = new Role(this, 'auth-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    })

    this.authFunction = new NodejsFunction(this, 'token-validator', {
      architecture: Architecture.ARM_64,
      code: Code.fromAsset(path.join(__dirname, 'functions')),
      description: 'validates authentication tokens',
      environment: {
        USER_INFO_ENDPOINT: userInfoEndpoint as string,
        ALLOW_PUBLIC_READ: publicRead as boolean ? 'true' : 'false',
        ALLOW_PUBLIC_WRITE: publicWrite as boolean ? 'true' : 'false',
        EMAIL_CLAIM: emailClaim as string,
      },
      handler: 'auth-token.verifyHandler',
      role: authLambdaRole,
      runtime: Runtime.NODEJS_22_X,
      tracing: Tracing.ACTIVE,
    })
  }
}
