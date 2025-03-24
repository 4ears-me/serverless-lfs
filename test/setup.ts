import { allCustomMatcher } from 'aws-sdk-client-mock-vitest'
import { afterEach, expect, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import { clearCaches } from '@aws-lambda-powertools/parameters'

expect.extend(allCustomMatcher)

const fetchMocker = createFetchMock(vi)
fetchMocker.enableMocks()

afterEach(() => {
  fetchMock.resetMocks()
  clearCaches()
  vi.clearAllMocks()
})
