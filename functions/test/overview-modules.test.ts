// T17 / C6: the Overview summary behind the editorial modules, proven at every data volume and edge the modules
// render: n=0/1/10/500, a zero previous-year baseline, repeated country visits, pending, transit, claim-only,
// legacy-only, missing aircraft and unknown durations. Fixtures live in `overview-fixture.ts` for T18.
import { describe, expect, it } from 'vitest'
import { bulkFlights, legacyOnlyAccount, missingAircraftStatus, overviewAccount, readMissingAircraftPage, readOverviewSummary, USER, at, T0, type OverviewFlight } from './overview-fixture'
import { createApiDatabase } from './harness'
import { accountWith } from './country-fixture'
import { readJournal } from '../api/_services/journal'
import { parseFlightFilters, parseSort } from '../api/_lib/flightQuery'
import { overviewMode } from '../../apps/next/src/client/overview/model'
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

describe('Journal destinations of the statistic links (completed scope)', () => {
  it('an upcoming flight in the same year and category never enters the linked Journal total', async () => {
    const flights: OverviewFlight[] = [
      logged(1, '2026-02-01', 'TBS', 'IST', { airline: 'TK', aircraft: 'A320' }),
      logged(2, '2026-03-01', 'TBS', 'IST', { airline: 'TK', aircraft: 'A320' }),
      { id: 3, date: '2026-12-01', origin: 'TBS', destination: 'IST', state: 'upcoming', airline: 'TK', aircraft: 'A320' },
    ]
    const { db, dispose } = await overviewAccount(flights)
    try {
      const summary = await readOverviewSummary(db, 'period=2026')
      const total = async (href: string) => (await readJournal(db, USER.id, parseFlightFilters(new URL(href, 'https://kuuki.test').searchParams), { field: 'date', order: 'desc' }, 50, 0)).total
      expect(summary.topLists.airlines).toEqual([{ id: 'TK', count: 2 }])
      expect(summary.insights.mostFrequentRoute).toMatchObject({ origin: 'TBS', destination: 'IST', count: 2 })
      expect(await total(journalHref({ airline: 'TK', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ airport: 'IST', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ aircraft: 'A320', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ origin: 'TBS', destination: 'IST', year: '2026', status: 'completed' }))).toBe(2)
      expect(await total(journalHref({ year: '2026', status: 'completed' }))).toBe(summary.totals.flights)
      // Without the status the same link would have counted the upcoming flight (the defect the status prevents).
      expect(await total(journalHref({ airline: 'TK', year: '2026' }))).toBe(3)
    } finally { await dispose() }
  })
})

