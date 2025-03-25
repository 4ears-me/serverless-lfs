/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect, test } from 'vitest'
import { ConfigValue } from '../../functions/config'
import { TokenValidator } from '../../functions/auth/TokenValidator'
import { APIGatewayEventRequestContextV2, Context } from 'aws-lambda'

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

const apiContext: APIGatewayEventRequestContextV2 = {
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
} satisfies APIGatewayEventRequestContextV2

test('test build auth handler', () => {
  const config: ConfigValue = {
    bucket: 'bucket-name',
    userInfoEndpoint: 'http://localhost:8080/',
    publicWrite: false,
    publicRead: false,
  }

  new TokenValidator(config)
})

test('test missing user info endpoint', () => {
  // @ts-expect-error we are intentionally not providing an userinfo endpoint
  const config: ConfigValue = {
    bucket: 'bucket-name',
    publicRead: false,
    publicWrite: false,
  }

  expect(() => new TokenValidator(config)).toThrowError()
})

test('test successful auth', async () => {
  const config: ConfigValue = {
    bucket: 'bucket-name',
    publicRead: false,
    publicWrite: false,
    userInfoEndpoint: 'http://localhost:8080/',
  }

  const validator = new TokenValidator(config)

  fetchMock.mockResponse({
    status: 200,
    body: JSON.stringify({ email: 'foo@bar.com' }),
  })

  const result = await validator.handler({
    cookies: [],
    identitySource: [],
    rawPath: '',
    rawQueryString: '',
    requestContext: apiContext,
    routeArn: '',
    routeKey: '',
    type: 'REQUEST',
    version: '',
    headers: {
      Authorization: 'Bearer 12345',
    },
  }, context)

  expect(result.isAuthorized).eq(true)
  const resultContext = result.context
  expect(resultContext.email).eq('foo@bar.com')
  expect(resultContext.tokenValid).eq(true)
  expect(resultContext.tokenProvided).eq(true)
})

test('test successful auth different claim', async () => {
  const config: ConfigValue = {
    bucket: 'bucket-name',
    publicRead: false,
    publicWrite: false,
    userInfoEndpoint: 'http://localhost:8080/',
    emailClaim: 'userid',
  }

  const validator = new TokenValidator(config)

  fetchMock.mockResponse({
    status: 200,
    body: JSON.stringify({ userid: 'foo@bar.com' }),
  })

  const result = await validator.handler({
    cookies: [],
    identitySource: [],
    rawPath: '',
    rawQueryString: '',
    requestContext: apiContext,
    routeArn: '',
    routeKey: '',
    type: 'REQUEST',
    version: '',
    headers: {
      Authorization: 'Bearer 12345',
    },
  }, context)

  expect(result.isAuthorized).eq(true)
  const resultContext = result.context
  expect(resultContext.email).eq('foo@bar.com')
  expect(resultContext.tokenValid).eq(true)
  expect(resultContext.tokenProvided).eq(true)
})

test('test no token', async () => {
  const config: ConfigValue = {
    bucket: 'bucket-name',
    publicRead: false,
    publicWrite: false,
    userInfoEndpoint: 'http://localhost:8080/',
  }

  const validator = new TokenValidator(config)

  const result = await validator.handler({
    cookies: [],
    identitySource: [],
    rawPath: '',
    rawQueryString: '',
    requestContext: apiContext,
    routeArn: '',
    routeKey: '',
    type: 'REQUEST',
    version: '',
    headers: {},
  }, context)

  expect(result.isAuthorized).eq(false)
  const resultContext = result.context
  expect(resultContext.email).undefined
  expect(resultContext.tokenValid).eq(false)
  expect(resultContext.tokenProvided).eq(false)
})

test('test no token public access', async () => {
  const config: ConfigValue = {
    bucket: 'bucket-name',
    publicRead: true,
    publicWrite: false,
    userInfoEndpoint: 'http://localhost:8080/',
  }

  const validator = new TokenValidator(config)

  const result = await validator.handler({
    cookies: [],
    identitySource: [],
    rawPath: '',
    rawQueryString: '',
    requestContext: apiContext,
    routeArn: '',
    routeKey: '',
    type: 'REQUEST',
    version: '',
    headers: {},
  }, context)

  expect(result.isAuthorized).eq(true)
  const resultContext = result.context
  expect(resultContext.email).undefined
  expect(resultContext.tokenValid).eq(false)
  expect(resultContext.tokenProvided).eq(false)
})

test('test unsuccessful auth', async () => {
  const config: ConfigValue = {
    bucket: 'bucket-name',
    publicRead: false,
    publicWrite: false,
    userInfoEndpoint: 'http://localhost:8080/',
  }

  const validator = new TokenValidator(config)

  fetchMock.mockResponse({
    status: 403,
  })

  const result = await validator.handler({
    cookies: [],
    identitySource: [],
    rawPath: '',
    rawQueryString: '',
    requestContext: apiContext,
    routeArn: '',
    routeKey: '',
    type: 'REQUEST',
    version: '',
    headers: {
      Authorization: 'Bearer 12345',
    },
  }, context)

  expect(result.isAuthorized).eq(false)
  const resultContext = result.context
  expect(resultContext.email).undefined
  expect(resultContext.tokenValid).eq(false)
  expect(resultContext.tokenProvided).eq(true)
})

test('test unsuccessful auth public access', async () => {
  const config: ConfigValue = {
    bucket: 'bucket-name',
    publicRead: true,
    publicWrite: false,
    userInfoEndpoint: 'http://localhost:8080/',
  }

  const validator = new TokenValidator(config)

  fetchMock.mockResponse({
    status: 403,
  })

  const result = await validator.handler({
    cookies: [],
    identitySource: [],
    rawPath: '',
    rawQueryString: '',
    requestContext: apiContext,
    routeArn: '',
    routeKey: '',
    type: 'REQUEST',
    version: '',
    headers: {
      Authorization: 'Bearer 12345',
    },
  }, context)

  expect(result.isAuthorized).eq(true)
  const resultContext = result.context
  expect(resultContext.email).undefined
  expect(resultContext.tokenValid).eq(false)
  expect(resultContext.tokenProvided).eq(true)
})
