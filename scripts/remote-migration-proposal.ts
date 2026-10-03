/** Read-only remote D1 inventory. Never accepts caller SQL or runs a mutation. */
import { readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSourceForeignKeyClosure, buildImportTables, sameProjectedRow, type ImportManifest } from './sb-to-d1'
import { assessSchemaAdmission, expectedSchemaRows } from './migration-target'
import { openRemoteReader } from './migration-remote-reader'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA_SQL = `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`
type Bind = string | number | null
interface MissingTable { table: string; columns: string[]; rows: Bind[][] }

function sqlIdentifier(value: string): string {
  if (!/^[a-z_][a-z_0-9]*$/i.test(value)) throw new Error('Unsafe SQL identifier')
  return `"${value}"`
}

function sqlLiteral(value: Bind): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Nonfinite SQL value')
    return String(value)
  }
  if (value.includes('\0')) throw new Error('NUL in SQL artifact value')
  return `'${value.replaceAll("'", "''")}'`
}

/** Deterministic, data-bearing draft; every INSERT is ordinary missing-only SQL. */
export function renderMissingSql(tables: MissingTable[], metadata: {
  accountId: string; databaseId: string; observedSchemaSha256: string; manifest: ImportManifest
}): string {
  const header = [
    '-- PRIVATE MIGRATION DRAFT: contains source user data; keep mode 0600.',
    '-- Source freshness: NOT VERIFIED. Remote state can change after this read-only inventory.',
    '-- Recheck source, backup, schema, natural keys, and target immediately before approved application.',
    `-- Account ${metadata.accountId}; D1 database ${metadata.databaseId}`,
    `-- Target schema SHA-256 ${metadata.observedSchemaSha256}`,
    `-- Source snapshot SHA-256 ${metadata.manifest.sourceSnapshotSha256}`,
    `-- Projected reference rows SHA-256 ${metadata.manifest.referenceSourceSha256}`,
    `-- OurAirports provenance SHA-256 ${metadata.manifest.referenceDatasetSha256}`,
    '',
  ]
  const statements: string[] = []
  for (const table of tables) {
    const names = table.columns.map(sqlIdentifier).join(', ')
    for (const row of table.rows) {
      if (row.length !== table.columns.length) throw new Error(`SQL artifact arity mismatch: ${table.table}`)
      statements.push(`INSERT INTO ${sqlIdentifier(table.table)} (${names}) VALUES (${row.map(sqlLiteral).join(', ')});`)
    }
  }
  return [...header, ...statements, ''].join('\n')
}

function privateOutputPath(raw: string): string {
  if (!isAbsolute(raw)) throw new Error('--output-sql must be an absolute path')
  const path = resolve(raw)
  const parent = realpathSync(dirname(path))
  const allowed = [realpathSync(tmpdir()), realpathSync(join(ROOT, 'db', '_snapshot'))]
  if (!allowed.some((base) => parent === base || parent.startsWith(base + sep))) {
    throw new Error('--output-sql must be inside the temporary directory or gitignored db/_snapshot')
  }
  return path
}

