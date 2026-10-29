import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { freePort } from '../../../scripts/free-port'

const root = fileURLToPath(new URL('../../../', import.meta.url))
// Set once in the runner so workers, which re-read this config, inherit the same port.
process.env.KUUKI_NEXT_PORT ??= String(freePort())
const port = process.env.KUUKI_NEXT_PORT
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.test.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // Journeys start past the first-visit kuukie notice; client/kuukies.test.tsx owns it.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://127.0.0.1:${port}`,
          localStorage: [{ name: 'kuuki-kuukies', value: '1' }],
        },
      ],
    },
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  webServer: {
    command: 'pnpm next:preview',
    cwd: root,
    wait: { stdout: /Next synthetic fixture ready:/ },
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      KUUKI_NEXT_PORT: port,
      KUUKI_NEXT_FIXTURE: 'minimal',
      KUUKI_NEXT_DOCK_FIXTURE: process.env.KUUKI_NEXT_DOCK_FIXTURE ?? '0',
      WRANGLER_SEND_METRICS: 'false',
    },
  },
})
