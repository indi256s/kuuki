/** Restore an approved private D1 export into an empty, isolated local namespace. */
import { readFileSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Miniflare } from 'miniflare'
import { unstable_splitSqlQuery } from 'wrangler'
import { requiredArg } from './_cli'
import { applyMigrations, migrationFiles } from './_migrations'
import { parseLocalTarget } from './migration-target'

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseLocalTarget(
    argv.includes('--target') ? argv : ['--target', 'local', ...argv],
  )
  const path = requiredArg(argv, '--sql')
  if (!isAbsolute(path)) throw new Error('--sql must be an absolute path')
  const info = statSync(path)
  if (!info.isFile() || (info.mode & 0o077) !== 0)
    throw new Error('--sql must be a private file (mode 0600)')
  const statements = unstable_splitSqlQuery(readFileSync(path, 'utf8')).filter((statement) => {
    const sql = statement.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, '')
    return (
      !/^(BEGIN|COMMIT|PRAGMA)\b/i.test(sql) &&
      !/^(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|INSERT(?:\s+OR\s+\w+)?\s+INTO|DELETE\s+FROM|UPDATE)\s+["`\[]?sqlite_sequence\b/i.test(
        sql,
      )
    )
  })
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("restore-local") } }',
    compatibilityDate: '2026-01-01',
    d1Databases: { DB: options.databaseId },
    d1Persist: options.persistPath,
  })
  try {
    const db = await mf.getD1Database('DB')
    const existing = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*'",
      )
      .first<{ n: number }>()
    if (existing!.n !== 0) throw new Error('Restore requires an empty isolated local database')
    for (let i = 0; i < statements.length; i += 200)
      await db.batch(statements.slice(i, i + 200).map((sql) => db.prepare(sql)))
    const ledger = await db
      .prepare('SELECT name FROM d1_migrations ORDER BY id')
      .all<{ name: string }>()
    const files = migrationFiles()
    const names = ledger.results.map((row) => row.name)
    if (names.length === 0 || names.some((name, i) => name !== files[i]))
      throw new Error('Export migration ledger is not a known ordered prefix')
    const last = names.at(-1)!
    const pending = files.slice(names.length)
    await applyMigrations(db, { after: last.slice(0, 4) })
    if (pending.length)
      await db.batch(
        pending.map((name) => db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(name)),
      )
    console.log(
      JSON.stringify({
        mode: 'local-export-restore',
        databaseId: options.databaseId,
        statementsRestored: statements.length,
        lastExportMigration: last,
        migrationsApplied: pending,
      }),
    )
  } finally {
    await mf.dispose()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077)
  main().catch(() => {
    console.error('Local restore failed; check private export and empty isolated target')
    process.exitCode = 1
  })
}
