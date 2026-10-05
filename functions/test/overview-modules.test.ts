// T17 / C6: the Overview summary behind the editorial modules, proven at every data volume and edge the modules
// render: n=0/1/10/500, a zero previous-year baseline, repeated country visits, pending, transit, claim-only,
// legacy-only, missing aircraft and unknown durations. Fixtures live in `overview-fixture.ts` for T18.
import { describe, expect, it } from 'vitest'
import { bulkFlights, overviewAccount, readOverviewSummary, USER, at, T0, type OverviewFlight } from './overview-fixture'
import { createApiDatabase } from './harness'
import { accountWith } from './country-fixture'

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

  it('counts visits per period and keeps repeats out of the new-country list', async () => {
    const { db, dispose } = await overviewAccount(flights)
    try {
      const y2024 = await readOverviewSummary(db, 'period=2024')
      expect(y2024.map.countries).toEqual([{ id: 'GE', visits: 1, pending: false }, { id: 'TR', visits: 1, pending: false }])
      expect(y2024.insights.newCountries).toEqual({ count: 2, items: [{ id: 'GE', firstVisit: '2024-05-01', pending: false }, { id: 'TR', firstVisit: '2024-05-01', pending: false }] })

      const y2025 = await readOverviewSummary(db, 'period=2025')
      expect(y2025.map.countries).toEqual([{ id: 'GE', visits: 4, pending: false }, { id: 'TR', visits: 1, pending: false }, { id: 'US', visits: 1, pending: false }])
      expect(y2025.totals.countries).toBe(3)
      expect(y2025.insights.newCountries).toEqual({ count: 1, items: [{ id: 'US', firstVisit: '2025-06-01', pending: false }] })
      expect(y2025.countryIds).toEqual(['GE', 'TR', 'US']) // the legacy field stays the map's id list

      const all = await readOverviewSummary(db)
      expect(all.map.countries.find(country => country.id === 'GE')).toEqual({ id: 'GE', visits: 5, pending: false })
      expect(all.insights.newCountries).toBeNull() // every country is new in all time; the section is year-only
      expect(all.comparison).toBeNull()
    } finally { await dispose() }
  })

  it('keeps legacy-only evidence out of a year but in all time, and never calls it new in a year without flights', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'JFK')], d => [
      d.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
        VALUES ('l',?,'DXB','AE','2019-01-01','2019-01-01',2,'d','archive',1,'{}')`).bind(USER.id),
    ])
    try {
      const all = await readOverviewSummary(db)
      expect(all.map.countries.map(country => country.id)).toEqual(['AE', 'GE', 'US'])
      expect(all.map.countries.find(country => country.id === 'AE')?.visits).toBe(2)
      for (const year of ['2019', '2025']) {
        const summary = await readOverviewSummary(db, `period=${year}`)
        expect(summary.map.countries.map(country => country.id)).not.toContain('AE')
        expect(summary.insights.newCountries?.items.map(item => item.id)).not.toContain('AE')
      }
    } finally { await dispose() }
  })

  it('treats a claim-only or ground-only country as collection evidence, not as a flight country', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'JFK')], d => [
      d.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'JP')").bind(USER.id),
      d.prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('g',?,'DE')").bind(USER.id),
    ])
    try {
      for (const query of ['period=all', 'period=2025']) {
        const summary = await readOverviewSummary(db, query)
        expect(summary.map.countries.map(country => country.id)).toEqual(['GE', 'US'])
        expect(summary.totals.countries).toBe(2)
        expect(summary.regions?.reduce((sum, region) => sum + region.pressed, 0)).toBe(2)
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
      for (const query of ['period=all', 'period=2026']) {
        const summary = await readOverviewSummary(db, query)
        expect(summary.map.countries).toEqual([{ id: 'GE', visits: 1, pending: true }, { id: 'US', visits: 1, pending: false }])
        expect(summary.totals).toMatchObject({ countries: 2, pendingCountries: 1, airports: 3 }) // IST remains an airport
        expect(summary.regions?.reduce((sum, region) => ({ pressed: sum.pressed + region.pressed, pending: sum.pending + region.pending }), { pressed: 0, pending: 0 }))
          .toEqual({ pressed: 1, pending: 1 })
      }
      const year = await readOverviewSummary(db, 'period=2026')
      expect(year.insights.newCountries?.items).toEqual([{ id: 'GE', firstVisit: '2026-03-01', pending: true }, { id: 'US', firstVisit: '2026-03-02', pending: false }])
    } finally { await dispose() }
  })

  it('counts the hub once the member left the airport', async () => {
    const { db, dispose } = await overviewAccount([{ ...flights[0], transit: 0 }, flights[1]])
    try {
      expect((await readOverviewSummary(db, 'period=2026')).map.countries.map(country => country.id)).toEqual(['GE', 'TR', 'US'])
    } finally { await dispose() }
  })

  it('withholds every country figure while the repair is pending, but keeps flight figures and previous-year flight deltas', async () => {
    const { db, dispose } = await overviewAccount([logged(9, '2025-05-01', 'TBS', 'IST'), ...flights])
    try {
      await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
      const year = await readOverviewSummary(db, 'period=2026')
      expect(year).toMatchObject({ countryState: 'updating', derivedState: 'pending', map: { countries: [] }, regions: null })
      expect(year.totals).toMatchObject({ flights: 2, countries: null, continents: null, pendingCountries: null })
      expect(year.insights.newCountries).toBeNull()
      expect(year.comparison).toMatchObject({ flights: { previous: 1, delta: 1, percent: 100 }, countries: null })
    } finally { await dispose() }
  })
})

describe('previous-year comparison', () => {
  it('omits the percentage when the previous value is zero, and says whether this is the first year', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2026-01-10', 'TBS', 'IST', { km: 1000, minutes: 120 })])
    try {
      const first = await readOverviewSummary(db, 'period=2026')
      expect(first.comparison).toMatchObject({ previousPeriod: '2025', firstYear: true,
        flights: { previous: 0, delta: 1, percent: null }, distanceKm: { previous: 0, delta: 1000, percent: null },
        durationMinutes: { previous: 0, delta: 120, percent: null }, countries: { previous: 0, delta: 2, percent: null } })
    } finally { await dispose() }
  })

  it('is not a first year when flights exist before an empty previous year', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2023-01-10', 'TBS', 'IST'), logged(2, '2026-01-10', 'TBS', 'IST')])
    try {
      expect((await readOverviewSummary(db, 'period=2026')).comparison).toMatchObject({ firstYear: false, flights: { previous: 0, percent: null } })
    } finally { await dispose() }
  })

  it('rounds growth and decline to whole percents, with countries compared on the same policy', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2025-01-01', 'TBS', 'IST', { km: 400 }), logged(2, '2025-02-01', 'IST', 'TBS', { km: 400 }),
      logged(3, '2025-03-01', 'TBS', 'IST', { km: 400 }), logged(4, '2025-04-01', 'IST', 'TBS', { km: 400 }),
      logged(5, '2026-01-01', 'TBS', 'JFK', { km: 300 }),
    ])
    try {
      const comparison = (await readOverviewSummary(db, 'period=2026')).comparison
      expect(comparison?.flights).toEqual({ previous: 4, delta: -3, percent: -75 })
      expect(comparison?.distanceKm).toEqual({ previous: 1600, delta: -1300, percent: -81 })
      expect(comparison?.countries).toEqual({ previous: 2, delta: 0, percent: 0 })
    } finally { await dispose() }
  })

  it('never lets upcoming flights into completed period stats', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2026-01-10', 'TBS', 'IST'),
      { id: 2, date: '2026-12-01', origin: 'TBS', destination: 'JFK', state: 'upcoming', awaitingAfter: '2099-01-01T00:00:00.000Z', autoAfter: '2099-02-01T00:00:00.000Z' },
    ])
    try {
      const year = await readOverviewSummary(db, 'period=2026')
      expect(year.totals).toMatchObject({ flights: 1, upcomingFlights: 1, countries: 2 })
      expect(year.months.reduce((sum, month) => sum + month.flights, 0)).toBe(1)
      expect(year.map.countries.map(country => country.id)).toEqual(['GE', 'TR'])
      expect(year.nextFlight).toMatchObject({ id: 2 })
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
      const summary = await readOverviewSummary(db, 'period=2025')
      expect(summary.dataAvailability).toEqual({ flights: 3, durationKnown: 2, distanceKnown: 1, missingAircraft: 1 })
      expect(summary.totals.durationMinutes).toBe(130)
    } finally { await dispose() }
  })

  it('n=1: one flight with nothing optional known', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-01', 'TBS', 'IST')])
    try {
      const summary = await readOverviewSummary(db, 'period=2025')
      expect(summary.dataAvailability).toEqual({ flights: 1, durationKnown: 0, distanceKnown: 0, missingAircraft: 1 })
      expect(summary.insights).toMatchObject({ longestFlight: null, favoriteAirline: null, mostFrequentRoute: { origin: 'TBS', destination: 'IST', count: 1 } })
      expect(summary.topLists).toMatchObject({ airlines: [], aircraft: [], manufacturers: [] })
      expect(summary.map).toMatchObject({ routeCount: 1 })
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
      const summary = await readOverviewSummary(db, 'period=2025')
      // TK and PC tie at two flights: the lower IATA wins every time.
      expect(summary.topLists.airlines).toEqual([{ id: 'PC', count: 2 }, { id: 'TK', count: 2 }, { id: 'XX', count: 1 }])
      expect(summary.insights.favoriteAirline).toEqual({ id: 'PC', count: 2 })
      expect(summary.topLists.aircraft).toEqual([{ id: 'A320', count: 2 }, { id: 'A359', count: 1 }, { id: 'B738', count: 1 }])
      expect(summary.topLists.manufacturers).toEqual([{ id: 'Airbus', count: 3 }, { id: 'Boeing', count: 1 }])
      expect(summary.dataAvailability.missingAircraft).toBe(1)
      expect(summary.insights.mostFrequentRoute).toEqual({ origin: 'IST', destination: 'TBS', count: 2 }) // direction kept, tie by origin code
      expect(summary.map.routeCount).toBe(2) // TBS-IST (both directions) and TBS-JFK
    } finally { await dispose() }
  })

  it('lists the calendar years with completed flights, newest first', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2022-01-01', 'TBS', 'IST'), logged(2, '2024-01-01', 'TBS', 'IST'), logged(3, '2024-06-01', 'TBS', 'IST'),
      { id: 4, date: '2030-01-01', origin: 'TBS', destination: 'IST', state: 'upcoming', awaitingAfter: '2099-01-01T00:00:00.000Z', autoAfter: '2099-02-01T00:00:00.000Z' },
    ])
    try {
      expect((await readOverviewSummary(db)).years).toEqual([2024, 2022])
    } finally { await dispose() }
  })

  it('splits the six collection regions into pressed and pending without counting claims', async () => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-01', 'TBS', 'JFK'), { id: 2, date: '2025-02-01', origin: 'LHR', destination: 'DXB', state: 'awaiting' }])
    try {
      const regions = (await readOverviewSummary(db, 'period=2025')).regions!
      expect(regions).toHaveLength(6)
      expect(Object.fromEntries(regions.map(region => [region.id, [region.pressed, region.pending]]))).toMatchObject({ asia: [1, 1], americas: [1, 0] })
      expect(regions.every(region => region.total > 0)).toBe(true)
    } finally { await dispose() }
  })
})

describe('data volumes', () => {
  it('n=0: an empty account has explicit empty figures, not nulls or errors', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await db.batch([db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(USER.id, USER.email, 'hash')])
      for (const query of ['period=all', 'period=2026']) {
        const summary = await readOverviewSummary(db, query)
        expect(summary.totals).toMatchObject({ flights: 0, distanceKm: 0, durationMinutes: 0, countries: 0, pendingCountries: 0, upcomingFlights: 0 })
        expect(summary.dataAvailability).toEqual({ flights: 0, durationKnown: 0, distanceKnown: 0, missingAircraft: 0 })
        expect(summary).toMatchObject({ map: { countries: [], routeCount: 0 }, years: [], countryState: 'ready' })
        expect(summary.regions).toHaveLength(6)
      }
      expect((await readOverviewSummary(db, 'period=2026')).comparison).toMatchObject({ firstYear: true, flights: { previous: 0, delta: 0, percent: null } })
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
        const summary = await readOverviewSummary(db)
        expect(summary.totals.flights).toBe(count)
        expect(summary.map.countries).toEqual([{ id: 'GE', visits: count, pending: false }, { id: 'US', visits: count, pending: false }])
        for (const list of Object.values(summary.topLists)) expect(list.length).toBeLessThanOrEqual(5)
        expect(summary.months).toHaveLength(12)
        expect(summary.map.routeCount).toBe(1)
      }
    } finally { await dispose() }
  })

  it('applies obsolete filters only for the legacy Vite caller and keeps the new fields coherent with them', async () => {
    const { db, dispose } = await overviewAccount([
      logged(1, '2025-01-01', 'TBS', 'IST', { airline: 'TK' }), logged(2, '2025-02-01', 'IST', 'JFK', { airline: 'PC' }),
    ])
    try {
      const filtered = await readOverviewSummary(db, 'period=2025&airline=TK')
      expect(filtered.totals.flights).toBe(1)
      expect(filtered.map.routeCount).toBe(1)
      expect(filtered.comparison?.flights).toEqual({ previous: 0, delta: 1, percent: null })
    } finally { await dispose() }
  })
})
