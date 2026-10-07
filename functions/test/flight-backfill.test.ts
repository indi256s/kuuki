import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { unstable_splitSqlQuery } from 'wrangler'
import { findAirport } from '../../packages/data/src/airport-lookup'
import { estimateBlockMinutes } from '../../packages/shared/src/blockTime'
import { eastwardShare, type LatLon } from '../../packages/shared/src/geo'
import { FLIGHT_COLUMNS } from '../api/_lib/flights'
import { planFlightBackfill, renderBackfillSql, type BackfillFlight } from '../api/_services/flightBackfill'
import { repairUserDerivedState } from '../api/_services/derivedState'
import { updateFlightRequest } from '../api/flights/[id]'
import { createApiDatabase, csrfRequest } from './harness'

const coords = new Map<string, LatLon>(['TBS', 'JFK'].map(iata => {
  const a = findAirport(iata)!
  return [iata, { lat: a.latitude, lon: a.longitude }]
}))
const meta = { accountId: 'local', databaseId: 'synthetic-backfill', schemaSha256: 'synthetic-schema' }
const legacyMinutes = Math.round(9878 / 800 * 60 + 45)
const row = (extra: Partial<BackfillFlight> = {}): BackfillFlight => ({
  id: 1, user_id: 'backfill-owner', date: '2025-01-01', origin: 'TBS', destination: 'JFK',
  airline_iata: 'TK', flight_number: '381', lifecycle_state: 'logged',
  departure_time: null, arrival_time: null, origin_tz: null, dest_tz: null,
  departure_utc: null, arrival_utc: null, distance_km: 9878, duration_minutes: legacyMinutes,
  duration_source: null, zones_overflown: null, ...extra,
})

it('replaces legacy distance and estimate, but keeps unexplained historical duration', () => {
  const changes = planFlightBackfill([row(), row({ id: 2, duration_minutes: 611 })], coords)
  expect(changes[0].after).toMatchObject({ distance_km: 8980, duration_minutes: estimateBlockMinutes(8980,
    eastwardShare(coords.get('TBS')!, coords.get('JFK')!)), duration_source: 'estimate' })
  expect(changes[0].classes).toEqual(expect.arrayContaining(['distance_changed', 'estimate_replaced', 'zones_set']))
  expect(changes[1].after).toMatchObject({ duration_minutes: 611, duration_source: 'estimate' })
  expect(changes[1].classes).toContain('kept_unexplained')
})

it('fills a missing duration without reporting a replaced legacy estimate', () => {
  const changes = planFlightBackfill([row({ distance_km: null, duration_minutes: null })], coords)
  expect(changes[0].after).toMatchObject({ distance_km: 8980, duration_source: 'estimate',
    duration_minutes: estimateBlockMinutes(8980, eastwardShare(coords.get('TBS')!, coords.get('JFK')!)) })
  expect(changes[0].classes).not.toContain('estimate_replaced')
  expect(changes[0].classes).not.toContain('kept_unexplained')
})

it('fills timezone before measuring times, including a DST red-eye', () => {
  const changes = planFlightBackfill([row({ origin: 'JFK', destination: 'LHR', date: '2026-03-28',
    departure_time: '22:30', arrival_time: '10:30' })], coords)
  expect(changes[0].after).toMatchObject({ origin_tz: 'America/New_York', dest_tz: 'Europe/London',
    duration_minutes: 420, duration_source: 'times', departure_utc: '2026-03-29T02:30:00.000Z' })
  expect(changes[0].classes).toEqual(expect.arrayContaining(['tz_filled', 'times']))
})

it('reports missing and invalid coordinates without rewriting distance or throwing', () => {
  for (const missing of [new Map(coords), new Map([...coords, ['MOW', { lat: 91, lon: 0 }]] as [string, LatLon][])]) {
    const changes = planFlightBackfill([row({ destination: 'MOW', distance_km: 1777, duration_minutes: null })], missing)
    expect(changes[0].after).toMatchObject({ distance_km: 1777, zones_overflown: null })
    expect(changes[0].classes).toContain('no_coordinates')
  }
  expect(planFlightBackfill([row({ destination: 'MOW', distance_km: null, duration_minutes: null })], new Map())[0].after)
    .toMatchObject({ distance_km: null, duration_minutes: null, duration_source: null, zones_overflown: null })
})

