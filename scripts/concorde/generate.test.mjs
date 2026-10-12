import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('generates standalone previews from an empty output tree and rejects an altered kit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kuuki-concorde-'))
  const kit = resolve(process.env.ANATOMY_KIT ?? '.scratch/concorde/anatomy/kit')
  const generator = fileURLToPath(new URL('../generate-concorde.mjs', import.meta.url))
  const run = (source, ...args) =>
    spawnSync(process.execPath, [generator, ...args], {
      cwd: dir,
      env: { ...process.env, ANATOMY_KIT: source },
      encoding: 'utf8',
    })
  try {
    for (const args of [['--preview'], ['--preview', '--light']]) {
      const result = run(kit, ...args)
      assert.equal(result.status, 0, result.stderr)
      const page = readFileSync(
        join(dir, `.scratch/concorde/concorde${args.includes('--light') ? '-light' : ''}.html`),
        'utf8',
      )
      assert.ok(page.includes('<svg'), 'preview contains the generated model')
      assert.ok(!page.includes('__DATA__'), 'preview has its turn data')
    }
    const output = join(dir, 'apps/next/src/client/auth-card/concorde/concorde.generated.ts')
    const before = readFileSync(output)
    const altered = join(dir, 'altered-anatomy/kit')
    cpSync(kit, altered, { recursive: true })
    cpSync(resolve(kit, '../LICENSE'), join(dir, 'altered-anatomy/LICENSE'))
    appendFileSync(join(altered, 'iso.css'), '\n/* changed */\n')
    const rejected = run(altered)
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /iso\.css differs from pinned commit/)
    assert.deepEqual(readFileSync(output), before, 'rejection preserves generated output')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
