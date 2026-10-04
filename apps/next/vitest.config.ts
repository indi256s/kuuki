import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/**', 'node_modules/**', '.next/**', '.open-next/**'],
  },
})