describe('a legacy-only account keeps its real geography', () => {
  it('has no flights but published archived countries, and the page classifies it as data, not first run', async () => {
    const { db, dispose } = await legacyOnlyAccount()
    try {
      const all = await readOverviewSummary(db)
      expect(all.totals).toMatchObject({ flights: 0, countries: 1, pendingCountries: 0 })
      expect(all.map.countries).toEqual([{ id: 'AE', visits: 2, pending: false }])
      expect(all.regions?.find(region => region.pressed > 0)).toMatchObject({ pressed: 1 })
      expect(overviewMode(all)).toBe('data')
      // A year has no per-year attribution for archived evidence, so it is an empty year, not data.
      const year = await readOverviewSummary(db, 'period=2019')
      expect(year.totals.countries).toBe(0)
      expect(overviewMode(year)).toBe('empty-year')
    } finally { await dispose() }
  })
  it('a genuinely empty account is still first run', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await db.batch([db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(USER.id, USER.email, 'hash')])
      expect(overviewMode(await readOverviewSummary(db))).toBe('first-run')
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
      expect((await readOverviewSummary(db)).archivedEvidence).toBe(true)
      expect((await readOverviewSummary(db, 'period=2025')).archivedEvidence).toBe(false) // a year never reads archived evidence
      expect((await readOverviewSummary(db, 'period=all&airline=TK')).archivedEvidence).toBe(false) // nor does a filtered read
    } finally { await dispose() }
  })

  it('is true for a legacy-only account, and false for a canonical-only account', async () => {
    const legacy = await legacyOnlyAccount()
    const canonical = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'IST')])
    try {
      expect((await readOverviewSummary(legacy.db)).archivedEvidence).toBe(true)
      const summary = await readOverviewSummary(canonical.db)
      expect(summary.totals.countries).toBe(2)
      expect(summary.archivedEvidence).toBe(false)
    } finally { await legacy.dispose(); await canonical.dispose() }
  })

  it.each([
    ['ZZZ', 'INVALID', false], // new invalid legacy country is excluded by the projection
    ['DXB', null, true], // reference country fallback
    ['TBS', 'INVALID', true], // a logged unsuppressed canonical airport supplies the effective country
  ])('uses the effective country of archived airport %s (%s)', async (airport, country, expected) => {
    const { db, dispose } = await overviewAccount([logged(1, '2025-01-10', 'TBS', 'IST')], d => [
      d.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
        VALUES ('validity',?,?,?,'2019-01-01','2019-01-01',2,'d','archive',1,'{}')`).bind(USER.id, airport, country),
    ])
    try {
      const summary = await readOverviewSummary(db)
      expect(summary.countryState).toBe('ready')
      expect(summary.archivedEvidence).toBe(expected)
      if (!expected) expect(summary.totals.countries).toBe(2)
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
      const summary = await readOverviewSummary(db)
      expect(summary.countryState).toBe('ready')
      expect(summary.archivedEvidence).toBe(expected)
      expect(summary.map.countries.map(row => row.id).includes('JP')).toBe(expected)
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
      expect((await readOverviewSummary(db)).archivedEvidence).toBe(false)
      expect((await readOverviewSummary(db, 'period=all', { id: 'other', email: 'other@example.test' })).archivedEvidence).toBe(true)
    } finally { await dispose() }
  })
})

describe('pressed or pending is the account-wide status, membership is period-specific', () => {
  it('a country whose only flight this year is awaiting stays pressed when another year has it logged', async () => {
    const flights: OverviewFlight[] = [
      logged(1, '2024-05-01', 'TBS', 'JFK'),
      { id: 2, date: '2025-05-01', origin: 'TBS', destination: 'JFK', state: 'awaiting' },
      { id: 3, date: '2025-06-01', origin: 'TBS', destination: 'LHR', state: 'awaiting' },
    ]
    const { db, dispose } = await overviewAccount(flights)
    try {
      const y2025 = await readOverviewSummary(db, 'period=2025')
      expect(y2025.map.countries.find(country => country.id === 'US')).toEqual({ id: 'US', visits: 1, pending: false })
      expect(y2025.map.countries.find(country => country.id === 'GB')).toMatchObject({ pending: true })
      expect(y2025.totals.pendingCountries).toBe(1)
    } finally { await dispose() }
  })
})

describe('missing-aircraft review targets', () => {
  /** The review's real page size, not a helper default: every page of the traversal is read at it. */
  const traverse = async (db: D1Database, period: string) => {
    const pages = []
    let after: string | null = null
    do {
      const page = await readMissingAircraftPage(db, `period=${period}${after ? `&after=${encodeURIComponent(after)}` : ''}`)
      pages.push(page)
      after = page.nextCursor
    } while (after && pages.length < 20)
    return pages
  }
  const ids = (pages: Array<{ flights: Array<{ id: number }> }>) => pages.flatMap(page => page.flights.map(flight => flight.id))

  it('is exactly the set the summary counts: completed, in the period, owned, with no aircraft', async () => {
    const flights: OverviewFlight[] = [
      logged(1, '2026-01-10', 'TBS', 'IST'), // missing
      { id: 2, date: '2026-02-10', origin: 'IST', destination: 'TBS', state: 'awaiting' }, // missing, awaiting counts
      logged(3, '2026-03-10', 'TBS', 'IST', { aircraft: 'A320' }),
      { id: 4, date: '2026-12-10', origin: 'TBS', destination: 'LHR', state: 'upcoming' }, // upcoming never counts
      logged(5, '2025-04-10', 'TBS', 'JFK'), // other year
    ]
    const { db, dispose } = await overviewAccount(flights, d => [
      d.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind('other', 'other@example.test', 'hash'),
      d.prepare("INSERT INTO flights (user_id,date,origin,destination) VALUES ('other','2026-01-01','LHR','DXB')"),
    ])
    try {
      for (const [period, expected] of [['all', [2, 1, 5]], ['2026', [2, 1]], ['2025', [5]]] as const) {
        const summary = await readOverviewSummary(db, `period=${period}`)
        const page = await readMissingAircraftPage(db, `period=${period}`)
        expect(summary.dataAvailability.missingAircraft).toBe(expected.length)
        expect(page.total).toBe(summary.dataAvailability.missingAircraft)
        expect(page.flights.map(flight => flight.id)).toEqual([...expected]) // newest first
        expect(page.nextCursor).toBeNull()
        expect(page.flights[0]).toEqual({ id: expected[0], flight_number: null, airline_iata: null, date: expect.any(String), origin: expect.any(String), destination: expect.any(String) })
      }
    } finally { await dispose() }
  })

  it('traverses more than 100 targets in pages of 100, ending on a null cursor, and equals the counted set', async () => {
    const { db, dispose } = await overviewAccount([], d => [
      bulkFlights(d, 250, 'TBS', 'IST'),
      // Same-day flights: the id tiebreak keeps the order total across a page boundary.
      d.prepare("INSERT INTO flights (user_id,date,origin,destination) SELECT user_id, date, destination, origin FROM flights WHERE date IN ('2020-09-06','2020-09-07')"),
      d.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind('other', 'other@example.test', 'hash'),
      d.prepare("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 130) INSERT INTO flights (user_id,date,origin,destination) SELECT 'other', date('2021-01-01', '+' || x || ' days'), 'LHR', 'DXB' FROM n"),
    ])
    try {
      const summary = await readOverviewSummary(db)
      const expected = (await db.prepare(`SELECT id FROM flights WHERE user_id = ? AND lifecycle_state IN ('awaiting', 'logged') AND aircraft_icao IS NULL
        ORDER BY date DESC, id DESC`).bind(USER.id).all<{ id: number }>()).results.map(row => row.id)
      expect(summary.dataAvailability.missingAircraft).toBe(252)
      const pages = await traverse(db, 'all')
      expect(pages.map(page => page.flights.length)).toEqual([100, 100, 52])
      expect(pages.map(page => page.nextCursor === null)).toEqual([false, false, true])
      expect(pages.every(page => page.limit === 100 && page.total === 252)).toBe(true)
      expect(pages.map(page => page.offset)).toEqual([0, 100, 200])
      expect(ids(pages)).toEqual(expected) // no gap, no repeat, deterministic newest-first order
      expect(new Set(ids(pages)).size).toBe(summary.dataAvailability.missingAircraft)
    } finally { await dispose() }
  })

  it('keeps reaching later flights when the first page stays unidentified, and when earlier rows are saved meanwhile', async () => {
    const { db, dispose } = await overviewAccount([], d => [bulkFlights(d, 230, 'TBS', 'IST')])
    try {
      const first = await readMissingAircraftPage(db) // nothing on it can be identified or saved
      expect(first.flights).toHaveLength(100)
      // Reading again without writes returns the same page, so the continuation, not a retry, is what moves on.
      expect(ids([await readMissingAircraftPage(db)])).toEqual(ids([first]))
      const second = await readMissingAircraftPage(db, `period=all&after=${encodeURIComponent(first.nextCursor!)}`)
      expect(second.flights[0].id).toBeLessThan(first.flights[99].id)
      // Saving a row of the first page between reads neither skips nor repeats a later row.
      await db.prepare("UPDATE flights SET aircraft_icao = 'A320' WHERE id = ?").bind(first.flights[0].id).run()
      const third = await readMissingAircraftPage(db, `period=all&after=${encodeURIComponent(second.nextCursor!)}`)
      expect(third.total).toBe(229)
      expect(third.offset).toBe(199) // the saved row left the set, so one fewer flight precedes the third page
      expect(ids([second, third])).toEqual((await db.prepare(`SELECT id FROM flights WHERE user_id = ? AND aircraft_icao IS NULL AND id < ?
        ORDER BY date DESC, id DESC`).bind(USER.id, first.flights[99].id).all<{ id: number }>()).results.map(row => row.id))
    } finally { await dispose() }
  })

  it('is owner-scoped across pages and rejects a malformed period or cursor', async () => {
    const { db, dispose } = await overviewAccount([], d => [
      d.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind('other', 'other@example.test', 'hash'),
      d.prepare("INSERT INTO flights (user_id,date,origin,destination) VALUES ('other','2026-01-01','LHR','DXB'),('other','2026-01-02','LHR','DXB')"),
      d.prepare("INSERT INTO flights (user_id,date,origin,destination) VALUES (?,'2026-01-03','TBS','IST')").bind(USER.id),
    ])
    try {
      const own = await readMissingAircraftPage(db)
      expect(own.total).toBe(1)
      expect(own.flights).toHaveLength(1)
      const theirs = await readMissingAircraftPage(db, 'period=all', { id: 'other', email: 'other@example.test' })
      expect(theirs.total).toBe(2)
      expect(ids([own]).some(id => ids([theirs]).includes(id))).toBe(false)
      expect(await missingAircraftStatus(db, 'period=20x6')).toBe(400)
      expect(await missingAircraftStatus(db, 'period=all&after=nonsense')).toBe(400)
      expect(await missingAircraftStatus(db, "period=all&after=2026-01-01:1'%20OR%201=1")).toBe(400)
    } finally { await dispose() }
  })

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
