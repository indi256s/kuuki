import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const productionId = '11111111-1111-1111-1111-111111111111'
const previewId = '22222222-2222-2222-2222-222222222222'
const databases = `[[d1_databases]]
binding = "DB"
database_id = "${productionId}"
[[env.preview.d1_databases]]
binding = "DB"
database_id = "${previewId}"
`
const application = `${databases}[vars]
PAGES_ORIGIN = "https://kuuki.example"
[env.preview.vars]
PAGES_ORIGIN = "https://preview.kuuki.example"
ACTIVATION_ORIGIN = "https://activate.preview.kuuki.example"
`
const cache = `[[kv_namespaces]]
binding = "CACHE"
id = "11111111111111111111111111111111"
[[env.preview.kv_namespaces]]
binding = "CACHE"
id = "22222222222222222222222222222222"
`

// The CLI is the admission boundary. These fixtures exercise actual config parsing,
// including absent optional bindings and unsafe preview/production resource reuse.
for (const [name, app, cron, accepted] of [
  ['no cache is required', application, databases, true],
  ['aligned isolated optional caches', application + cache, databases + cache, true],
  ['shared D1 rejected', application.replace(previewId, productionId), databases, false],
  ['invalid preview ID rejected', application.replace(previewId, 'placeholder'), databases, false],
  [
    'missing preview rejected',
    application.replace('binding = "DB"\ndatabase_id = "' + previewId + '"', ''),
    databases,
    false,
  ],
  [
    'maintenance mismatch rejected',
    application,
    databases.replace(previewId, '33333333-3333-3333-3333-333333333333'),
    false,
  ],
  [
    'same origins rejected',
    application.replace('https://preview.kuuki.example', 'https://kuuki.example'),
    databases,
    false,
  ],
  [
    'activation shares application origin rejected',
    application.replace('https://activate.preview.kuuki.example', 'https://preview.kuuki.example'),
    databases,
    false,
  ],
  [
    'shared optional cache rejected',
    application +
      cache.replace('22222222222222222222222222222222', '11111111111111111111111111111111'),
    databases,
    false,
  ],
  [
    'maintenance cache mismatch rejected',
    application + cache,
    databases +
      cache.replace('22222222222222222222222222222222', '33333333333333333333333333333333'),
    false,
  ],
]) {
  test(name, () => {
    const directory = mkdtempSync(join(tmpdir(), 'kuuki-admission-'))
    try {
      const appPath = join(directory, 'app.toml')
      const cronPath = join(directory, 'cron.toml')
      const importPath = join(directory, 'import.toml')
      writeFileSync(appPath, app)
      writeFileSync(cronPath, cron)
      writeFileSync(importPath, databases)
      const result = spawnSync(
        process.execPath,
        [
          'scripts/check-preview-config.mjs',
          '--config',
          appPath,
          '--maintenance-config',
          cronPath,
          '--import-config',
          importPath,
        ],
        { encoding: 'utf8' },
      )
      assert.equal(result.status, accepted ? 0 : 1, result.stderr || result.stdout)
      if (!accepted) assert.ok(result.stderr.trim())
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
}
