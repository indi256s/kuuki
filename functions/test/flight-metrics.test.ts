import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { apiContext, createApiDatabase, csrfRequest } from './harness'
import { instrumentDb } from './db-hooks'
import { onRequestPost } from '../api/flights/index'
import { onRequestPatch } from '../api/flights/[id]'
import { draftToFlightInput } from '../api/_services/importDrafts'
import { computeFlightDuration } from '../api/_services/flightDuration'
import { decideDuration, resolveFlightMetrics } from '../api/_services/flightMetrics'
import { medianFromSamples, normalizeFlightNumber, readBlockTimeMedian } from '../api/_services/blockTimeMedian'
import { findAirport } from '../../packages/data/src/airport-lookup'
import { estimateBlockMinutes } from '../../packages/shared/src/blockTime'
import { eastwardShare } from '../../packages/shared/src/geo'

const user = { id: 'metrics-u1', email: 'metrics-u1@example.test' }
const route = { date: '2026-03-28', origin: 'TBS', destination: 'JFK' }
const a = findAirport('TBS')!, b = findAirport('JFK')!
const routeEstimate = () => estimateBlockMinutes(8980, eastwardShare({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude }))
type OwnMetrics = { id: number; distance_km: number | null; duration_minutes: number | null; duration_source: string | null; zones_overflown: number | null }

