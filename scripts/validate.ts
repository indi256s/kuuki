/** Read-only local migration validation against source, manifest, and actual D1 state. */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildImportTables, sameProjectedRow } from './sb-to-d1'
import { openLocalTarget, parseLocalTarget } from './migration-target'
import type { MigrationReader } from './migration-remote-reader'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export interface Manifest {
  target: 'local' | 'remote'
  accountId?: string
  databaseId: string
  schemaSha256: string
  sourceSnapshotSha256: string
  referenceSourceSha256: string
  referenceDatasetSha256: string
  expectedUnionCounts: Record<string, number>
  visitEvidence: { raw: number; contributing: number; derivedKeys: number; expectedUnionKeys: number }
  aircraftCorrections: { count: number; ids: number[] }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

async function validateRows(reader: MigrationReader, snapshotDir: string, manifest: Manifest): Promise<void> {
  const { tables, manifest: source } = buildImportTables(snapshotDir)
  assert(source.sourceSnapshotSha256 === manifest.sourceSnapshotSha256, 'Source files changed since import')
  assert(source.referenceSourceSha256 === manifest.referenceSourceSha256, 'Projected reference data changed since import')
  assert(source.referenceDatasetSha256 === manifest.referenceDatasetSha256, 'Reference provenance changed since import')
  assert(JSON.stringify(source.visitEvidence) === JSON.stringify(manifest.visitEvidence), 'Visit classification changed')
  assert(source.aircraftCorrections.count === manifest.aircraftCorrections.count &&
    JSON.stringify(source.aircraftCorrections.ids) === JSON.stringify(manifest.aircraftCorrections.ids),
    'Approved aircraft correction set changed')

  const repaired = new Set((await reader.read(
    'SELECT user_id FROM user_derived_state WHERE revision = published_revision AND revision > 0',
  )).map((r) => String(r.user_id)))
  const sourceUsers = new Set((tables.find((table) => table.table === 'users')?.rows ?? []).map((row) => String(row[0])))
  for (const table of tables) {
    const actual = await reader.read(`SELECT ${table.columns.join(', ')} FROM ${table.table}`)
    const byKey = new Map(actual.map((row) => [String(row[table.key]), row]))
    let missing = 0
    let changed = 0
    const keyIndex = table.columns.indexOf(table.key)
    for (const values of table.rows) {
      const key = String(values[keyIndex])
      const row = byKey.get(key)
      if (!row) missing++
      else if (!sameProjectedRow(table, row, values, repaired.has(key))) changed++
    }
    assert(missing === 0 && changed === 0, `${table.table}: ${missing} source rows missing, ${changed} changed`)
    const expected = manifest.expectedUnionCounts[table.table]
    assert(Number.isInteger(expected), `${table.table}: missing manifest union count`)
    if (table.table === 'user_stats' || table.table === 'user_advanced_stats') {
      // Repair fills missing per-user derived rows; it cannot create an unrelated user.
      assert(actual.length >= expected && actual.length <= expected + sourceUsers.size,
        `${table.table}: repaired row count outside source-user bound`)
      assert([...sourceUsers].every((id) => byKey.has(id)), `${table.table}: missing repaired source user`)
    } else if (table.table === 'user_badges') {
      // Scoped repair may award new badges; archived awards and IDs remain present.
      assert(actual.length >= expected, `${table.table}: row count fell below import baseline`)
    } else {
      assert(actual.length === expected, `${table.table}: union row count mismatch`)
    }
  }
}

async function validateVisits(reader: MigrationReader, snapshotDir: string, manifest: Manifest): Promise<void> {
  const source = JSON.parse(readFileSync(join(snapshotDir, 'flights.json'), 'utf8')) as Array<{
    user_id: string; origin: string; destination: string; date: string; is_upcoming: boolean
  }>
  const profiles = JSON.parse(readFileSync(join(snapshotDir, 'profiles.json'), 'utf8')) as Array<{ id: string }>
  const sourceIds = new Set(profiles.map((p) => p.id))
  const airports = new Set((await reader.read('SELECT iata FROM airports_reference')).map((r) => String(r.iata)))
  const expected = new Map<string, { first: string; last: string; count: number }>()
  for (const flight of source) {
    if (flight.is_upcoming) continue
    for (const code of [flight.origin, flight.destination]) {
      if (!airports.has(code)) continue
      const key = `${flight.user_id}|${code}`
      const previous = expected.get(key)
      if (previous) {
        previous.first = previous.first < flight.date ? previous.first : flight.date
        previous.last = previous.last > flight.date ? previous.last : flight.date
        previous.count++
      } else expected.set(key, {
        first: flight.date,
        last: flight.date,
        count: 1,
      })
    }
  }
  const evidence = await reader.read('SELECT user_id, airport_iata, first_visit, last_visit, visit_count, contributes FROM legacy_visit_evidence')
  assert(evidence.length >= manifest.visitEvidence.raw, 'Legacy evidence row count too small')
  let contributors = 0
  for (const row of evidence) {
    if (!sourceIds.has(String(row.user_id)) || Number(row.contributes) !== 1) continue
    contributors++
    const key = `${row.user_id}|${row.airport_iata ?? ''}`
    const prior = expected.get(key)
    const first = String(row.first_visit)
    const last = String(row.last_visit)
    const count = Number(row.visit_count)
    if (prior) {
      prior.first = prior.first < first ? prior.first : first
      prior.last = prior.last > last ? prior.last : last
      prior.count = Math.max(prior.count, count)
    } else expected.set(key, { first, last, count })
  }
  assert(contributors === manifest.visitEvidence.contributing, 'Contributing evidence count changed')
  assert(expected.size === manifest.visitEvidence.expectedUnionKeys, 'Expected visit union changed')
  const visits = await reader.read('SELECT user_id, airport_iata, first_visit, last_visit, visit_count FROM visits')
  const actual = new Map(visits.filter((r) => sourceIds.has(String(r.user_id))).map((r) => [`${r.user_id}|${r.airport_iata ?? ''}`, r]))
  let differing = 0
  for (const [key, value] of expected) {
    const row = actual.get(key)
    if (!row || row.first_visit !== value.first || row.last_visit !== value.last || Number(row.visit_count) !== value.count) differing++
  }
  assert(actual.size === expected.size && differing === 0, `Published source-user visit value mismatches: ${differing}`)
  const states = await reader.read('SELECT user_id, revision, published_revision FROM user_derived_state')
  const ready = new Set(states.filter((r) => Number(r.revision) > 0 && r.revision === r.published_revision).map((r) => String(r.user_id)))
  assert([...sourceIds].every((id) => ready.has(id)), 'Some source users have pending derived state')
}

async function validateDatabase(reader: MigrationReader): Promise<void> {
  const fk = await reader.read('PRAGMA foreign_key_check')
  assert(fk.length === 0, 'Foreign-key violations found')
  // D1 rejects PRAGMA integrity_check with SQLITE_AUTH. Foreign keys and the
  // source-to-target comparisons above are the checks available through D1.
  const timestampColumns: Record<string, string[]> = {
    users: ['created_at'], profiles: ['created_at', 'updated_at'],
    flights: ['created_at', 'departure_utc', 'arrival_utc'],
    country_claims: ['claimed_at'], ground_visits: ['created_at'],
    user_stats: ['updated_at'], user_advanced_stats: ['created_at', 'updated_at'],
    user_badges: ['earned_at'], leaderboard_cache: ['updated_at'],
  }
  for (const [table, columns] of Object.entries(timestampColumns)) {
    let bad = 0
    for (const row of await reader.read(`SELECT ${columns.join(', ')} FROM ${table}`)) {
      for (const col of columns) if (row[col] != null && (typeof row[col] !== 'string' || !ISO.test(row[col]))) bad++
    }
    assert(bad === 0, `${table}: noncanonical timestamps found`)
  }
  for (const table of ['flights', 'user_badges', 'leaderboard_cache', 'visits']) {
    const max = Number((await reader.read(`SELECT COALESCE(MAX(id),0) AS n FROM ${table}`))[0]?.n ?? 0)
    const sequence = Number((await reader.read(`SELECT seq FROM sqlite_sequence WHERE name = '${table}'`))[0]?.seq ?? 0)
    assert(sequence >= max, `${table}: autoincrement cursor below maximum ID`)
  }
}

/** Shared read-only source/manifest/target validation for local and remote adapters. */
export async function validateTarget(reader: MigrationReader, snapshotDir: string, manifest: Manifest): Promise<void> {
  await validateRows(reader, snapshotDir, manifest)
  await validateVisits(reader, snapshotDir, manifest)
  await validateDatabase(reader)
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseLocalTarget(argv)
  const index = argv.indexOf('--snapshot-dir')
  const snapshotDir = index < 0 ? join(ROOT, 'db', '_snapshot') : resolve(argv[index + 1])
  const manifest = JSON.parse(readFileSync(join(snapshotDir, '_migration-manifest.json'), 'utf8')) as Manifest
  assert(manifest.target === 'local' && manifest.databaseId === options.databaseId, 'Manifest target mismatch')
  const target = await openLocalTarget(options)
  try {
    assert(manifest.schemaSha256 === target.schemaSha256, 'Manifest schema mismatch')
    await validateTarget({ read: async (sql) => (await target.db.prepare(sql).all<Record<string, unknown>>()).results }, snapshotDir, manifest)
    console.log(JSON.stringify({ result: 'PASS', target: 'local', databaseId: options.databaseId,
      schemaSha256: target.schemaSha256, sourceSnapshotSha256: manifest.sourceSnapshotSha256,
      sourceVisits: manifest.visitEvidence.raw, publishedVisitKeys: manifest.visitEvidence.expectedUnionKeys,
      foreignKeyViolations: 0 }))
  } finally {
    await target.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`Validation failed: ${(error as Error).message}`); process.exitCode = 1 })
}
