import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const port = process.env.KUUKI_NEXT_PORT ?? '8800'

// Deliberately separate from the functional suite: this seeds 531 flights and
// produces local measurements rather than a pass/fail performance budget.
export default defineConfig({
  testDir: '.', testMatch: '**/*.bench.ts', workers: 1, fullyParallel: false,
  timeout: 10 * 60_000, expect: { timeout: 30_000 }, reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 390, height: 844 }, actionTimeout: 30_000, navigationTimeout: 30_000 },
  webServer: {
    command: 'pnpm next:preview', cwd: root,
    wait: { stdout: /Next synthetic fixture ready:/ }, timeout: 120_000,
    reuseExistingServer: false,
    env: { KUUKI_NEXT_PORT: port, WRANGLER_SEND_METRICS: 'false' },
  },
})
