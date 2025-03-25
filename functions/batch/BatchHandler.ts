import { LambdaInterface } from '@aws-lambda-powertools/commons/types'
import { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyResultV2, Context } from 'aws-lambda'
import { GetObjectCommand, NoSuchKey, ObjectAttributes, PutObjectCommand, S3 } from '@aws-sdk/client-s3'
import { Metrics } from '@aws-lambda-powertools/metrics'
import { Tracer } from '@aws-lambda-powertools/tracer'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { TokenContext } from '../auth/TokenValidator'
import { BatchError, BatchRequest, BatchResponse, ResponseObject } from './api-types'
import { ConfigValue } from '../config'

const metrics = new Metrics({
  namespace: 'serverless-lfs',
  serviceName: 'batch',
})
const tracer = new Tracer()

/**
 * Handler for the batch API.
 */
export class BatchHandler implements LambdaInterface {
  /**
   * Build a new batch handler.
   *
   * @param s3 the S3 client to use
   * @param config the config for this handler
   * @throws Error if the BUCKET environment variable is not provided
   */
  constructor(private readonly s3: S3, private readonly config: ConfigValue) {
  }

  @metrics.logMetrics({ captureColdStartMetric: true })
  @tracer.captureLambdaHandler()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handler(event: APIGatewayProxyEventV2WithLambdaAuthorizer<TokenContext>, _context: Context): Promise<APIGatewayProxyResultV2> {
    let result: BatchResponse
    if (event.body === undefined) {
      return {
        statusCode: 400,
      }
    }
    const request: BatchRequest = JSON.parse(event.body) as BatchRequest

    switch (request.operation) {
      case 'upload':
        if (this.config.publicWrite || event.requestContext.authorizer.lambda.tokenValid) {
          result = await this.upload(request)
        }
        else {
          return {
            body: JSON.stringify({
              message: 'No valid authentication found.',
              request_id: event.requestContext.requestId,
            } as BatchError),
            statusCode: 401,
            headers: {
              'Content-Type': 'application/vnd.git-lfs+json',
            },
          }
        }
        break
      case 'download':
        if (this.config.publicRead || event.requestContext.authorizer.lambda.tokenValid) {
          result = await this.download(request)
        }
        else {
          return {
            body: JSON.stringify({
              message: 'No valid authentication found.',
              request_id: event.requestContext.requestId,
            } as BatchError),
            statusCode: 401,
            headers: {
              'Content-Type': 'application/vnd.git-lfs+json',
            },
          }
        }
        break
    }

    return {
      body: JSON.stringify(result),
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.git-lfs+json',
      },
    }
  }

  private async download(request: BatchRequest): Promise<BatchResponse> {
    const objects: ResponseObject[] = []

    for (const item of request.objects) {
      const oid = item.oid
      const size = item.size
      try {
        const metadata = await this.s3.getObjectAttributes({
          Key: oid,
          Bucket: this.config.bucket,
          ObjectAttributes: [ObjectAttributes.OBJECT_SIZE],
        })

        if (metadata.ObjectSize != size) {
          objects.push({
            oid: oid,
            size: metadata.ObjectSize ?? 0,
            error: {
              code: 422,
              message: 'Object size mismatch',
            },
          })
        }
        else {
          const command: GetObjectCommand = new GetObjectCommand({
            Key: oid,
            Bucket: this.config.bucket,
          })
          const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 })

          objects.push({
            oid: oid,
            size: size,
            authenticated: true,
            actions: {
              download: {
                href: url,
                expires_in: 3600,
              },
            },
          })
        }
      }
      catch (e) {
        if (NoSuchKey.isInstance(e)) {
          objects.push({
            oid: oid,
            size: size,
            error: {
              code: 404,
              message: 'No such key found',
            },
          })
        }
        else {
          throw e
        }
      }
    }

    return {
      transfer: 'basic',
      objects,
      hash_algo: 'sha256',
    }
  }

  private async upload(request: BatchRequest): Promise<BatchResponse> {
    const objects: ResponseObject[] = []

    for (const item of request.objects) {
      const oid = item.oid
      const size = item.size
      const command: PutObjectCommand = new PutObjectCommand({
        Key: oid,
        Bucket: this.config.bucket,
        StorageClass: 'INTELLIGENT_TIERING',
        ContentLength: size,
        ChecksumSHA256: oid,
      })
      const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 })

      objects.push({
        oid: oid,
        size: size,
        authenticated: true,
        actions: {
          upload: {
            href: url,
            expires_in: 3600,
          },
        },
      })
    }

    return {
      transfer: 'basic',
      objects,
      hash_algo: 'sha256',
    }
  }
}
