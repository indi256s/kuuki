import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const app = join(root, 'apps/next')

test('Oxlint preserves design checks, test exemptions and intentional suppressions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kuuki-oxlint-design-'))
  try {
    const require = createRequire(join(app, 'package.json'))
    const config = JSON.parse(readFileSync(join(app, '.oxlintrc.json'), 'utf8'))
    config.jsPlugins = config.jsPlugins.map((plugin) =>
      typeof plugin === 'string'
        ? require.resolve(plugin)
        : { ...plugin, specifier: require.resolve(plugin.specifier) },
    )
    writeFileSync(join(directory, '.oxlintrc.json'), JSON.stringify(config))
    mkdirSync(join(directory, 'src'))
    const fixtures = {
      'bad.tsx':
        'export const values = ["#fff", `color: oklch(0.5 0 0)`, "transition-all", `transition: all 1s`]',
      'good.tsx':
        'export const values = ["var(--ink)", "#main", "https://example.com/#fff", "#fff-label", "transition: opacity 1s"]',
      'exempt.test.tsx': 'export const values = ["#fff", "transition-all"]',
      'suppressed.tsx':
        '// oxlint-disable-next-line kuuki/design-tokens -- fixture for intentional data colors\nexport const values = ["#fff", "transition-all"]',
    }
    for (const [name, content] of Object.entries(fixtures))
      writeFileSync(join(directory, 'src', name), content)
    const result = spawnSync(
      join(root, 'node_modules/.bin/oxlint'),
      ['--format', 'json', ...Object.keys(fixtures).map((name) => join('src', name))],
      { cwd: directory, encoding: 'utf8' },
    )
    assert.equal(result.status, 1, result.stderr || result.stdout)
    const { diagnostics } = JSON.parse(result.stdout)
    assert.equal(diagnostics.length, 4, result.stdout)
    for (const diagnostic of diagnostics) {
      assert.equal(diagnostic.code, 'kuuki(design-tokens)')
      assert.ok(diagnostic.filename.endsWith('/bad.tsx'), diagnostic.filename)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
