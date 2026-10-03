/** Explicit-target read-only Wrangler D1 adapter. No caller-provided SQL CLI option. */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface MigrationReader {
  read(sql: string): Promise<Record<string, unknown>[]>
}

export function assertRemoteIds(accountId: string, databaseId: string): void {
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-f0-9-]{36}$/i.test(databaseId)) {
    throw new Error('Explicit Cloudflare account/database IDs are malformed')
  }
}

export function openRemoteReader(accountId: string, databaseId: string): MigrationReader & { dispose(): void } {
  assertRemoteIds(accountId, databaseId)
  const directory = mkdtempSync(join(tmpdir(), 'kuuki-remote-read-'))
  const config = join(directory, 'wrangler.toml')
  writeFileSync(config, `name = "migration-read"
account_id = "${accountId}"
compatibility_date = "2026-01-01"
[[d1_databases]]
binding = "DB"
database_name = "migration-target"
database_id = "${databaseId}"
`, { mode: 0o600 })
  return {
    async read(sql) {
      // These are fixed internal SELECT/PRAGMA templates, not an external query API.
      if (!/^\s*(SELECT|PRAGMA)\b/i.test(sql) || /;|--|\/\*|\*\/|\0/.test(sql) ||
          /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|REPLACE|VACUUM)\b/i.test(sql)) {
        throw new Error('Unsafe remote query refused')
      }
      try {
        const stdout = execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB',
          '--remote', '--config', config, '--command', sql, '--json'], {
          cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
          maxBuffer: 16 * 1024 * 1024,
        })
        const parsed = JSON.parse(stdout) as unknown
        const result = Array.isArray(parsed) ? parsed[0] : parsed
        if (!result || typeof result !== 'object' || !Array.isArray((result as { results?: unknown }).results)) {
          throw new Error('Malformed Wrangler result')
        }
        return (result as { results: Record<string, unknown>[] }).results
      } catch {
        throw new Error('Remote read failed; verify Wrangler authentication and explicit target IDs')
      }
    },
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  }
}
