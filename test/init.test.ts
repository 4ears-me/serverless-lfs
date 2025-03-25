/* eslint-disable @typescript-eslint/no-unused-expressions */
import {
  AppConfigDataClient,
  GetLatestConfigurationCommand,
  StartConfigurationSessionCommand,
} from '@aws-sdk/client-appconfigdata'
import { mockClient } from 'aws-sdk-client-mock'
import { Uint8ArrayBlobAdapter } from '@smithy/util-stream'
import { ConfigValue, loadConfig } from '../functions/config'
import { expect, test } from 'vitest'
import { batchHandler } from '../functions/batch'
import { verifyHandler } from '../functions/auth-token'
import { clearCaches } from '@aws-lambda-powertools/parameters'

test('test config', async () => {
  const config: ConfigValue = {
    emailClaim: 'userid',
    bucket: 'bucket-name',
    publicRead: false,
    publicWrite: false,
    userInfoEndpoint: 'http://localhost:8080',
  }

  const appConfigMock = mockClient(AppConfigDataClient)
  appConfigMock.reset()
  appConfigMock.on(StartConfigurationSessionCommand).resolves({
    InitialConfigurationToken: 'foo',
  })
  appConfigMock.on(GetLatestConfigurationCommand).resolves({
    Configuration: Uint8ArrayBlobAdapter.fromString(JSON.stringify(config)),
  })

  clearCaches()
  const loaded = await loadConfig()
  expect(loaded).toStrictEqual(config)
})

test('test batch handler', () => {
  expect(batchHandler).not.undefined
})

test('test auth handler', () => {
  expect(verifyHandler).not.undefined
})
