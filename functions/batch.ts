import { S3 } from '@aws-sdk/client-s3'
import { BatchHandler } from './batch/BatchHandler'
import { loadConfig } from './config'
import { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyResultV2, Context } from 'aws-lambda'
import { TokenContext } from './auth/TokenValidator'

// noinspection JSUnusedGlobalSymbols
export const batchHandler = async (event: APIGatewayProxyEventV2WithLambdaAuthorizer<TokenContext>, context: Context): Promise<APIGatewayProxyResultV2> => {
  const s3 = new S3()
  const config = await loadConfig()
  const batchObj = new BatchHandler(s3, config)
  return batchObj.handler(event, context)
}
