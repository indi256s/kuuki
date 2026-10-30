import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Multi-step UI journeys exceed Vitest's 5s default on the native build runner.
    testTimeout: 15_000,
    // Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/**', 'node_modules/**', '.next/**', '.open-next/**'],
  },
})