describe('server-authoritative flight metrics', () => {
  let db: D1Database
  let dispose: () => Promise<void>
  beforeEach(async () => {
    const fixture = await createApiDatabase()
    db = fixture.db
    dispose = fixture.dispose
    await db.batch([
      ...[user, { id: 'metrics-u2', email: 'metrics-u2@example.test' }, { id: 'metrics-u3', email: 'metrics-u3@example.test' }]
        .flatMap(u => [db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(u.id, u.email, 'synthetic'),
          db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(u.id)]),
      ...['TBS', 'JFK', 'LHR', 'IST'].map(iata => {
        const a = findAirport(iata)!
        return db.prepare('INSERT INTO airports_reference (iata,name,city,country,country_code,latitude,longitude) VALUES (?,?,?,?,?,?,?)')
          .bind(iata, a.name, a.city, a.country, a.countryCode, a.latitude, a.longitude)
      }),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('GAT','Unknown','Unknown','Georgia','GE')"),
    ])
  })
  afterEach(async () => { await dispose() })
  const context = (path: string, method: string, body: unknown, key?: string, id?: number) => ({
    ...apiContext(db, csrfRequest(path, method, body, key ? { 'Idempotency-Key': key } : {})), data: { user }, params: id ? { id: String(id) } : {},
  } as never)
  const create = async (body: object, key: string) => {
    const response = await onRequestPost(context('/api/flights', 'POST', body, key))
    expect(response.status, await response.clone().text()).toBe(201)
    return await response.json() as OwnMetrics
  }
  const patch = async (id: number, body: object) => {
    const response = await onRequestPatch(context(`/api/flights/${id}`, 'PATCH', body, undefined, id))
    expect(response.status, await response.clone().text()).toBe(200)
    return await response.json() as OwnMetrics
  }

  it('create stores great-circle distance, not the client value, and publishes that sum', async () => {
    const first = await create({ ...route, distance_km: 1 }, 'metrics-great-circle-1')
    expect(first.distance_km).toBe(8980)
    expect(first.zones_overflown).toBeGreaterThan(0)
    const second = await create({ ...route, distance_km: 123 }, 'metrics-great-circle-2')
    expect(await db.prepare('SELECT total_distance_km FROM user_stats WHERE user_id = ?').bind(user.id).first())
      .toEqual({ total_distance_km: first.distance_km! + second.distance_km! })
    expect(await db.prepare('SELECT distance_km, zones_overflown FROM flights WHERE id = ?').bind(first.id).first())
      .toEqual({ distance_km: 8980, zones_overflown: first.zones_overflown })
  })

  it('unknown airport keeps client distance, otherwise distance and provenance are null', async () => {
    expect(await create({ ...route, destination: 'GAT', distance_km: 700 }, 'metrics-unknown-client'))
      .toMatchObject({ distance_km: 700, zones_overflown: null, duration_source: 'estimate', duration_minutes: estimateBlockMinutes(700, 0) })
    expect(await create({ ...route, destination: 'GAT' }, 'metrics-unknown-null'))
      .toMatchObject({ distance_km: null, zones_overflown: null, duration_source: null, duration_minutes: null })
  })

  it('invalid reference coordinates are unavailable rather than passed to tz lookup', async () => {
    for (const [lat, lon] of [[91, 0], [0, 181], [null, null], [1e999, 0]]) {
      await db.prepare('UPDATE airports_reference SET latitude = ?, longitude = ? WHERE iata = ?').bind(lat, lon, 'GAT').run()
      const metrics = await resolveFlightMetrics(db, { ...route, destination: 'GAT', airlineIata: null, flightNumber: null,
        departureTime: null, arrivalTime: null, clientDistanceKm: 25000 })
      expect(metrics).toMatchObject({ distanceKm: 20000, zonesOverflown: null, durationSource: 'estimate' })
    }
  })

  it('import without tz gets times across DST through draftToFlightInput', async () => {
    const input = draftToFlightInput({ date: '2026-03-28', origin: 'JFK', destination: 'LHR', airline_iata: 'BA', departure_time: '22:30', arrival_time: '10:30' })
    const result = await create(input, 'metrics-import-dst')
    const times = computeFlightDuration({ date: input.date!, departureTime: input.departure_time!, arrivalTime: input.arrival_time!,
      originTz: 'America/New_York', destTz: 'Europe/London', existingDurationMinutes: null })
    expect(result).toMatchObject({ origin_tz: 'America/New_York', dest_tz: 'Europe/London', duration_source: 'times',
      duration_minutes: times.durationMinutes, departure_utc: times.departureUtc, arrival_utc: times.arrivalUtc })
    expect(times.departureUtc).not.toBeNull()
    expect(times.durationMinutes).toBe(420)
  })

  it('pooled median needs three samples and prefers the normalized same-number set', async () => {
    const sample = (minutes: number, airline = 'DL', number = '12', owner = 'metrics-u2', lifecycle = 'logged', source = 'times') =>
      db.prepare(`INSERT INTO flights (user_id,date,origin,destination,airline_iata,flight_number,duration_minutes,duration_source,
        lifecycle_state,is_upcoming,confirmation_source,lifecycle_timezone,awaiting_after,auto_confirm_after)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'UTC','2025-01-02T00:00:00Z','2025-01-08T00:00:00Z')`)
        .bind(owner, '2025-01-01', 'TBS', 'IST', airline, number, minutes, source, lifecycle, lifecycle === 'upcoming' ? 1 : 0,
          lifecycle === 'logged' ? 'legacy' : null).run()
    await sample(150)
    await sample(160, 'DL', '12', 'metrics-u3', 'awaiting')
    await sample(1, 'TK', '381', 'metrics-u3', 'upcoming')
    await sample(2, 'TK', '381', 'metrics-u3', 'logged', 'estimate')
    const body = { ...route, destination: 'IST', airline_iata: 'TK', flight_number: 'TK 0381' }
    expect(await create(body, 'metrics-median-thin')).toMatchObject({ duration_source: 'estimate' })
    await sample(155)
    expect(await create(body, 'metrics-median-route')).toMatchObject({ duration_source: 'route_median', duration_minutes: 155 })
    for (const number of ['0381', 'TK381', 'TK 0381']) await sample(170, 'TK', number)
    expect(await create(body, 'metrics-median-number')).toMatchObject({ duration_source: 'route_median', duration_minutes: 170 })
    const tracked = instrumentDb(db)
    expect(await readBlockTimeMedian(tracked.db, { origin: 'IST', destination: 'TBS', airlineIata: 'TK', flightNumber: '381' })).toBeNull()
    expect(tracked.hooks.sql).toHaveLength(1)
    expect(tracked.hooks.sql[0]).toContain('idx_flights_route_times')
    expect(tracked.hooks.sql[0]).toMatch(/LIMIT\s+1000/i)
  })

  it('estimate ignores client duration', async () => {
    expect(await create({ ...route, duration_minutes: 999 }, 'metrics-ignore-client'))
      .toMatchObject({ duration_source: 'estimate', duration_minutes: routeEstimate() })
  })

  it('patch of airline or client metrics keeps all stored metric columns, including historical values', async () => {
    const first = await create(route, 'metrics-patch-keep')
    await db.prepare("UPDATE flights SET duration_minutes = 137, duration_source = 'schedule', zones_overflown = 77 WHERE id = ?").bind(first.id).run()
    expect(await patch(first.id, { airline_iata: 'TK', distance_km: 1, duration_minutes: 999 }))
      .toMatchObject({ duration_minutes: 137, duration_source: 'schedule', zones_overflown: 77, distance_km: 8980 })
  })

  it('patch of times recomputes; clearing times discards stale times provenance', async () => {
    const first = await create(route, 'metrics-patch-times')
    expect(await patch(first.id, { departure_time: '10:00', arrival_time: '12:00' })).toMatchObject({ duration_source: 'times', duration_minutes: 600 })
    expect(await patch(first.id, { departure_time: null })).toMatchObject({ duration_source: 'estimate', duration_minutes: routeEstimate() })
  })

  it('zones use the departure instant, or date noon when times are unknown', async () => {
    const body = { ...route, date: '2026-03-29', destination: 'LHR' }
    expect(await create({ ...body, departure_time: '00:30', arrival_time: '04:30' }, 'metrics-zone-departure'))
      .toMatchObject({ departure_utc: '2026-03-28T20:30:00.000Z', zones_overflown: 4 })
    const noon = await create(body, 'metrics-zone-noon')
    expect(noon).toMatchObject({ departure_utc: null, zones_overflown: 3 })
    expect(await patch(noon.id, { date: '2026-03-28' })).toMatchObject({ zones_overflown: 4 })
  })

  it('route edits replace the old endpoint zone unless explicitly supplied', async () => {
    const first = await create({ ...route, departure_time: '10:00', arrival_time: '12:00' }, 'metrics-patch-route-zone')
    expect(await patch(first.id, { destination: 'LHR' })).toMatchObject({ dest_tz: 'Europe/London', duration_source: 'times', duration_minutes: 360 })
    expect(await patch(first.id, { destination: 'IST', dest_tz: 'UTC' })).toMatchObject({ dest_tz: 'UTC', duration_source: 'times', duration_minutes: 360 })
    expect(await patch(first.id, { origin_tz: 'UTC' })).toMatchObject({ duration_source: 'times', duration_minutes: 120 })
  })

  it('clients cannot supply provenance, zones or the accepted-schedule flag', async () => {
    for (const extra of [{ duration_source: 'schedule' }, { zones_overflown: 123 }, { timesFromSchedule: true }]) {
      const response = await onRequestPost(context('/api/flights', 'POST', { ...route, ...extra }, 'metrics-forged-field'))
      expect(response.status).toBe(400)
    }
  })

  it('flight-number edits exclude the edited row from pooled samples', async () => {
    const first = await create({ ...route, destination: 'IST', departure_time: '10:00', arrival_time: '12:00' }, 'metrics-exclude-self')
    for (const minutes of [150, 160]) await db.prepare("INSERT INTO flights (user_id,date,origin,destination,duration_minutes,duration_source,is_upcoming) VALUES (?,'2025-01-01','TBS','IST',?,'times',0)")
      .bind('metrics-u2', minutes).run()
    expect(await patch(first.id, { flight_number: 'TK0381', departure_time: null })).toMatchObject({ duration_source: 'estimate' })
    await db.prepare("INSERT INTO flights (user_id,date,origin,destination,duration_minutes,duration_source,is_upcoming) VALUES (?,'2025-01-01','TBS','IST',170,'times',0)")
      .bind('metrics-u2').run()
    expect(await patch(first.id, { flight_number: 'TK99' })).toMatchObject({ duration_source: 'route_median', duration_minutes: 160 })
  })

  it('timezone resolution prefers valid input, then package, then reference lookup', async () => {
    const base = { ...route, airlineIata: null, flightNumber: null, departureTime: null, arrivalTime: null }
    expect(await resolveFlightMetrics(db, { ...base, originTz: 'UTC', destTz: 'not-a-zone' }))
      .toMatchObject({ originTz: 'UTC', destTz: 'America/New_York' })
    await db.prepare("UPDATE airports_reference SET latitude=41.6692, longitude=44.9547 WHERE iata='GAT'").run()
    expect(await resolveFlightMetrics(db, { ...base, destination: 'GAT' })).toMatchObject({ destTz: 'Asia/Tbilisi', zonesOverflown: 0 })
  })
})

