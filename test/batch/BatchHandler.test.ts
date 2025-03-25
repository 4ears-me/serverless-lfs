import {
  APIGatewayEventRequestContextLambdaAuthorizer,
  APIGatewayEventRequestContextV2WithAuthorizer,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda'
import { expect, test } from 'vitest'
import { ConfigValue } from '../../functions/config'
import { BatchHandler } from '../../functions/batch/BatchHandler'
import { mockClient } from 'aws-sdk-client-mock'
import { GetObjectAttributesCommand, NoSuchKey, S3, StorageClass } from '@aws-sdk/client-s3'
import { BatchError, BatchRequest, BatchResponse } from '../../functions/batch/api-types'
import { TokenContext } from '../../functions/auth/TokenValidator'

const context: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionVersion: '$LATEST',
  functionName: 'foo-bar-function',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/foo-bar-function-123456abcdef',
  logStreamName: '2021/03/09/[$LATEST]abcdef123456abcdef123456abcdef123456',
  invokedFunctionArn:
      'arn:aws:lambda:us-west-2:123456789012:function:foo-bar-function',
  awsRequestId: 'c6af9ac6-7b61-11e6-9a41-93e812345678',
  getRemainingTimeInMillis: () => 1234,
  done: () => {
    console.log('Done!')
  },
  fail: () => {
    console.log('Failed!')
  },
  succeed: () => {
    console.log('Succeeded!')
  },
} satisfies Context

function basicApiContext(): APIGatewayEventRequestContextV2WithAuthorizer<APIGatewayEventRequestContextLambdaAuthorizer<TokenContext>> {
  return {
    requestId: '0123456789',
    apiId: '0123456789',
    accountId: '',
    domainName: '',
    http: {
      path: '',
      method: 'POST',
      protocol: 'https',
      sourceIp: '127.0.0.1',
      userAgent: 'none',
    },
    domainPrefix: '',
    routeKey: '',
    stage: '',
    time: '',
    timeEpoch: 0,
    authorizer: {
      lambda: {
        tokenProvided: false,
        tokenValid: false,
      },
    },
  }
}

test('test no body', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: true,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).resolves({
    ObjectSize: 5000,
    StorageClass: StorageClass.INTELLIGENT_TIERING,
  })

  const result = await handler.handler({
    requestContext: basicApiContext(),
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(400)
})

test('test simple public download', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: true,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).resolves({
    ObjectSize: 5000,
    StorageClass: StorageClass.INTELLIGENT_TIERING,
  })

  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'download',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: basicApiContext(),
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(200)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchResponse
  expect(bodyObj.hash_algo).eq('sha256')
  expect(bodyObj.transfer).eq('basic')
  const objs = bodyObj.objects
  expect(objs.length).eq(1)
  expect(objs[0].oid).eq('1234567')
  expect(objs[0].size).eq(5000)
  expect(objs[0].actions?.upload).toBeUndefined()

  const action = objs[0].actions?.download
  expect(action).not.toBeUndefined()
  expect(action?.href).not.toBeUndefined()
  expect(action?.href).matches(new RegExp('https://.*amazonaws.com/.*'))
  expect(action?.expires_in).eq(3600)
})

test('test forbidden public download', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: false,
    bucket: 'bucket-name',
  }

  const handler = new BatchHandler(new S3(), config)

  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'download',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: basicApiContext(),
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(401)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchError
  expect(bodyObj.message).not.toBeUndefined()
  expect(bodyObj.request_id).not.toBeUndefined()
})

test('test simple authenticated download', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: false,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).resolves({
    ObjectSize: 5000,
    StorageClass: StorageClass.INTELLIGENT_TIERING,
  })

  const apiContext = basicApiContext()
  apiContext.authorizer.lambda.tokenValid = true
  apiContext.authorizer.lambda.tokenProvided = true
  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'download',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: apiContext,
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(200)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchResponse
  expect(bodyObj.hash_algo).eq('sha256')
  expect(bodyObj.transfer).eq('basic')
  const objs = bodyObj.objects
  expect(objs.length).eq(1)
  expect(objs[0].oid).eq('1234567')
  expect(objs[0].size).eq(5000)
  expect(objs[0].actions?.upload).toBeUndefined()

  const action = objs[0].actions?.download
  expect(action).not.toBeUndefined()
  expect(action?.href).not.toBeUndefined()
  expect(action?.href).matches(new RegExp('https://.*amazonaws.com/.*'))
  expect(action?.expires_in).eq(3600)
})

test('test simple unauthenticated download', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: false,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).resolves({
    ObjectSize: 5000,
    StorageClass: StorageClass.INTELLIGENT_TIERING,
  })

  const apiContext = basicApiContext()
  apiContext.authorizer.lambda.tokenValid = false
  apiContext.authorizer.lambda.tokenProvided = true
  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'download',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: apiContext,
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(401)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchError
  expect(bodyObj.message).not.toBeUndefined()
  expect(bodyObj.request_id).not.toBeUndefined()
})

