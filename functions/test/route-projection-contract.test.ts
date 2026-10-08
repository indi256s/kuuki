// C6 opened-map contract: `GET /api/flights/route-projection` and the Overview summary describe the same account with
// the same completed-period predicate, country policy and publication stamps, so a client can detect a change between
// the two reads. The directed `routes` list stays as the existing call site expects; `pairs` is the deduplicated geometry.
import { describe, expect, it } from 'vitest'
import { at, bulkFlights, overviewAccount, readOverviewScope, readOverviewPayload, readRouteProjection, T0, USER, type OverviewFlight } from './overview-fixture'
import { createApiDatabase } from './harness'
import { dirtyUserStatement } from '../api/_services/derivedState'
import { MAX_PROJECTED_ROUTES } from '../api/flights/route-projection'

const logged = (id: number, date: string, origin: string, destination: string, extra: Partial<OverviewFlight> = {}): OverviewFlight =>
  ({ id, date, origin, destination, state: 'logged', ...extra })

describe('completed-period predicate and pair semantics', () => {
  const flights: OverviewFlight[] = [
    logged(1, '2026-01-10', 'TBS', 'IST'), logged(2, '2026-02-10', 'IST', 'TBS'), logged(3, '2026-03-10', 'TBS', 'IST'),
    logged(4, '2026-04-10', 'TBS', 'JFK'),
    { id: 5, date: '2026-05-10', origin: 'TBS', destination: 'LHR', state: 'upcoming' },
    logged(6, '2025-04-10', 'TBS', 'LHR'),
  ]

  it('counts undirected pairs exactly as the summary counts routes, with explicit direction counts', async () => {
    const { db, dispose } = await overviewAccount(flights)
    try {
      for (const period of ['all', '2026', '2025']) {
        const summary = await readOverviewScope(db, period === 'all' ? {} : { period: { years: [Number(period)] } })
        const projection = await readRouteProjection(db, period)
        expect(projection.routeCount).toBe(summary.globe.routes.length)
        expect(projection.pairs).toHaveLength(summary.globe.routes.length)
        expect(projection.truncated).toBe(false)
        expect(projection.pairs.reduce((total, pair) => total + pair.count, 0)).toBe(summary.figures.flights)
        expect(projection.routes.reduce((total, route) => total + route.count, 0)).toBe(summary.figures.flights)
      }
      const y2026 = await readRouteProjection(db, '2026')
      // TBS-IST flew twice out and once back: one pair, undirected, `a` sorts before `b`; two directed rows remain for the list.
      expect(y2026.pairs.find(pair => pair.a === 'IST' && pair.b === 'TBS')).toMatchObject({ count: 3, forward: 1, reverse: 2, aCountry: 'TR', bCountry: 'GE' })
      expect(y2026.routes.filter(route => [route.origin, route.destination].sort().join() === 'IST,TBS').map(route => [route.origin, route.destination, route.count]))
        .toEqual(expect.arrayContaining([['TBS', 'IST', 2], ['IST', 'TBS', 1]]))
      // The upcoming flight never enters the period, as in the summary.
      expect(y2026.pairs.some(pair => pair.b === 'TBS' && pair.a === 'LHR')).toBe(false)
      expect(y2026.schemaVersion).toBe(1)
    } finally { await dispose() }
  })

  it('returns the same period countries and visits as the summary, in every period', async () => {
    const { db, dispose } = await overviewAccount(flights)
    try {
      for (const period of ['all', '2026', '2025']) {
        const summary = await readOverviewScope(db, period === 'all' ? {} : { period: { years: [Number(period)] } })
        const projection = await readRouteProjection(db, period)
        expect(projection.countries?.map(({ id, visits }) => ({ code: id, visits })).sort((a, b) => a.code.localeCompare(b.code))).toEqual([...summary.globe.countries].sort((a, b) => a.code.localeCompare(b.code)))
      }
    } finally { await dispose() }
  })
})

describe('publication metadata and changed revisions', () => {
  it('carries the same stamps as the summary, and both say updating together when a revision changes between reads', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2026-01-10', 'TBS', 'IST')])
    try {
      const before = { payload: await readOverviewPayload(db), projection: await readRouteProjection(db, '2026') }
      expect(before.payload.derivedReady).toBe(true)
      expect(before.projection).toMatchObject({ derivedState: 'ready', countryState: 'ready' })
      expect(before.projection.countries).toHaveLength(2)
      await dirtyUserStatement(db, USER.id).run()
      const during = { payload: await readOverviewPayload(db), projection: await readRouteProjection(db, '2026') }
      expect(during.payload.derivedReady).toBe(false)
      expect(during.payload.etag).not.toBe(before.payload.etag)
      expect(during.projection.revision).toBeGreaterThan(before.projection.revision)
      expect(during.projection).toMatchObject({ derivedState: 'pending', countryState: 'updating', countries: null })
      // Flight geometry still comes back: the list is current, only the country layer is withheld.
      expect(during.projection.pairs).toHaveLength(1)
    } finally { await dispose() }
  })
})

