/** Read-only owner parity against an explicitly admitted, isolated Release 1 restore. */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readOverview } from '../functions/api/_services/overview'
import { readOverviewData } from '../functions/api/_services/overviewData'
import { computeOverview } from '../packages/shared/src/overview/compute'
import { recordExtrema } from '../packages/shared/src/overview/records'
import { openLocalTarget, parseLocalTarget } from './migration-target'
import { requiredArg } from './_cli'

type Value = number | string | null
export interface ParityRow { metric: string; legacy: Value; current: Value; delta: number | 'same' | 'changed' }
const ranked = (row: { key: string; count: number } | undefined): string | null => row ? `${row.key} (${row.count})` : null

export async function overviewParity(db: D1Database, userId: string): Promise<ParityRow[]> {
  if (!await db.prepare('SELECT 1 FROM profiles WHERE id=?').bind(userId).first()) throw new Error('Owner profile not found')
  const legacy = await readOverview(db, userId)
  // Freeze the two legacy aggregates from 1ebf7b3 so retirement preserves this diagnostic.
  const aircraft = await db.prepare(`SELECT COUNT(DISTINCT COALESCE(ar.manufacturer, 'Unknown')) AS manufacturers
    FROM flights f LEFT JOIN aircraft_reference ar ON f.aircraft_icao=ar.icao
    WHERE f.user_id=? AND f.aircraft_icao IS NOT NULL
    AND f.lifecycle_state IN ('logged','awaiting')`).bind(userId).first<{ manufacturers: number }>()
  const duration = await db.prepare(`SELECT COALESCE(MAX(duration_minutes),0) AS longest_minutes,
    COALESCE(MIN(NULLIF(duration_minutes,0)),0) AS shortest_minutes FROM flights
    WHERE user_id=? AND lifecycle_state IN ('logged','awaiting') AND duration_minutes IS NOT NULL`)
    .bind(userId).first<{ longest_minutes: number; shortest_minutes: number }>()
  const shortest = await db.prepare(`SELECT MIN(distance_km) AS km FROM flights WHERE user_id=?
    AND lifecycle_state IN ('logged','awaiting')`).bind(userId).first<{ km: number | null }>()
  const payload = await readOverviewData(db, userId)
  if (!payload.derivedReady || legacy.derivedState !== 'ready') throw new Error('Derived state must be ready before parity')
  const scope = computeOverview(payload, {})
  const counted = payload.rows.filter(row => row.state !== 'upcoming')
  const extrema = recordExtrema(counted, payload.mode)
  const distinct = (field: 'airline' | 'aircraft') => new Set(counted.flatMap(row => row[field] ? [row[field]] : [])).size
  const manufacturers = new Set(counted.flatMap(row => {
    const name = row.aircraft ? payload.refs.aircraft[row.aircraft]?.manufacturer : null
    return name ? [name] : []
  })).size
  const route = legacy.insights.mostFrequentRoute
  const pairs: Array<[string, Value, Value]> = [
    ['flights', legacy.totals.flights, scope.figures.flights],
    ['distance km', legacy.totals.distanceKm, scope.figures.distanceKm],
    ['duration minutes', legacy.totals.durationMinutes, scope.figures.durationMinutes],
    ['airlines', legacy.totals.airlines, distinct('airline')],
    ['aircraft types (ICAO)', legacy.totals.aircraft, distinct('aircraft')],
    ['manufacturers', aircraft?.manufacturers ?? 0, manufacturers],
    ['regions', legacy.totals.continents, scope.figures.regions],
    ['longest flight km', legacy.insights.longestFlight?.distanceKm ?? null, extrema.longest?.value ?? null],
    ['shortest flight km', shortest?.km ?? null, extrema.shortest?.value ?? null],
    ['longest duration minutes', duration?.longest_minutes || null, extrema.longestDuration?.value ?? null],
    ['shortest duration minutes', duration?.shortest_minutes || null, extrema.shortestDuration?.value ?? null],
    ['top airline', ranked(legacy.topLists.airlines[0] && { key: legacy.topLists.airlines[0].id, count: legacy.topLists.airlines[0].count }), ranked(scope.rankings.airlines[0])],
    ['top airport', ranked(legacy.topLists.airports[0] && { key: legacy.topLists.airports[0].id, count: legacy.topLists.airports[0].count }), ranked(scope.rankings.airports[0])],
    ['top route', route ? `${route.origin}→${route.destination} (${route.count})` : null, ranked(scope.rankings.routes[0])],
  ]
  return pairs.map(([metric, legacy, current]) => ({ metric, legacy, current,
    delta: typeof legacy === 'number' && typeof current === 'number' ? current - legacy : legacy === current ? 'same' : 'changed' }))
}

export function parityTable(rows: ParityRow[]): string {
  const cell = (value: Value) => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ')
  return ['| metric | legacy | new | delta |', '| --- | --- | --- | --- |',
    ...rows.map(row => `| ${cell(row.metric)} | ${cell(row.legacy)} | ${cell(row.current)} | ${cell(row.delta)} |`)].join('\n')
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseLocalTarget(argv.includes('--target') ? argv : ['--target', 'local', ...argv])
  const userId = requiredArg(argv, '--user')
  const admission = argv.includes('--schema-admission') ? requiredArg(argv, '--schema-admission') : undefined
  const target = await openLocalTarget(options, admission)
  try {
    const rows = await overviewParity(target.db, userId)
    const table = parityTable(rows)
    const directory = mkdtempSync(join(tmpdir(), 'kuuki-overview-parity-'))
    const path = join(directory, 'report.md')
    writeFileSync(path, `# Overview parity\n\nSame post-Release-1 local snapshot; no writes.\n\n${table}\n`, { flag: 'wx', mode: 0o600 })
    console.log(table)
    console.log(JSON.stringify({ mode: 'local-read-only-overview-parity', databaseId: options.databaseId,
      schemaSha256: target.schemaSha256, reportPath: path, deltas: rows.filter(row => row.delta !== 0 && row.delta !== 'same').length }))
  } finally { await target.dispose() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077)
  main().catch(() => { console.error('Overview parity failed; check the explicit local target, owner and schema admission'); process.exitCode = 1 })
}
