/** Read-only metrics inventory; writes private reviewed SQL, never applies it. */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Miniflare } from 'miniflare'
import { planFlightBackfill, renderBackfillSql, type BackfillClass, type BackfillFlight } from '../functions/api/_services/flightBackfill'
import type { LatLon } from '../packages/shared/src/geo'
import { SCHEMA_SQL, privateOutputPath, requiredArg } from './_cli'
import { assessSchemaAdmission, expectedSchemaRows, parseLocalTarget, type SchemaAdmission } from './migration-target'
import { assertRemoteIds, openRemoteReader, type MigrationReader } from './migration-remote-reader'

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const target = requiredArg(argv, '--target')
  if (target !== 'local' && target !== 'remote') throw new Error('--target must be local or remote')
  const databaseId = requiredArg(argv, '--database-id')
  const outputPath = privateOutputPath(requiredArg(argv, '--output-sql'))
  const admissionPath = argv.includes('--schema-admission') ? privateOutputPath(requiredArg(argv, '--schema-admission')) : undefined
  let accountId = target === 'remote' ? requiredArg(argv, '--account-id') : 'local'
  if (target === 'remote') assertRemoteIds(accountId, databaseId)
  else if (admissionPath) {
    // Restored local databases have no account binding; use the pinned review's provenance.
    const evidence = JSON.parse(readFileSync(admissionPath, 'utf8')) as SchemaAdmission
    if (typeof evidence.accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(evidence.accountId)) throw new Error('Invalid schema admission account ID')
    accountId = evidence.accountId
  }
  let reader: MigrationReader & { dispose(): void | Promise<void> }
  if (target === 'remote') reader = openRemoteReader(accountId, databaseId)
  else {
    const options = parseLocalTarget(argv)
    const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("backfill-read") } }',
      compatibilityDate: '2026-01-01', d1Databases: { DB: databaseId }, d1Persist: options.persistPath })
    reader = { async read(sql) { return (await (await mf.getD1Database('DB')).prepare(sql).all<Record<string, unknown>>()).results },
      dispose: () => mf.dispose() }
  }
  try {
    const admission = assessSchemaAdmission(await reader.read(SCHEMA_SQL), await expectedSchemaRows(), { accountId, databaseId }, admissionPath)
    const base = { mode: 'read-only-overview-backfill', target, accountId, databaseId, schemaSha256: admission.observedSha256,
      expectedFreshSchemaSha256: admission.expectedSha256, schemaReady: admission.admitted }
    if (!admission.admitted) {
      console.log(JSON.stringify({ ...base, schemaAdmissionReason: admission.reason, artifactWritten: false,
        artifactRefusedReason: 'schema-not-admitted' }))
      return
    }
    const flights = await reader.read(`SELECT id, user_id, origin, destination, date, airline_iata, flight_number,
      lifecycle_state, departure_time, arrival_time, origin_tz, dest_tz, departure_utc, arrival_utc,
      distance_km, duration_minutes, duration_source, zones_overflown FROM flights ORDER BY id`) as unknown as BackfillFlight[]
    const airports = await reader.read('SELECT iata, latitude, longitude FROM airports_reference')
    const coords = new Map<string, LatLon>()
    for (const row of airports) {
      if (typeof row.iata === 'string' && typeof row.latitude === 'number' && typeof row.longitude === 'number') {
        coords.set(row.iata, { lat: row.latitude, lon: row.longitude })
      }
    }
    const changes = planFlightBackfill(flights, coords)
    const sql = renderBackfillSql(changes, { accountId, databaseId, schemaSha256: admission.observedSha256 })
    const changed = new Map(changes.map(c => [c.id, c]))
    const classCounts: Partial<Record<BackfillClass, number>> = {}
    for (const change of changes) for (const key of change.classes) classCounts[key] = (classCounts[key] ?? 0) + 1
    const users = [...new Set(changes.map(c => c.userId))].sort().map(userId => {
      const owned = flights.filter(f => f.user_id === userId)
      return { userId, flightsChanged: changes.filter(c => c.userId === userId).length,
        distanceKm: { before: owned.reduce((n, f) => n + (f.distance_km ?? 0), 0),
          after: owned.reduce((n, f) => n + ((changed.get(f.id)?.after ?? f).distance_km ?? 0), 0) },
        durationMinutes: { before: owned.reduce((n, f) => n + (f.duration_minutes ?? 0), 0),
          after: owned.reduce((n, f) => n + ((changed.get(f.id)?.after ?? f).duration_minutes ?? 0), 0) } }
    })
    const manifest = { ...base, sqlSha256: createHash('sha256').update(sql).digest('hex'), changeCount: changes.length,
      classCounts, users, sourceFreshnessVerified: false, schemaAdmission: admission.observedSha256 === admission.expectedSha256 ? 'fresh-exact' : 'operator-reviewed' }
    try {
      writeFileSync(outputPath, sql, { flag: 'wx', mode: 0o600 })
      try {
        writeFileSync(`${outputPath}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
      } catch (error) {
        rmSync(outputPath, { force: true })
        throw error
      }
    } catch (error) {
      console.log(JSON.stringify({ ...manifest, artifactWritten: false, artifactRefusedReason: 'artifact-write-failed' }))
      throw error
    }
    console.log(JSON.stringify({ ...manifest, artifactWritten: true, artifactPath: outputPath, artifactManifestPath: `${outputPath}.manifest.json` }))
  } finally { await reader.dispose() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Overview backfill proposal failed; check explicit target, private output and schema admission'); process.exitCode = 1 })
}
