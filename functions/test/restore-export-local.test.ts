import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Miniflare } from 'miniflare'
import { expect, it, vi } from 'vitest'
import { main } from '../../scripts/restore-export-local'
import { applyMigrations, migrationFiles } from '../../scripts/_migrations'
import { ROOT } from '../../scripts/_cli'

it('restores a private export in chunks, preserves historical rows and applies only migrations after its ledger', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kuuki-restore-test-'))
  const source = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("source") } }',
    d1Databases: { DB: 'restore-source' },
  })
  let target: Miniflare | undefined
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    const db = await source.getD1Database('DB')
    await applyMigrations(db, { through: '0007' })
    const schema = (
      await db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name",
        )
        .all<{ sql: string }>()
    ).results
    const sql = [
      'PRAGMA foreign_keys=OFF;',
      'BEGIN TRANSACTION;',
      ...schema.map((r) => r.sql + ';'),
      'CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);',
      ...migrationFiles()
        .filter((f) => f.slice(0, 4) <= '0007')
        .map((f, i) => `INSERT INTO d1_migrations(id,name) VALUES (${i + 1},'${f}');`),
      "INSERT INTO users(id,email,password_hash) VALUES ('historical','synthetic@synthetic.test','sentinel');",
      "INSERT INTO profiles(id,display_name) VALUES ('historical','sqlite_sequence is ordinary text');",
      "INSERT INTO badge_definitions(id,code,name,criteria) VALUES (97,'historic','Historic','{}');",
      "INSERT INTO user_badges(user_id,badge_id,earned_at) VALUES ('historical',97,'2020-01-01');",
      ...Array.from(
        { length: 205 },
        (_, i) =>
          `INSERT INTO flights(id,user_id,date,origin,destination,distance_km,duration_minutes,is_upcoming) VALUES (${i + 1},'historical','2025-01-01','TBS','JFK',9878,611,0);`,
      ),
      'DELETE FROM sqlite_sequence;',
      "INSERT INTO sqlite_sequence(name,seq) VALUES ('flights',205);",
      'COMMIT;',
    ].join('\n')
    const exportPath = join(dir, 'export.sql')
    writeFileSync(exportPath, sql, { mode: 0o600 })
    const args = [
      '--sql',
      exportPath,
      '--database-id',
      'restore-target',
      '--persist',
      join(dir, 'd1'),
    ]
    await main(args)
    target = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("target") } }',
      d1Databases: { DB: 'restore-target' },
      d1Persist: join(dir, 'd1'),
    })
    const restored = await target.getD1Database('DB')
    expect(
      await restored
        .prepare(
          'SELECT COUNT(*) AS n,MIN(distance_km) AS km,MIN(duration_minutes) AS minutes,MAX(duration_source) AS source FROM flights',
        )
        .first(),
    ).toEqual({ n: 205, km: 9878, minutes: 611, source: null })
    expect(
      await restored.prepare('SELECT display_name,overview_prefs FROM profiles').first(),
    ).toEqual({ display_name: 'sqlite_sequence is ordinary text', overview_prefs: null })
    expect((await restored.prepare('SELECT * FROM user_badges').all()).results).toEqual([
      { id: 1, user_id: 'historical', badge_id: 97, earned_at: '2020-01-01' },
    ])
    expect((await restored.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      lastExportMigration: '0007_import_drafts.sql',
      migrationsApplied: ['0008_flight_metrics.sql', '0009_schedule_time_provenance.sql'],
    })
    expect(readFileSync(exportPath, 'utf8')).toBe(sql)
    await target.dispose()
    target = undefined
    await expect(main(args)).rejects.toThrow(/empty/)
    target = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("target") } }',
      d1Databases: { DB: 'restore-target' },
      d1Persist: join(dir, 'd1'),
    })
    const reopened = await target.getD1Database('DB')
    expect(await reopened.prepare('SELECT COUNT(*) AS n FROM flights').first()).toEqual({ n: 205 })
  } finally {
    log.mockRestore()
    await source.dispose()
    await target?.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

it('refuses an unknown export ledger before applying application migrations', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kuuki-restore-ledger-'))
  let target: Miniflare | undefined
  try {
    const path = join(dir, 'unknown.sql')
    writeFileSync(
      path,
      "CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT); INSERT INTO d1_migrations VALUES (1,'9999_unknown.sql');",
      { mode: 0o600 },
    )
    await expect(
      main(['--sql', path, '--database-id', 'restore-target', '--persist', join(dir, 'd1')]),
    ).rejects.toThrow(/known ordered prefix/)
    target = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("target") } }',
      d1Databases: { DB: 'restore-target' },
      d1Persist: join(dir, 'd1'),
    })
    const db = await target.getD1Database('DB')
    expect(
      (await db.prepare("SELECT name FROM sqlite_master WHERE name='flights'").all()).results,
    ).toEqual([])
  } finally {
    await target?.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

it('does not mistake an ordinary existing table for a reserved D1 internal table', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kuuki-restore-existing-'))
  let target: Miniflare | undefined = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("target") } }',
    d1Databases: { DB: 'restore-target' },
    d1Persist: join(dir, 'd1'),
  })
  try {
    const db = await target.getD1Database('DB')
    await db.prepare('CREATE TABLE xcf_legacy(value TEXT)').run()
    await target.dispose()
    target = undefined
    const path = join(dir, 'export.sql')
    writeFileSync(path, 'SELECT 1;', { mode: 0o600 })
    await expect(
      main(['--sql', path, '--database-id', 'restore-target', '--persist', join(dir, 'd1')]),
    ).rejects.toThrow(/empty/)
  } finally {
    await target?.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

it('refuses shared state, relative export paths and non-private exports before restoring', async () => {
  await expect(
    main([
      '--sql',
      '/tmp/export.sql',
      '--database-id',
      'restore-target',
      '--persist',
      join(ROOT, '.wrangler'),
    ]),
  ).rejects.toThrow(/shared project state/)
  const dir = mkdtempSync(join(tmpdir(), 'kuuki-restore-refusal-'))
  try {
    const base = ['--database-id', 'restore-target', '--persist', join(dir, 'd1')]
    await expect(main(['--sql', 'relative.sql', ...base])).rejects.toThrow(/absolute/)
    const path = join(dir, 'public.sql')
    writeFileSync(path, 'SELECT 1;', { mode: 0o644 })
    await expect(main(['--sql', path, ...base])).rejects.toThrow(/private/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
