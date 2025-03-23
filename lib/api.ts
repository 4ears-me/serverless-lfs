import { Construct } from 'constructs'
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { AuthorizerFunctions } from './auth'
import { CfnOutput } from 'aws-cdk-lib'
import { BatchApi } from './batch'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { FunctionConfig } from './config'
import { S3Storage } from './s3-storage'

export class LfsApi extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const s3 = new S3Storage(this, 'lfs-storage')
    const config = new FunctionConfig(this, 'lfs-function-config', s3.bucketName)
    const auth = new AuthorizerFunctions(this, 'auth-functions', config)

    const api = new HttpApi(this, 'lfs-api', {
      apiName: 'lfs-api',
      createDefaultStage: true,
      defaultAuthorizer: new HttpLambdaAuthorizer('api-auth', auth.authFunction),
      description: 'LFS API implementation',
    })

    new CfnOutput(this, 'ApiBaseUrl', { value: api.apiEndpoint })

    const batchApi = new BatchApi(this, 'batch-api', s3, config)

    const integration = new HttpLambdaIntegration('batch-api-integration', batchApi.batchHandler)
    api.addRoutes({
      integration: integration,
      path: '/info/lfs/objects/batch',
      methods: [HttpMethod.POST],
    })
  }
}
