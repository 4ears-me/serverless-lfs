import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coverageThreshold: {
    global: {
      branches: 90,
      lines: 90,
      statements: 90,
    },
  },
  coverageProvider: 'v8',
  collectCoverage: true,
  clearMocks: true,
  collectCoverageFrom: ['<rootDir>/functions/**/*.ts'],
}

export default config
