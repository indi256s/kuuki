import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'functions/**/*.test.ts',
      'scripts/migration-target.test.ts',
      'scripts/import-openflights.test.ts',
      'packages/shared/src/**/*.test.ts',
      'packages/data/src/**/*.test.ts',
    ],
    testTimeout: 30_000,
  },
})