it('uses the supplied calibration and skips malformed times as measured samples', () => {
  const model = { intercept: 20, slopes: [0.05, 0.05, 0.05] as [number, number, number], jet: 0, samples: 50, rmse: 3, fittedAt: '2026-10-07' }
  const changes = planFlightBackfill([row({ departure_time: '25:00', arrival_time: '12:00' })], coords, model)
  expect(changes[0].after).toMatchObject({ duration_minutes: 469, duration_source: 'estimate', departure_utc: null, arrival_utc: null })
  const invalidDate = planFlightBackfill([row({ date: 'bad-date', departure_time: '10:00', arrival_time: '12:00' })], coords)
  expect(invalidDate[0].after).toMatchObject({ duration_source: 'estimate', departure_utc: null, zones_overflown: null })
})

it('builds pooled medians from newly measured eligible rows across all users', () => {
  const sample = (id: number, arrival: string, extra: Partial<BackfillFlight> = {}) => row({ id, user_id: `sample-${id}`,
    origin_tz: 'UTC', dest_tz: 'UTC', departure_time: '10:00', arrival_time: arrival,
    duration_minutes: null, ...extra })
  const inputs = [row({ duration_minutes: null }), sample(2, '12:50'), sample(3, '12:50', { lifecycle_state: 'awaiting' }),
    sample(4, '12:50'), sample(5, '10:01', { lifecycle_state: 'upcoming' }),
    sample(6, '12:30', { airline_iata: 'DL' }), sample(7, '12:30', { airline_iata: 'DL' }), sample(8, '12:30', { airline_iata: 'DL' })]
  expect(planFlightBackfill(inputs, coords).find(c => c.id === 1)?.after)
    .toMatchObject({ duration_minutes: 170, duration_source: 'route_median' })
  expect(planFlightBackfill(inputs.slice(0, 3), coords).find(c => c.id === 1)?.after.duration_source).toBe('estimate')
  expect(planFlightBackfill([row({ duration_minutes: null, flight_number: '99' }), ...inputs.slice(1)], coords)
    .find(c => c.id === 1)?.after).toMatchObject({ duration_minutes: 160, duration_source: 'route_median' })
  expect(planFlightBackfill([row({ duration_minutes: 611 }), ...inputs.slice(1)], coords).find(c => c.id === 1)?.after)
    .toMatchObject({ duration_minutes: 611, duration_source: 'estimate' })
  const changes = planFlightBackfill(inputs, coords)
  expect(planFlightBackfill(inputs.map(f => ({ ...f, ...changes.find(c => c.id === f.id)?.after })), coords)).toEqual([])
  expect(planFlightBackfill([row({ duration_minutes: null }), ...inputs.slice(1, 3),
    sample(9, '12:50', { duration_source: 'schedule' })], coords).find(c => c.id === 1)?.after.duration_source).toBe('estimate')
})

it('pools pass-one times after the same 1200-minute clamp used by current writes', () => {
  const flights = [row({ duration_minutes: null }), ...[2, 3, 4].map(id => row({ id,
    origin_tz: 'UTC', dest_tz: 'UTC', departure_time: '00:00', arrival_time: '20:50', duration_minutes: null }))]
  const changes = planFlightBackfill(flights, coords)
  expect(changes.find(c => c.id === 1)?.after).toMatchObject({ duration_minutes: 1200, duration_source: 'route_median' })
  expect(changes.find(c => c.id === 2)?.after).toMatchObject({ duration_minutes: 1200, duration_source: 'times' })
})