describe('transit suppression is applied by the server', () => {
  const flights: OverviewFlight[] = [
    { id: 1, date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'awaiting', dep: at(T0, -4), arr: T0 },
    logged(2, '2026-03-02', 'IST', 'JFK', { dep: at(T0, 3), arr: at(T0, 12) }),
  ]

  it('does not restore a transit hub on the country layer, while the pair geometry keeps the airport', async () => {
    const { db, dispose } = await overviewAccount(flights)
    try {
      const summary = await readOverviewScope(db, { period: { years: [2026] } })
      const projection = await readRouteProjection(db, '2026')
      expect(projection.countries).toEqual([{ id: 'GE', visits: 1, pending: true }, { id: 'US', visits: 1, pending: false }])
      expect(projection.countries?.map(({ id, visits }) => ({ code: id, visits })).sort((a, b) => a.code.localeCompare(b.code))).toEqual([...summary.globe.countries].sort((a, b) => a.code.localeCompare(b.code)))
      // Rebuilding countries from route endpoints (what the client did) would add TR; the server's set must not.
      const fromEndpoints = new Set(projection.routes.flatMap(route => [route.originCountry, route.destinationCountry]))
      expect(fromEndpoints.has('TR')).toBe(true)
      expect(projection.countries!.map(country => country.id)).not.toContain('TR')
      expect(projection.pairs.map(pair => `${pair.a}-${pair.b}`).sort()).toEqual(['IST-JFK', 'IST-TBS'])
    } finally { await dispose() }
  })

  it('counts the hub when the member left the airport', async () => {
    const { db, dispose } = await overviewAccount([{ ...flights[0], transit: 0 }, flights[1]])
    try {
      expect((await readRouteProjection(db, '2026')).countries!.map(country => country.id)).toEqual(['GE', 'TR', 'US'])
    } finally { await dispose() }
  })
})

describe('bounds and ownership', () => {
  it('an empty account returns empty lists and a ready stamp', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(USER.id, USER.email, 'hash').run()
      expect(await readRouteProjection(db)).toMatchObject({ routeCount: 0, pairs: [], routes: [], countries: [], truncated: false, countryState: 'ready' })
    } finally { await dispose() }
  })

  it('bounds both lists, keeps the exact pair count and says it truncated', async () => {
    const { db, dispose } = await overviewAccount([])
    try {
      await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < ?)
        INSERT INTO flights (user_id,date,origin,destination) SELECT ?, date('2020-01-01', '+' || x || ' days'), 'Z' || x, 'JFK' FROM n`)
        .bind(MAX_PROJECTED_ROUTES + 25, USER.id).run()
      const projection = await readRouteProjection(db)
      expect(projection.routeCount).toBe(MAX_PROJECTED_ROUTES + 25)
      expect(projection.pairs).toHaveLength(MAX_PROJECTED_ROUTES)
      expect(projection.routes).toHaveLength(MAX_PROJECTED_ROUTES)
      expect(projection).toMatchObject({ limit: MAX_PROJECTED_ROUTES, truncated: true })
      expect(projection.pairs[0].lastDate >= projection.pairs[MAX_PROJECTED_ROUTES - 1].lastDate).toBe(true) // newest first
    } finally { await dispose() }
  })

  it('n=500 repeated visits collapse into few pairs and never leak another owner', async () => {
    const { db, dispose } = await overviewAccount([], d => [
      d.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind('other', 'other@example.test', 'hash'),
      d.prepare("INSERT INTO flights (user_id,date,origin,destination) VALUES ('other','2026-01-01','LHR','DXB')"),
      bulkFlights(d, 500, 'TBS', 'JFK'),
    ])
    try {
      const projection = await readRouteProjection(db)
      expect(projection.pairs).toEqual([expect.objectContaining({ a: 'JFK', b: 'TBS', count: 500, forward: 0, reverse: 500 })])
      expect(JSON.stringify(projection)).not.toContain('LHR')
      expect(projection.routeCount).toBe((await readOverviewScope(db)).globe.routes.length)
    } finally { await dispose() }
  })
})