function arg(argv: string[], name: string): string {
  const at = argv.indexOf(name)
  if (at < 0 || !argv[at + 1] || argv[at + 1].startsWith('--')) throw new Error(`Required: ${name}`)
  return argv[at + 1]
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const accountId = arg(argv, '--account-id')
  const databaseId = arg(argv, '--database-id')
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-f0-9-]{36}$/i.test(databaseId)) {
    throw new Error('Explicit Cloudflare account/database IDs are malformed')
  }
  const sourceIndex = argv.indexOf('--snapshot-dir')
  const snapshotDir = sourceIndex < 0 ? join(ROOT, 'db', '_snapshot') : resolve(argv[sourceIndex + 1])
  const outputIndex = argv.indexOf('--output-sql')
  const outputPath = outputIndex < 0 ? null : privateOutputPath(arg(argv, '--output-sql'))
  const admissionIndex = argv.indexOf('--schema-admission')
  const admissionPath = admissionIndex < 0 ? undefined : privateOutputPath(arg(argv, '--schema-admission'))
  const { tables, manifest } = buildImportTables(snapshotDir)
  const reader = openRemoteReader(accountId, databaseId)
  try {
    const schemaRows = await reader.read(SCHEMA_SQL)
    const admission = assessSchemaAdmission(schemaRows, await expectedSchemaRows(),
      { accountId, databaseId }, admissionPath)
    const observedSchemaSha256 = admission.observedSha256
    const expected = admission.expectedSha256
    const presentTables = new Set(schemaRows.filter((r) => r.type === 'table').map((r) => String(r.name)))
    const missingTables = tables.filter((t) => !presentTables.has(t.table)).map((t) => t.table)
    if (!admission.admitted) {
      const counts: Record<string, number> = {}
      for (const table of tables) {
        if (!presentTables.has(table.table)) continue
        counts[table.table] = Number((await reader.read(`SELECT COUNT(*) AS n FROM ${table.table}`))[0]?.n ?? -1)
      }
      console.log(JSON.stringify({ mode: 'read-only-remote-proposal', accountId, databaseId,
        observedSchemaSha256, expectedSchemaSha256: expected, schemaReady: false,
        schemaAdmissionReason: admission.reason,
        missingTables, existingCounts: counts, conflictsReviewed: false,
        additiveReady: false,
        artifactWritten: false, artifactRefusedReason: outputPath ? 'schema-not-ready' : undefined,
        sourceSnapshotSha256: manifest.sourceSnapshotSha256,
        next: 'Apply/review schema separately; rerun read-only inventory before any import' }, null, 2))
      return
    }
    const repairedUsers = new Set((await reader.read(
      'SELECT user_id FROM user_derived_state WHERE revision = published_revision AND revision > 0',
    )).map((row) => String(row.user_id)))
    const inventory: Record<string, { existing: number; identical: number; missing: number; divergent: number }> = {}
    const identityRows = new Map<string, Record<string, unknown>[]>()
    const missingTablesForSql: MissingTable[] = []
    for (const table of tables) {
      if (!presentTables.has(table.table)) continue
      const rows = await reader.read(`SELECT ${table.columns.join(', ')} FROM ${table.table}`)
      if (table.table === 'users' || table.table === 'profiles' || table.table === 'badge_definitions') identityRows.set(table.table, rows)
      const byKey = new Map(rows.map((row) => [String(row[table.key]), row]))
      const keyIndex = table.columns.indexOf(table.key)
      let identical = 0
      let divergent = 0
      const sourceKeys = new Set<string>()
      const missingRows: Bind[][] = []
      for (const values of table.rows) {
        const key = String(values[keyIndex])
        if (sourceKeys.has(key)) throw new Error(`Duplicate source key: ${table.table}`)
        sourceKeys.add(key)
        const found = byKey.get(key)
        if (!found) { missingRows.push(values); continue }
        if (sameProjectedRow(table, found, values, repairedUsers.has(String(values[keyIndex])))) identical++
        else divergent++
      }
      missingTablesForSql.push({ table: table.table, columns: table.columns, rows: missingRows })
      inventory[table.table] = { existing: rows.length, identical, missing: table.rows.length - identical - divergent, divergent }
    }
    let identityCollisions = 0
    for (const table of tables) {
      if (!['users', 'profiles', 'badge_definitions'].includes(table.table)) continue
      const existing = identityRows.get(table.table) ?? []
      const natural = table.table === 'users' ? 'email' : table.table === 'profiles' ? 'username' : 'code'
      const index = table.columns.indexOf(natural)
      const keyIndex = table.columns.indexOf(table.key)
      const seen = new Set<string>()
      for (const values of table.rows) {
        if (values[index] == null) continue
        const normalized = String(values[index]).toLowerCase()
        if (seen.has(normalized)) identityCollisions++
        seen.add(normalized)
        if (existing.some((row) => String(row[table.key]) !== String(values[keyIndex]) &&
          String(row[natural] ?? '').toLowerCase() === normalized)) identityCollisions++
      }
    }
    const unresolvedConflicts = identityCollisions + Object.values(inventory).reduce((n, t) => n + t.divergent, 0)
    const sourceVisits = JSON.parse(readFileSync(join(snapshotDir, 'visits.json'), 'utf8')) as Array<{ user_id: string }>
    assertSourceForeignKeyClosure(tables, sourceVisits,
      (identityRows.get('users') ?? []).map((row) => String(row.id)),
      (identityRows.get('badge_definitions') ?? []).map((row) => Number(row.id)))
    const fkBefore = await reader.read('PRAGMA foreign_key_check')
    if (fkBefore.length) throw new Error('Target foreign-key violations before artifact')
    const expectedUnionCounts = Object.fromEntries(Object.entries(inventory).map(([name, item]) =>
      [name, item.existing + item.missing]))
    if (outputPath && unresolvedConflicts === 0) {
      const sql = renderMissingSql(missingTablesForSql, { accountId, databaseId,
        observedSchemaSha256, manifest })
      writeFileSync(outputPath, sql, { flag: 'wx', mode: 0o600 })
      try {
        writeFileSync(`${outputPath}.manifest.json`, JSON.stringify({ ...manifest,
          expectedUnionCounts, target: 'remote', accountId, databaseId,
          schemaSha256: observedSchemaSha256, expectedFreshSchemaSha256: expected,
          schemaAdmissionPath: admissionPath ?? null, sourceFreshnessVerified: false,
        }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
      } catch (error) {
        rmSync(outputPath, { force: true })
        throw error
      }
    }
    console.log(JSON.stringify({ mode: 'read-only-remote-proposal', accountId, databaseId,
      observedSchemaSha256, expectedSchemaSha256: expected, schemaReady: true,
      schemaAdmission: observedSchemaSha256 === expected ? 'fresh-exact' : 'operator-reviewed',
      missingTables, identityCollisions, unresolvedConflicts, conflictsReviewed: true,
      additiveReady: unresolvedConflicts === 0,
      freshSourceVerified: false, sourceSnapshotSha256: manifest.sourceSnapshotSha256,
      artifactWritten: Boolean(outputPath && unresolvedConflicts === 0),
      artifactPath: outputPath && unresolvedConflicts === 0 ? outputPath : undefined,
      artifactManifestPath: outputPath && unresolvedConflicts === 0 ? `${outputPath}.manifest.json` : undefined,
      artifactRefusedReason: outputPath && unresolvedConflicts ? 'unresolved-conflicts' : undefined,
      sourceRows: manifest.tableRows, inventory, next: 'No remote writes performed; separately approve and apply migrations/import' }, null, 2))
  } finally {
    reader.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error((error as Error).message); process.exitCode = 1 })
}