it('median and number normalization handle unsorted/even samples and airline prefixes', () => {
  expect(medianFromSamples([160, 150])).toBeNull()
  expect(medianFromSamples([160, 150, 155])).toBe(155)
  expect(medianFromSamples([160, 150, 170, 161])).toBe(161)
  expect(normalizeFlightNumber('TK', 'tk 0381')).toBe('381')
  expect(normalizeFlightNumber(null, ' 0012 ')).toBe('12')
  expect(normalizeFlightNumber('TK', null)).toBeNull()
  expect(normalizeFlightNumber('TK', 'TK')).toBeNull()
  expect(normalizeFlightNumber('TK', 'TK000')).toBeNull()
  expect(normalizeFlightNumber('TK', 'TK000A')).toBe('A')
})

it('duration ladder uses own times, median, accepted schedule, then estimate and clamps', () => {
  const args = { timesMinutes: 200, timesFromSchedule: false, median: 150, distanceKm: 1000, east: 0 }
  expect(decideDuration(args)).toEqual({ minutes: 200, source: 'times' })
  expect(decideDuration({ ...args, timesFromSchedule: true })).toEqual({ minutes: 150, source: 'route_median' })
  expect(decideDuration({ ...args, timesFromSchedule: true, median: null })).toEqual({ minutes: 200, source: 'schedule' })
  expect(decideDuration({ ...args, timesMinutes: null, median: null })).toEqual({ minutes: estimateBlockMinutes(1000, 0), source: 'estimate' })
  expect(decideDuration({ ...args, timesMinutes: null, median: null, distanceKm: null })).toEqual({ minutes: null, source: null })
  expect(decideDuration({ ...args, timesMinutes: 1400 })).toEqual({ minutes: 1200, source: 'times' })
})
