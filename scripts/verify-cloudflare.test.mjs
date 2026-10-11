import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('verification propagates failure and stops before later gates', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kuuki-verification-'))
  const log = join(directory, 'commands')
  try {
    for (const command of ['pnpm', 'node', 'git']) {
      writeFileSync(
        join(directory, command),
        '#!/bin/sh\nprintf "%s\\n" "$*" >> "$VERIFY_LOG"\nif [ "$*" = "$VERIFY_FAIL" ]; then exit 17; fi\n',
        { mode: 0o755 },
      )
    }
    const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, VERIFY_LOG: log }
    const success = spawnSync('bash', ['scripts/verify-cloudflare.sh'], { env })
    assert.equal(success.status, 0)
    const all = readFileSync(log, 'utf8').trim().split('\n')
    assert.ok(all.length > 2)
    for (const failure of [all[1], all.at(-2)]) {
      writeFileSync(log, '')
      const result = spawnSync('bash', ['scripts/verify-cloudflare.sh'], {
        env: { ...env, VERIFY_FAIL: failure },
      })
      assert.equal(result.status, 17)
      assert.deepEqual(
        readFileSync(log, 'utf8').trim().split('\n'),
        all.slice(0, all.indexOf(failure) + 1),
      )
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
