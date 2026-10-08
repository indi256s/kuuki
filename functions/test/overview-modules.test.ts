// T17 / C6: the Overview summary behind the editorial modules, proven at every data volume and edge the modules
// render: n=0/1/10/500, a zero previous-year baseline, repeated country visits, pending, transit, claim-only,
// legacy-only, missing aircraft and unknown durations. Fixtures live in `overview-fixture.ts` for T18.
import { describe, expect, it } from 'vitest'
import { bulkFlights, legacyOnlyAccount, overviewAccount, readOverviewScope, readOverviewPayload, USER, at, T0, type OverviewFlight } from './overview-fixture'
import { createApiDatabase } from './harness'
import { accountWith } from './country-fixture'
import { readJournal } from '../api/_services/journal'
import { parseFlightFilters, parseSort } from '../api/_lib/flightQuery'
import { journalHref } from '../../apps/next/src/lib/url-state'

const logged = (id: number, date: string, origin: string, destination: string, extra: Partial<OverviewFlight> = {}): OverviewFlight =>
  ({ id, date, origin, destination, state: 'logged', ...extra })

describe('period-specific countries and new countries', () => {
  // GE is first reached in 2024 and visited again in 2025: visits count per period, a repeat is never new again.
  const flights = [
    logged(1, '2024-05-01', 'TBS', 'IST'), // GE, TR
    logged(2, '2025-03-01', 'IST', 'TBS'), // TR, GE again
    logged(3, '2025-04-01', 'TBS', 'KUT'), // GE twice more
    logged(4, '2025-06-01', 'KUT', 'JFK'), // GE, US (first)
  ]

  it('counts canonical visits per period and accumulates repeat visits in all time', async () => {
    const { db, dispose } = await overviewAccount(flights)
    try {
      const y2024 = await readOverviewScope(db, { period: { years: [2024] } })
      expect(y2024.globe.countries).toEqual([{ code: 'GE', visits: 1 }, { code: 'TR', visits: 1 }])
      const y2025 = await readOverviewScope(db, { period: { years: [2025] } })
      expect(y2025.globe.countries).toEqual([{ code: 'GE', visits: 3 }, { code: 'TR', visits: 1 }, { code: 'US', visits: 1 }])
      expect(y2025.figures.countries).toEqual({ value: 3, source: 'by_air' })
      expect((await readOverviewScope(db)).globe.countries.find(country => country.code === 'GE')).toEqual({ code: 'GE', visits: 4 })
    } finally { await dispose() }
  })

  it('keeps legacy-only evidence out of a year but in all time, and never calls it new in a year without flights', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'JFK')], d => [
      d.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
        VALUES ('l',?,'DXB','AE','2019-01-01','2019-01-01',2,'d','archive',1,'{}')`).bind(USER.id),
    ])
    try {
      const all = await readOverviewPayload(db)
      expect(all.passport.countryCodes).toEqual(['AE', 'GE', 'US'])
      for (const year of [2019, 2025]) {
        const scope = await readOverviewScope(db, { period: { years: [year] } })
        expect(scope.globe.countries.map(country => country.code)).not.toContain('AE')
      }
    } finally { await dispose() }
  })

  it('treats a claim-only or ground-only country as collection evidence, not as a flight country', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'JFK')], d => [
      d.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'JP')").bind(USER.id),
      d.prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('g',?,'DE')").bind(USER.id),
    ])
    try {
      expect((await readOverviewPayload(db)).passport.countryCodes).toEqual(['DE', 'GE', 'JP', 'US'])
      for (const filter of [{}, { period: { years: [2025] } }]) {
        const scope = await readOverviewScope(db, filter)
        expect(scope.globe.countries.map(country => country.code).sort()).toEqual(['GE', 'US'])
        expect(scope.figures.countries.value).toBe(filter.period ? 2 : 4)
      }
    } finally { await dispose() }
  })
})

describe('pending and transit countries', () => {
  const flights: OverviewFlight[] = [
    { id: 1, date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'awaiting', dep: at(T0, -4), arr: T0 },
    logged(2, '2026-03-02', 'IST', 'JFK', { dep: at(T0, 3), arr: at(T0, 12) }),
  ]

  it('counts a waiting country in the total with its own number, and suppresses the transit hub everywhere', async () => {
    const { db, dispose } = await overviewAccount(flights)
    try {
      for (const filter of [{}, { period: { years: [2026] } }]) {
        const scope = await readOverviewScope(db, filter)
        expect(scope.globe.countries).toEqual([{ code: 'GE', visits: 1 }, { code: 'US', visits: 1 }])
        expect(scope.figures).toMatchObject({ awaiting: 1, airports: 3 })
      }
    } finally { await dispose() }
  })

  it('counts the hub once the member left the airport', async () => {
    const { db, dispose } = await overviewAccount([{ ...flights[0], transit: 0 }, flights[1]])
    try {
      expect((await readOverviewScope(db, { period: { years: [2026] } })).globe.countries.map(country => country.code).sort()).toEqual(['GE', 'TR', 'US'])
    } finally { await dispose() }
  })

  it('flags pending country publication while keeping flight figures and previous-year totals', async () => {
    const { db, dispose } = await overviewAccount([logged(9, '2025-05-01', 'TBS', 'IST'), ...flights])
    try {
      await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
      expect(await readOverviewPayload(db)).toMatchObject({ derivedReady: false })
      const year = await readOverviewScope(db, { period: { years: [2026] } })
      expect(year.figures).toMatchObject({ flights: 2, deltas: { flights: 1 } })
    } finally { await dispose() }
  })
})

describe('previous-year comparison', () => {
  it('keeps zero previous totals and the first canonical date', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2026-01-10', 'TBS', 'IST', { km: 1000, minutes: 120 })])
    try {
      const first = await readOverviewScope(db, { period: { years: [2026] } })
      expect(first.figures).toMatchObject({ firstDate: '2026-01-10', flights: 1, distanceKm: 1000, durationMinutes: 120,
        deltas: { flights: 0, distanceKm: 0, durationMinutes: 0 } })
    } finally { await dispose() }
  })

  it('keeps earlier canonical history across an empty previous year', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2023-01-10', 'TBS', 'IST'), logged(2, '2026-01-10', 'TBS', 'IST')])
    try {
      const scope = await readOverviewScope(db, { period: { years: [2026] } })
      expect(scope.figures).toMatchObject({ flights: 1, deltas: { flights: 0 } })
      expect((await readOverviewScope(db)).figures.firstDate).toBe('2023-01-10')
    } finally { await dispose() }
  })

  it('provides exact previous totals for growth and decline', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2025-01-01', 'TBS', 'IST', { km: 400 }), logged(2, '2025-02-01', 'IST', 'TBS', { km: 400 }),
      logged(3, '2025-03-01', 'TBS', 'IST', { km: 400 }), logged(4, '2025-04-01', 'IST', 'TBS', { km: 400 }),
      logged(5, '2026-01-01', 'TBS', 'JFK', { km: 300 }),
    ])
    try {
      const scope = await readOverviewScope(db, { period: { years: [2026] } })
      expect(scope.figures).toMatchObject({ flights: 1, distanceKm: 300, countries: { value: 2 },
        deltas: { flights: 4, distanceKm: 1600 } })
    } finally { await dispose() }
  })

  it('never lets upcoming flights into completed period stats', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2026-01-10', 'TBS', 'IST'),
      { id: 2, date: '2026-12-01', origin: 'TBS', destination: 'JFK', state: 'upcoming', awaitingAfter: '2099-01-01T00:00:00.000Z', autoAfter: '2099-02-01T00:00:00.000Z' },
    ])
    try {
      const year = await readOverviewScope(db, { period: { years: [2026] } })
      expect(year.figures).toMatchObject({ flights: 1, countries: { value: 2 } })
      expect(year.figures.byYear.reduce((sum, row) => sum + row.flights, 0)).toBe(1)
      expect(year.globe.countries.map(country => country.code).sort()).toEqual(['GE', 'TR'])
      expect(year.next[0]).toMatchObject({ flightId: 2 })
    } finally { await dispose() }
  })
})

describe('data availability and rankings', () => {
  it('does not present unknown duration, distance or aircraft as zero', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2025-01-01', 'TBS', 'IST', { minutes: 130, km: 900, aircraft: 'A320', airline: 'TK' }),
      logged(2, '2025-02-01', 'IST', 'TBS'),
      logged(3, '2025-03-01', 'TBS', 'IST', { aircraft: 'B738', airline: 'TK', minutes: 0 }),
    ])
    try {
      const scope = await readOverviewScope(db, { period: { years: [2025] } })
      expect(scope.coverage).toMatchObject({ total: 3, typed: 2, preciseDuration: 0 })
      expect(scope.figures.durationMinutes).toBe(130)
      const rows = (await readOverviewPayload(db)).rows
      expect(rows.filter(row => row.durationMinutes !== null)).toHaveLength(2)
      expect(rows.filter(row => row.distanceKm !== null)).toHaveLength(1)
    } finally { await dispose() }
  })

  it('n=1: one flight with nothing optional known', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-01', 'TBS', 'IST')])
    try {
      const scope = await readOverviewScope(db, { period: { years: [2025] } })
      expect(scope.coverage).toMatchObject({ total: 1, typed: 0, preciseDuration: 0 })
      expect(scope.records.status).toBe('below')
      expect(scope.rankings.airlines).toEqual([])
      expect(scope.fleet).toEqual({ status: 'below', have: 0, need: 5 })
      expect(scope.globe.routes).toHaveLength(1)
    } finally { await dispose() }
  })

  it('ranks with stable tie-breaks, groups manufacturers and de-duplicates routes in both directions', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2025-01-01', 'TBS', 'IST', { airline: 'TK', aircraft: 'A320' }),
      logged(2, '2025-01-02', 'IST', 'TBS', { airline: 'PC', aircraft: 'A359' }),
      logged(3, '2025-01-03', 'TBS', 'IST', { airline: 'TK', aircraft: 'B738' }),
      logged(4, '2025-01-04', 'IST', 'TBS', { airline: 'PC', aircraft: 'A320' }),
      logged(5, '2025-01-05', 'TBS', 'JFK', { airline: 'XX' }),
    ])
    try {
      const scope = await readOverviewScope(db, { period: { years: [2025] } })
      expect(scope.rankings.airlines).toEqual([{ key: 'PC', count: 2 }, { key: 'TK', count: 2 }, { key: 'XX', count: 1 }])
      expect(scope.rankings.versus.find(row => row.id === 'makers')).toMatchObject({ left: { key: 'airbus', count: 3 }, right: { key: 'boeing', count: 1 }, excluded: 1 })
      expect(scope.coverage).toMatchObject({ total: 5, typed: 4 })
      expect(scope.rankings.routes[0]).toEqual({ key: 'IST-TBS', count: 4 })
      expect(scope.globe.routes).toHaveLength(2)
    } finally { await dispose() }
  })

  it('lists completed calendar years chronologically, including intervening empty years', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2022-01-01', 'TBS', 'IST'), logged(2, '2024-01-01', 'TBS', 'IST'), logged(3, '2024-06-01', 'TBS', 'IST'),
      { id: 4, date: '2030-01-01', origin: 'TBS', destination: 'IST', state: 'upcoming', awaitingAfter: '2099-01-01T00:00:00.000Z', autoAfter: '2099-02-01T00:00:00.000Z' },
    ])
    try {
      expect((await readOverviewScope(db)).figures.byYear).toEqual([
        { key: '2022', year: 2022, flights: 1 }, { key: '2023', year: 2023, flights: 0 }, { key: '2024', year: 2024, flights: 2 },
      ])
    } finally { await dispose() }
  })

  it('counts catalog regions and awaiting flights separately', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-01', 'TBS', 'JFK'), { id: 2, date: '2025-02-01', origin: 'LHR', destination: 'DXB', state: 'awaiting' }])
    try {
      const scope = await readOverviewScope(db, { period: { years: [2025] } })
      expect(scope.figures).toMatchObject({ countries: { value: 4 }, regions: 3, awaiting: 1 })
      expect((await readOverviewPayload(db)).passport.regions).toBe(2)
    } finally { await dispose() }
  })
})

describe('data volumes', () => {
  it('n=0: an empty account has explicit empty figures, not nulls or errors', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await db.batch([db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(USER.id, USER.email, 'hash')])
      for (const filter of [{}, { period: { years: [2026] } }]) {
        const scope = await readOverviewScope(db, filter)
        expect(scope.figures).toMatchObject({ flights: 0, distanceKm: 0, durationMinutes: 0, countries: { value: 0 }, awaiting: 0 })
        expect(scope.coverage).toMatchObject({ total: 0, typed: 0 })
        expect(scope.globe).toMatchObject({ countries: [], routes: [] })
      }
      expect((await readOverviewPayload(db)).derivedReady).toBe(true)
    } finally { await dispose() }
  })

  it('n=10 and n=500 keep every list bounded and the totals exact', async () => {
    const { db, dispose } = await accountWith([])
    try {
      let prior = 0
      for (const count of [10, 500]) {
        await bulkFlights(db, count - prior, 'TBS', 'JFK').run()
        prior = count
        await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
        const { repairUserDerivedState } = await import('../api/_services/derivedState')
        await repairUserDerivedState(db, USER.id)
        const summary = await readOverviewScope(db)
        expect(summary.figures.flights).toBe(count)
        expect(summary.globe.countries).toEqual([{ code: 'GE', visits: count }, { code: 'US', visits: count }])
        expect(summary.rankings.routes).toHaveLength(1)
        expect(summary.figures.byYear.reduce((sum, row) => sum + row.flights, 0)).toBe(count)
        expect(summary.globe.routes.length).toBe(1)
      }
    } finally { await dispose() }
  })

  it('applies airline and period filters to the whole Overview scope', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2025-01-01', 'TBS', 'IST', { airline: 'TK' }), logged(2, '2025-02-01', 'IST', 'JFK', { airline: 'PC' }),
    ])
    try {
      const filtered = await readOverviewScope(db, { period: { years: [2025] }, airlines: ['TK'] })
      expect(filtered.figures.flights).toBe(1)
      expect(filtered.globe.routes.length).toBe(1)
      expect(filtered.figures.deltas?.flights).toBe(0)
    } finally { await dispose() }
  })
})

describe('Journal destinations of the statistic links (completed scope)', () => {
  it('an upcoming flight in the same year and category never enters the linked Journal total', async () => {
    const flights: OverviewFlight[] = [
      logged(1, '2026-02-01', 'TBS', 'IST', { airline: 'TK', aircraft: 'A320' }),
      logged(2, '2026-03-01', 'TBS', 'IST', { airline: 'TK', aircraft: 'A320' }),
      { id: 3, date: '2026-12-01', origin: 'TBS', destination: 'IST', state: 'upcoming', airline: 'TK', aircraft: 'A320' },
    ]
    const { db, dispose } = await overviewAccount(flights)
    try {
      const summary = await readOverviewScope(db, { period: { years: [2026] } })
      const total = async (href: string) => (await readJournal(db, USER.id, parseFlightFilters(new URL(href, 'https://kuuki.test').searchParams), { field: 'date', order: 'desc' }, 50, 0)).total
      expect(summary.rankings.airlines).toEqual([{ key: 'TK', count: 2 }])
      expect(summary.rankings.routes).toEqual([{ key: 'IST-TBS', count: 2 }])
      expect(await total(journalHref({ airline: 'TK', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ airport: 'IST', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ aircraft: 'A320', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ origin: 'TBS', destination: 'IST', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ year: '2026', status: 'completed' }))).toBe(summary.figures.flights)
      // Without the status the same link would have counted the upcoming flight (the defect the status prevents).
      expect(await total(journalHref({ airline: 'TK', year: '2026' }))).toBe(3)
    } finally { await dispose() }
  })
})

describe('a legacy-only account keeps its real geography', () => {
  it('keeps archived countries in the all-time Passport figure without fabricating canonical globe visits', async () => {
    const { db, dispose } = await legacyOnlyAccount()
    try {
      expect((await readOverviewPayload(db)).passport.countryCodes).toEqual(['AE'])
      const all = await readOverviewScope(db)
      expect(all.figures).toMatchObject({ flights: 0, countries: { value: 1, source: 'passport' } })
      expect(all.globe.countries).toEqual([])
      expect((await readOverviewScope(db, { period: { years: [2019] } })).figures.countries.value).toBe(0)
    } finally { await dispose() }
  })
  it('a genuinely empty account is still first run', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await db.batch([db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(USER.id, USER.email, 'hash')])
      expect((await readOverviewScope(db)).figures.flights).toBe(0)
      expect((await readOverviewPayload(db)).passport.countryCodes).toEqual([])
    } finally { await dispose() }
  })
})

describe('archived-evidence provenance of the all-time country figure', () => {
  const legacyRow = (id: string, contributes: number, airport: string | null = 'DXB') => (d: D1Database) =>
    d.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
      VALUES (?,?,?,'AE','2019-01-01','2019-01-01',2,'d','archive',?,'{}')`).bind(id, USER.id, airport, contributes)

  it('is true for an account with contributing archived evidence, in all time only', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'JFK')], d => [legacyRow('l', 1)(d)])
    try {
      expect((await readOverviewPayload(db)).passport.countryCodes).toContain('AE')
      expect((await readOverviewScope(db, { period: { years: [2025] } })).globe.countries.map(row => row.code)).not.toContain('AE') // a year never reads archived evidence
      expect((await readOverviewScope(db, { airlines: ['TK'] })).figures.countries.value).toBe(0) // nor does a filtered read
    } finally { await dispose() }
  })

  it('is true for a legacy-only account, and false for a canonical-only account', async () => {
    const legacy = await legacyOnlyAccount()
    const canonical = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'IST')])
    try {
      expect((await readOverviewPayload(legacy.db)).passport.countryCodes).toContain('AE')
      const summary = await readOverviewScope(canonical.db)
      expect(summary.figures.countries.value).toBe(2)
      expect((await readOverviewPayload(canonical.db)).passport.countryCodes).not.toContain('AE')
    } finally { await legacy.dispose(); await canonical.dispose() }
  })

  it.each([
    ['ZZZ', 'INVALID', false], // new invalid legacy country is excluded by the projection
    ['DXB', null, true], // reference country fallback
    ['TBS', 'INVALID', true], // a logged unsuppressed canonical airport supplies the effective country
  ])('keeps effective country evidence for archived airport %s (%s)', async (airport, country, expected) => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'IST')], d => [
      d.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
        VALUES ('validity',?,?,?,'2019-01-01','2019-01-01',2,'d','archive',1,'{}')`).bind(USER.id, airport, country),
    ])
    try {
      const summary = await readOverviewScope(db)
      expect((await readOverviewPayload(db)).derivedReady).toBe(true)
      expect((await readOverviewPayload(db)).passport.countryCodes.includes(airport === 'TBS' ? 'GE' : 'AE')).toBe(expected)
      if (!expected) expect(summary.figures.countries.value).toBe(2)
    } finally { await dispose() }
  })

  it.each([
    ['INVALID', 'JP', 2, false],
    ['JP', 'INVALID', 2, true],
    ['INVALID', 'JP', 0, false],
  ])('duplicate archive airport keeps first country %s before %s', async (first, second, firstCount, expected) => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'IST')], d => [
      // Source ids sort opposite to insertion: country ownership follows read order, not source id.
      ...[['z-first', first, firstCount], ['a-second', second, 3]].map(([id, country, count]) =>
        d.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
          VALUES (?,?,'ZZZ',?,'2019-01-01','2019-01-01',?,'d','archive',1,'{}')`).bind(id, USER.id, country, count)),
    ])
    try {
      const summary = await readOverviewScope(db)
      expect((await readOverviewPayload(db)).derivedReady).toBe(true)
      expect((await readOverviewPayload(db)).passport.countryCodes.includes('JP')).toBe(expected)
      expect(summary.globe.countries.map(row => row.code)).not.toContain('JP')
    } finally { await dispose() }
  })

  it('ignores archived rows that do not contribute or belong to another owner', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'IST')], d => [
      legacyRow('quiet', 0)(d),
      d.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind('other', 'other@example.test', 'hash'),
      d.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
        VALUES ('theirs','other','DXB','AE','2019-01-01','2019-01-01',2,'d','archive',1,'{}')`),
    ])
    try {
      expect((await readOverviewPayload(db)).passport.countryCodes).not.toContain('AE')
      const { repairUserDerivedState } = await import('../api/_services/derivedState')
      await repairUserDerivedState(db, 'other')
      expect((await readOverviewPayload(db, { id: 'other', email: 'other@example.test' })).passport.countryCodes).toEqual(['AE'])
    } finally { await dispose() }
  })
})

describe('Journal missing parameter compatibility', () => {
  it('leaves the Journal alone: `?missing=aircraft` is not a Journal filter, so the total stays unfiltered', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2026-01-10', 'TBS', 'IST'),
      logged(2, '2026-03-10', 'TBS', 'IST', { aircraft: 'A320' }),
    ])
    try {
      const run = async (query: string) => {
        const params = new URLSearchParams(query)
        const filters = parseFlightFilters(params)
        return { filters, total: (await readJournal(db, USER.id, filters, parseSort(params), 20, 0)).total }
      }
      for (const query of ['status=completed&missing=aircraft', 'missing=aircraft', 'missing=bogus', 'missing=aircraft&missing=bogus']) {
        const result = await run(query)
        expect(result.total).toBe(2)
        expect(result.filters).not.toHaveProperty('missingAircraft')
      }
      expect((await run('status=completed&missing=aircraft')).filters).toEqual({ status: 'completed' })
    } finally { await dispose() }
  })
})
