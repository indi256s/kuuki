import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'functions/**/*.test.ts',
      'scripts/migration-target.test.ts',
      'packages/shared/src/**/*.test.ts',
      'packages/data/src/**/*.test.ts',
    ],
    // Each test boots Miniflare D1 and replays migrations; 5 s is too tight on a loaded machine or CI runner.
    testTimeout: 30_000,
  },
})
