import { expect, it, vi } from 'vitest'
import { aggregateRows } from '../../packages/shared/src/overview/aggregate'
import type { OverviewRow } from '../../packages/shared/src/overview/model'
import { overviewEtag, readOverviewData } from '../api/_services/overviewData'
import { dirtyUserStatement } from '../api/_services/derivedState'
import { bulkFlights, overviewAccount, USER } from './overview-fixture'

it('payload carries every lifecycle state in one owner-scoped batch', async () => {
  const { db, dispose } = await overviewAccount([
    { id: 1, date: '2027-01-01', origin: 'TBS', destination: 'IST', state: 'upcoming' },
    { id: 2, date: '2026-01-01', origin: 'IST', destination: 'JFK', state: 'awaiting' },
    { id: 3, date: '2025-01-01', origin: 'JFK', destination: 'TBS', state: 'logged', aircraft: 'A320', km: 8980, minutes: 660 },
  ])
  try {
    const batch = vi.fn(db.batch.bind(db))
    const readDb = { prepare: db.prepare.bind(db), batch } as unknown as D1Database
    const payload = await readOverviewData(readDb, USER.id)
    expect(batch).toHaveBeenCalledTimes(1)
    expect(payload).toMatchObject({ schemaVersion: 2, mode: 'flights', derivedReady: true, homeOverride: null,
      passport: { countries: 2, regions: 2 } })
    expect(payload.rows.map(row => [row.id, row.state, row.weight])).toEqual([
      [3, 'logged', 1], [2, 'awaiting', 1], [1, 'upcoming', 1],
    ])
    expect(payload.rows[0]).toMatchObject({ distanceKm: 8980, durationMinutes: 660, suppressed: 0 })
    expect(payload.refs.aircraft.A320.family).toBe('A320')
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  } finally { await dispose() }
})

it('transit suppression is a bit, not a missing country', async () => {
  const { db, dispose } = await overviewAccount([
    { id: 1, date: '2025-01-01', origin: 'TBS', destination: 'IST', state: 'logged', transit: 1, leg: 2,
      dep: '2025-01-01T08:00:00Z', arr: '2025-01-01T10:00:00Z' },
    { id: 2, date: '2025-01-01', origin: 'IST', destination: 'JFK', state: 'logged',
      dep: '2025-01-01T12:00:00Z', arr: '2025-01-01T22:00:00Z' },
  ])
  try {
    const payload = await readOverviewData(db, USER.id)
    expect(payload.rows.map(row => row.suppressed)).toEqual([2, 1])
    expect(payload.refs.airports.IST.country).toBe('TR')
    expect(payload.passport.countries).toBe(2)
  } finally { await dispose() }
})

it('refs are the referenced subset and never include another owner', async () => {
  const { db, dispose } = await overviewAccount([
    { id: 1, date: '2025-01-01', origin: 'TBS', destination: 'IST', state: 'logged', aircraft: 'A320' },
  ], d => [
    d.prepare("INSERT INTO users (id,email,password_hash) VALUES ('other','other@example.test','hash')"),
    d.prepare("INSERT INTO flights (user_id,date,origin,destination,aircraft_icao) VALUES ('other','2025-01-01','LHR','JFK','A359')"),
    d.prepare("UPDATE profiles SET home_airport = 'TBS' WHERE id = ?").bind(USER.id),
  ])
  try {
    const payload = await readOverviewData(db, USER.id)
    expect(Object.keys(payload.refs.airports).sort()).toEqual(['IST', 'TBS'])
    expect(Object.keys(payload.refs.aircraft)).toEqual(['A320'])
    expect(payload.rows).toHaveLength(1)
    expect(payload.homeOverride).toBe('TBS')
    expect(payload.refs.regions).toMatchObject({ GE: 'asia', TR: 'asia' })
  } finally { await dispose() }
})

it('aggregate mode preserves totals above 5000 rows', async () => {
  const { db, dispose } = await overviewAccount([], d => [bulkFlights(d, 5001)])
  try {
    const payload = await readOverviewData(db, USER.id)
    expect(payload.mode).toBe('aggregate')
    expect(payload.rows.length).toBeLessThan(5001)
    expect(payload.rows.reduce((sum, row) => sum + row.weight, 0)).toBe(5001)
    expect(payload.rows.reduce((sum, row) => sum + (row.distanceKm ?? 0), 0)).toBe(500100)
    expect(payload.rows.every(row => row.date.endsWith('-01') && row.flightNumber === null && row.departureUtc === null)).toBe(true)
  } finally { await dispose() }
})