test('test no object', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: false,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).rejects(new NoSuchKey({ $metadata: {}, message: '' }))

  const apiContext = basicApiContext()
  apiContext.authorizer.lambda.tokenValid = true
  apiContext.authorizer.lambda.tokenProvided = true
  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'download',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: apiContext,
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(200)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchResponse
  expect(bodyObj.hash_algo).eq('sha256')
  expect(bodyObj.transfer).eq('basic')
  const objs = bodyObj.objects
  expect(objs.length).eq(1)
  expect(objs[0].oid).eq('1234567')
  expect(objs[0].size).eq(5000)
  expect(objs[0].error).not.toBeUndefined()
  expect(objs[0].actions).toBeUndefined()

  const error = objs[0].error
  expect(error?.message).not.toBeUndefined()
  expect(error?.code).eq(404)
})

test('test mismatched sizes', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: false,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).resolves({
    ObjectSize: 5000,
    StorageClass: StorageClass.INTELLIGENT_TIERING,
  })

  const apiContext = basicApiContext()
  apiContext.authorizer.lambda.tokenValid = true
  apiContext.authorizer.lambda.tokenProvided = true
  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5001,
      }],
      operation: 'download',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: apiContext,
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(200)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchResponse
  expect(bodyObj.hash_algo).eq('sha256')
  expect(bodyObj.transfer).eq('basic')
  const objs = bodyObj.objects
  expect(objs.length).eq(1)
  expect(objs[0].oid).eq('1234567')
  expect(objs[0].size).eq(5000)
  expect(objs[0].error).not.toBeUndefined()
  expect(objs[0].actions).toBeUndefined()

  const error = objs[0].error
  expect(error?.message).not.toBeUndefined()
  expect(error?.code).eq(422)
})

test('test simple public upload', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: true,
    publicRead: true,
    bucket: 'bucket-name',
  }

  const handler = new BatchHandler(new S3(), config)

  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'upload',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: basicApiContext(),
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(200)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchResponse
  expect(bodyObj.hash_algo).eq('sha256')
  expect(bodyObj.transfer).eq('basic')
  const objs = bodyObj.objects
  expect(objs.length).eq(1)
  expect(objs[0].oid).eq('1234567')
  expect(objs[0].size).eq(5000)
  expect(objs[0].actions?.download).toBeUndefined()

  const action = objs[0].actions?.upload
  expect(action).not.toBeUndefined()
  expect(action?.href).not.toBeUndefined()
  expect(action?.href).matches(new RegExp('https://.*amazonaws.com/.*'))
  expect(action?.expires_in).eq(3600)
})

test('test forbidden public upload', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: true,
    bucket: 'bucket-name',
  }

  const handler = new BatchHandler(new S3(), config)

  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'upload',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: basicApiContext(),
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(401)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchError
  expect(bodyObj.request_id).not.toBeUndefined()
  expect(bodyObj.message).not.toBeUndefined()
})

test('test simple authenticated upload', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: false,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).resolves({
    ObjectSize: 5000,
    StorageClass: StorageClass.INTELLIGENT_TIERING,
  })

  const apiContext = basicApiContext()
  apiContext.authorizer.lambda.tokenValid = true
  apiContext.authorizer.lambda.tokenProvided = true
  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'upload',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: apiContext,
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(200)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchResponse
  expect(bodyObj.hash_algo).eq('sha256')
  expect(bodyObj.transfer).eq('basic')
  const objs = bodyObj.objects
  expect(objs.length).eq(1)
  expect(objs[0].oid).eq('1234567')
  expect(objs[0].size).eq(5000)
  expect(objs[0].actions?.download).toBeUndefined()

  const action = objs[0].actions?.upload
  expect(action).not.toBeUndefined()
  expect(action?.href).not.toBeUndefined()
  expect(action?.href).matches(new RegExp('https://.*amazonaws.com/.*'))
  expect(action?.expires_in).eq(3600)
})

test('test simple unauthenticated download', async () => {
  const config: ConfigValue = {
    userInfoEndpoint: 'does not matter',
    publicWrite: false,
    publicRead: false,
    bucket: 'bucket-name',
  }

  const s3 = mockClient(S3)

  const handler = new BatchHandler(new S3(), config)

  s3.on(GetObjectAttributesCommand).resolves({
    ObjectSize: 5000,
    StorageClass: StorageClass.INTELLIGENT_TIERING,
  })

  const apiContext = basicApiContext()
  apiContext.authorizer.lambda.tokenValid = false
  apiContext.authorizer.lambda.tokenProvided = true
  const result = await handler.handler({
    body: JSON.stringify({
      hash_algo: 'sha256',
      objects: [{
        oid: '1234567',
        size: 5000,
      }],
      operation: 'upload',
      transfers: ['basic'],
    } satisfies BatchRequest),
    requestContext: apiContext,
    version: '1.0',
    routeKey: 'route',
    headers: {},
    cookies: [],
    isBase64Encoded: false,
    rawPath: '',
    pathParameters: {},
    queryStringParameters: {},
    stageVariables: {},
    rawQueryString: '',
  }, context) as APIGatewayProxyStructuredResultV2

  expect(result).not.toBeUndefined()
  expect(result.statusCode).eq(401)

  const headers = result.headers
  expect(headers).not.toBeUndefined()
  expect(headers?.['Content-Type']).eq('application/vnd.git-lfs+json')

  const body = result.body
  expect(body).not.toBeUndefined()

  const bodyObj = JSON.parse(body ?? '{}') as BatchError
  expect(bodyObj.message).not.toBeUndefined()
  expect(bodyObj.request_id).not.toBeUndefined()
})
