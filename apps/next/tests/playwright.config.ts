import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const port = process.env.KUUKI_NEXT_PORT ?? '8800'
export default defineConfig({
  testDir: '.', testMatch: '**/*.test.ts', fullyParallel: false, workers: 1,
  timeout: 30_000, expect: { timeout: 10_000 },
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  reporter: 'list',
  webServer: {
    command: 'pnpm next:preview', cwd: root,
    wait: { stdout: /Next synthetic fixture ready:/ },
    timeout: 120_000, reuseExistingServer: false,
    env: { KUUKI_NEXT_PORT: port, KUUKI_NEXT_FIXTURE: 'minimal', WRANGLER_SEND_METRICS: 'false' },
  },
})