it('etag changes with either revision and exposes pending publication', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    const before = await readOverviewData(db, USER.id)
    expect(before.rows).toEqual([])
    expect(before.refs).toEqual({ airports: {}, aircraft: {}, regions: {} })
    expect(before.passport).toEqual({ countries: 0, regions: 0 })
    await dirtyUserStatement(db, USER.id).run()
    const after = await readOverviewData(db, USER.id)
    expect(after.etag).not.toBe(before.etag)
    expect(after.derivedReady).toBe(false)
    expect(overviewEtag({ revision: 2, evidence_revision: 1 })).toBe('W/"ov2-2-1"')
    expect(overviewEtag({ revision: 2, evidence_revision: 2 })).not.toBe(after.etag)
  } finally { await dispose() }
})

it('keeps unknown reference codes and null metrics without inventing evidence', async () => {
  const { db, dispose } = await overviewAccount([
    { id: 1, date: '2025-01-01', origin: 'ZZZ', destination: 'TBS', state: 'logged', aircraft: 'B77W' },
    { id: 2, date: '2025-01-02', origin: 'TBS', destination: 'IST', state: 'logged', aircraft: 'ZZZX' },
  ], d => [
    d.prepare("INSERT INTO aircraft_reference (icao,name,manufacturer,model,type,engine_type,engine_count) VALUES ('ZZZX','Unknown','Other','Foo 1','regional','jet',2)"),
    d.prepare("UPDATE flights SET departure_time = '23:45' WHERE id = 1"),
    d.prepare("UPDATE flights SET departure_time = 'bad' WHERE id = 2"),
  ])
  try {
    const payload = await readOverviewData(db, USER.id)
    expect(payload.refs.airports.ZZZ).toEqual({ lat: null, lon: null, country: null, city: null, name: 'ZZZ' })
    expect(payload.refs.aircraft.B77W.family).toBe('777')
    expect(payload.refs.aircraft.ZZZX.family).toBe('Foo 1')
    expect(payload.rows.map(row => row.depMinute)).toEqual([1425, null])
    expect(payload.rows[0]).toMatchObject({ distanceKm: null, durationMinutes: null, zonesOverflown: null, durationSource: null })
  } finally { await dispose() }
})

const row = (overrides: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 9, weight: 1, date: '2025-01-03', state: 'logged', origin: 'TBS', destination: 'IST',
  airline: 'TK', aircraft: 'A320', flightNumber: '381', depMinute: 390, distanceKm: 100,
  durationMinutes: 60, zonesOverflown: 2, durationSource: 'times', originTz: 'Asia/Tbilisi',
  destTz: 'Europe/Istanbul', departureUtc: '2025-01-03T02:30:00Z', suppressed: 0, ...overrides,
})

it('aggregates weighted sums, minimum ids and nullable metrics deterministically', () => {
  const rows = [row({ weight: 2, distanceKm: 200, zonesOverflown: null }),
    row({ id: 4, date: '2025-01-25', weight: 3, distanceKm: 300, depMinute: 400, durationMinutes: null, zonesOverflown: null })]
  const expected = [{ ...row(), id: 4, weight: 5, date: '2025-01-01', distanceKm: 500, durationMinutes: 60,
    depMinute: 360, zonesOverflown: null, flightNumber: null, departureUtc: null }]
  expect(aggregateRows(rows)).toEqual(expected)
  expect(aggregateRows([...rows].reverse())).toEqual(expected)
  expect(rows[0].flightNumber).toBe('381')
})

it.each<Partial<OverviewRow>>([
  { state: 'upcoming' }, { origin: 'JFK' }, { destination: 'JFK' }, { airline: null }, { aircraft: null },
  { date: '2025-02-01' }, { depMinute: null }, { durationSource: 'estimate' }, { suppressed: 2 },
])('keeps distinct aggregate dimensions: %j', different => {
  expect(aggregateRows([row(), row({ ...different, id: 10 })])).toHaveLength(2)
})
