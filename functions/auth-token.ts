import { TokenContext, TokenValidator } from './auth/TokenValidator'
import { loadConfig } from './config'
import { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult, Context } from 'aws-lambda'

// noinspection JSUnusedGlobalSymbols
export const verifyHandler = async (event: APIGatewayRequestAuthorizerEventV2, context: Context): Promise<APIGatewaySimpleAuthorizerWithContextResult<TokenContext>> => {
  const config = await loadConfig()
  const validator = new TokenValidator(config)
  return validator.handler(event, context)
}
