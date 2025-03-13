import { LambdaInterface } from '@aws-lambda-powertools/commons/types'
import { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult, Context } from 'aws-lambda'
import { Tracer } from '@aws-lambda-powertools/tracer'
import { Metrics } from '@aws-lambda-powertools/metrics'

const tracer = new Tracer()
const metrics = new Metrics({
  namespace: 'serverless-lfs',
  serviceName: 'auth',
})

export interface TokenContext {
  tokenProvided: boolean
  tokenValid: boolean
  email?: string
}

export class TokenValidator implements LambdaInterface {
  private readonly publicRead = process.env.ALLOW_PUBLIC_READ === 'true'
  private readonly publicWrite = this.publicRead && process.env.ALLOW_PUBLIC_WRITE === 'true'
  private readonly anyPublic = this.publicWrite || this.publicRead
  private readonly userInfoEndpoint: string
  private readonly emailClaim = process.env.EMAIL_CLAIM ?? 'email'

  constructor() {
    const endpoint = process.env.USER_INFO_ENDPOINT
    if (endpoint === undefined) {
      throw new Error('user endpoint must be defined')
    }
    else {
      this.userInfoEndpoint = endpoint
    }
  }

  @tracer.captureLambdaHandler()
  @metrics.logMetrics({ captureColdStartMetric: true })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handler(event: APIGatewayRequestAuthorizerEventV2, _context: Context): Promise<APIGatewaySimpleAuthorizerWithContextResult<TokenContext>> {
    if (!event.headers?.Authorization) {
      return {
        isAuthorized: this.anyPublic,
        context: {
          tokenProvided: false,
          tokenValid: false,
        },
      }
    }

    const token = event.headers.Authorization
    const context: TokenContext = {
      tokenProvided: false,
      tokenValid: false,
    }

    if (token.startsWith('Bearer ')) {
      context.tokenProvided = true
      const result = await fetch(this.userInfoEndpoint, {
        method: 'GET',
        headers: {
          Authorization: token,
        },
      })
      if (result.status === 200) {
        context.tokenValid = true
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const obj: Record<string, unknown> = await result.json()
        const email = obj[this.emailClaim]
        if (typeof email === 'string') {
          context.email = email
        }
      }
    }

    return {
      isAuthorized: this.anyPublic || context.tokenValid,
      context,
    }
  }
}
