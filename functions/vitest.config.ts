import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['functions/**/*.test.ts', 'scripts/migration.test.ts'],
    fileParallelism: false,
  },
})
