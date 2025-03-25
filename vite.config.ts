import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      enabled: true,
      include: ['functions/**'],
      thresholds: {
        branches: 90,
        lines: 90,
        statements: 90,
      },
      all: true,
    },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 0,
    setupFiles: ['test/setup.ts'],
  },
})
