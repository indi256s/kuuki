import { expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const tsx = createRequire(import.meta.url).resolve('tsx/cli')
it.each([
  [[], 'fixture-key', 'PROVIDER_OPT_IN_REQUIRED'],
  [['--real-provider'], '', 'PROVIDER_CREDENTIALS_REQUIRED'],
] as const)('requires an independent flag and credential (%s)', (flags, key, code) => {
  const result = spawnSync(process.execPath, [tsx, 'scripts/verify-import-provider.ts', ...flags], {
    env: { ...process.env, GEMINI_API_KEY: key }, encoding: 'utf8', timeout: 3_000,
  })
  expect(result.status).toBe(1)
  expect(JSON.parse(result.stderr.trim())).toMatchObject({ event: 'import_streaming_capability_failed', code })
  expect(result.stdout).toBe('')
})