describe('backfill SQL on isolated D1', () => {
  let db: D1Database
  let dispose: () => Promise<void>
  beforeEach(async () => {
    const fixture = await createApiDatabase()
    db = fixture.db
    dispose = fixture.dispose
    await db.batch([
      db.prepare("INSERT INTO users (id,email,password_hash) VALUES ('backfill-owner','backfill@synthetic.test','synthetic')"),
      db.prepare("INSERT INTO profiles (id) VALUES ('backfill-owner')"),
      ...['TBS', 'JFK'].map(iata => {
        const a = findAirport(iata)!
        return db.prepare('INSERT INTO airports_reference (iata,name,city,country,country_code,latitude,longitude) VALUES (?,?,?,?,?,?,?)')
          .bind(iata, a.name, a.city, a.country, a.countryCode, a.latitude, a.longitude)
      }),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,airline_iata,flight_number,distance_km,duration_minutes,is_upcoming) VALUES ('backfill-owner','2025-01-01','TBS','JFK','TK','381',9878,?,0)")
        .bind(legacyMinutes),
    ])
  })
  afterEach(async () => { await dispose() })
  const read = async () => (await db.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights ORDER BY id`).all<BackfillFlight>()).results
  const apply = async (sql: string) => db.batch(unstable_splitSqlQuery(sql).map(s => db.prepare(s)))

  it('applies once, re-plans empty, and repairs totals without revoking historical badges', async () => {
    await db.batch([
      db.prepare("INSERT INTO badge_definitions (id,code,name,criteria) VALUES (63,'historic-distance','Historic','{\"distance_km\":9800}')"),
      db.prepare("INSERT INTO user_badges (user_id,badge_id,earned_at) VALUES ('backfill-owner',63,'2020-01-01')"),
    ])
    expect(await repairUserDerivedState(db, 'backfill-owner')).toMatchObject({ derived_state: 'ready' })
    expect(await db.prepare("SELECT total_distance_km FROM user_stats WHERE user_id='backfill-owner'").first())
      .toEqual({ total_distance_km: 9878 })
    const badgeRows = (await db.prepare('SELECT * FROM user_badges').all()).results
    const results = await apply(renderBackfillSql(planFlightBackfill(await read(), coords), meta))
    expect(results[0].meta.changes).toBe(1)
    expect(planFlightBackfill(await read(), coords)).toEqual([])
    expect(await repairUserDerivedState(db, 'backfill-owner')).toMatchObject({ derived_state: 'ready' })
    expect(await db.prepare("SELECT total_distance_km FROM user_stats WHERE user_id='backfill-owner'").first())
      .toEqual({ total_distance_km: 8980 })
    expect((await db.prepare('SELECT * FROM user_badges').all()).results).toEqual(badgeRows)
  })

  it.each(['airline_iata', 'flight_number'] as const)('rejects drift of %s even if all other guards still match', async column => {
    await db.batch([['TK', '381', 170, '12:50'], ['DL', '381', 150, '12:30'], ['TK', '99', 180, '13:00']]
      .flatMap(([airline, number, minutes, arrival]) => Array.from({ length: 3 }, () =>
        db.prepare(`INSERT INTO flights (user_id,date,origin,destination,airline_iata,flight_number,distance_km,duration_minutes,
          duration_source,departure_time,arrival_time,origin_tz,dest_tz,is_upcoming)
          VALUES ('backfill-owner','2025-01-01','TBS','JFK',?,?,8980,?,'times','10:00',?,'UTC','UTC',0)`)
          .bind(airline, number, minutes, arrival))))
    const before = await read()
    const proposal = planFlightBackfill(before, coords).filter(c => c.id === before[0].id)
    expect(proposal[0].after).toMatchObject({ duration_minutes: 170, duration_source: 'route_median' })
    const sql = renderBackfillSql(proposal, meta)
    if (column === 'airline_iata') {
      const response = await updateFlightRequest(csrfRequest(`/api/flights/${before[0].id}`, 'PATCH', { airline_iata: 'DL' }),
        { DB: db } as Env, { user: { id: 'backfill-owner', email: 'backfill@synthetic.test' } }, String(before[0].id))
      expect(response.status).toBe(200)
    } else {
      // An old-shape writer can edit only the number without recomputing metrics.
      await db.prepare('UPDATE flights SET flight_number=? WHERE id=?').bind('99', before[0].id).run()
    }
    const newer = await read()
    expect({ ...newer[0], [column]: before[0][column] }).toEqual(before[0])
    const results = await apply(sql)
    expect(results[0].meta.changes).toBe(0)
    expect(await read()).toEqual(newer)
    const fresh = planFlightBackfill(await read(), coords).find(c => c.id === before[0].id)!
    expect(fresh.before[column]).toBe(column === 'airline_iata' ? 'DL' : '99')
    expect(fresh.after).toMatchObject({ duration_minutes: column === 'airline_iata' ? 150 : 180, duration_source: 'route_median' })
  })

  it('rejects stale SQL after times PATCH and re-plans empty for canonical metrics', async () => {
    const before = await read()
    const sql = renderBackfillSql(planFlightBackfill(before, coords), meta)
    const response = await updateFlightRequest(csrfRequest(`/api/flights/${before[0].id}`, 'PATCH',
      { departure_time: '10:00', arrival_time: '12:00' }), { DB: db } as Env,
      { user: { id: 'backfill-owner', email: 'backfill@synthetic.test' } }, String(before[0].id))
    expect(response.status).toBe(200)
    const newer = await read()
    expect(newer[0]).toMatchObject({ distance_km: 8980, duration_minutes: 660, duration_source: 'times' })
    expect((await apply(sql))[0].meta.changes).toBe(0)
    expect(await read()).toEqual(newer)
    expect(planFlightBackfill(await read(), coords)).toEqual([])
  })
})
