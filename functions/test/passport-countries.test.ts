// T08 / ADR 0001 §4: Passport DTOs make pending fields and pressed-country identity explicit, and country detail
// explains every contributing flight and legacy source from the same policy that published the projection.
import { describe, expect, it } from 'vitest'
import { apiContext } from './harness'
import { accountWith, at, T0, USER, userStats, type FixtureFlight } from './country-fixture'
import { onRequestGet as listCountries } from '../api/passport/countries/index'
import { onRequestGet as countryStats } from '../api/passport/countries/[cc]/stats'
import { onRequestGet as getOverview } from '../api/me/overview'
import { repairUserDerivedState } from '../api/_services/derivedState'

const FLIGHTS: FixtureFlight[] = [
  { id: 1, date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'awaiting', dep: at(T0, -4), arr: T0 },
  { id: 2, date: '2026-03-02', origin: 'IST', destination: 'JFK', state: 'logged', dep: at(T0, 3), arr: at(T0, 12) },
  { id: 3, date: '2026-03-10', origin: 'KUT', destination: 'LHR', state: 'awaiting' },
]
const extra = (db: D1Database) => [
  db.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'JP')").bind(USER.id),
  db.prepare("INSERT INTO ground_visits (id,user_id,country_code,visit_year,entry_method) VALUES ('g',?,'DE',2024,'land')").bind(USER.id),
  db.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,city,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
    VALUES ('l',?,'SVO','RU','Moscow','2019-01-01','2019-02-01',2,'d','archive',1,'{}')`).bind(USER.id),
]

const ctx = (db: D1Database, path: string, cc?: string) => ({ ...apiContext(db, new Request(`https://kuuki.test${path}`)), data: { user: USER }, params: cc ? { cc } : {} } as never)
const list = async (db: D1Database) => (await listCountries(ctx(db, '/api/passport/countries'))).json() as Promise<Record<string, any>>
const detail = async (db: D1Database, cc: string) => (await countryStats(ctx(db, `/api/passport/countries/${cc}/stats`, cc))).json() as Promise<Record<string, any>>

describe('Passport country list', () => {
  it('states pressed or pending per country and keeps the counts apart', async () => {
    const { db, dispose } = await accountWith(FLIGHTS, extra)
    try {
      const body = await list(db)
      const byCode = Object.fromEntries(body.countries.map((row: any) => [row.country_code, row]))
      expect(Object.keys(byCode).sort()).toEqual(['DE', 'GB', 'GE', 'JP', 'RU', 'US']) // no hub (TR)
      expect(byCode.US).toMatchObject({ status: 'pressed', logged_visit_count: 1, awaiting_visit_count: 0, claimed: 0, ground_visit_count: 0 })
      expect(byCode.GB).toMatchObject({ status: 'pending', logged_visit_count: 0, awaiting_visit_count: 1 })
      expect(byCode.GE).toMatchObject({ status: 'pending', awaiting_visit_count: 2 })
      expect(byCode.JP).toMatchObject({ status: 'pressed', claimed: 1 })
      expect(byCode.DE).toMatchObject({ status: 'pressed', ground_visit_count: 1 })
      expect(byCode.RU).toMatchObject({ status: 'pressed', logged_visit_count: 2 })
      // Pending-only countries never enter the pressed collection count; the flight-country figure includes them.
      expect(body).toMatchObject({ pressedCountryCount: 4, pendingCountryCount: 2, flightCountryCount: 4, derivedState: 'ready' })
      expect(body.regionPolicyVersion).toBe(1)
      expect(body.regions).toHaveLength(6)
      expect(body.regions.find((row: any) => row.id === 'asia')).toMatchObject({ pressed: 2, pending: 1 }) // JP, RU pressed; GE pending
      expect(body.regions.find((row: any) => row.id === 'europe')).toMatchObject({ pressed: 1, pending: 1 }) // DE pressed; GB pending
      // The airport aggregate is untouched: the transit airport still counts.
      expect(body.visits.map((row: any) => row.airport_iata)).toContain('IST')
      expect(body.claims).toHaveLength(1)
      expect(body.groundVisits).toHaveLength(1)
    } finally { await dispose() }
  })

  it('agrees with user_stats and Overview on the flight-country definition', async () => {
    const { db, dispose } = await accountWith(FLIGHTS, extra)
    try {
      const body = await list(db)
      const flightCountries = body.countries.filter((row: any) => row.logged_visit_count + row.awaiting_visit_count > 0).map((row: any) => row.country_code)
      expect(body.flightCountryCount).toBe(flightCountries.length)
      expect(await userStats(db)).toMatchObject({ countries_count: body.flightCountryCount })
      const overview = await (await getOverview({ ...apiContext(db, new Request('https://kuuki.test/api/me/overview?period=all')), data: { user: USER } } as never)).json() as any
      expect(overview.countryIds).toEqual(flightCountries)
      expect(overview.totals.countries).toBe(body.flightCountryCount)
    } finally { await dispose() }
  })

  it('reports derivedState pending while a repair is outstanding', async () => {
    const { db, dispose } = await accountWith(FLIGHTS, extra)
    try {
      await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
      expect(await list(db)).toMatchObject({ derivedState: 'pending' })
      await repairUserDerivedState(db, USER.id)
      expect(await list(db)).toMatchObject({ derivedState: 'ready' })
    } finally { await dispose() }
  })
})

describe('Passport country detail', () => {
  it('lists contributing flight IDs and full visit entries for a pressed country', async () => {
    const { db, dispose } = await accountWith(FLIGHTS, extra)
    try {
      expect(await detail(db, 'US')).toMatchObject({
        countryCode: 'US', status: 'pressed', flightIds: [2], derivedState: 'ready', firstVisit: '2026-03-02', lastVisit: '2026-03-02', totalVisits: 1,
        entries: [{ kind: 'flight', flightId: 2, endpoint: 'destination', airport: 'JFK', date: '2026-03-02', state: 'logged' }],
        airports: [{ iata: 'JFK', city: 'JFK city', visitCount: 1 }], suppressed: [],
      })
    } finally { await dispose() }
  })

  it('keeps a pending-only country unpressed and says why', async () => {
    const { db, dispose } = await accountWith(FLIGHTS, extra)
    try {
      expect(await detail(db, 'GB')).toMatchObject({ status: 'pending', flightIds: [3], entries: [{ kind: 'flight', flightId: 3, endpoint: 'destination', state: 'awaiting' }] })
      expect(await detail(db, 'GE')).toMatchObject({ status: 'pending', flightIds: [1, 3] })
    } finally { await dispose() }
  })

  it('explains a transit-suppressed country: no evidence, but the suppressed endpoints and the airport statistic remain', async () => {
    const { db, dispose } = await accountWith(FLIGHTS, extra)
    try {
      const body = await detail(db, 'TR')
      expect(body).toMatchObject({ status: 'none', flightIds: [], entries: [], totalVisits: 0, isClaimed: false })
      expect(body.suppressed).toEqual([
        { flightId: 1, endpoint: 'destination', airport: 'IST' }, { flightId: 2, endpoint: 'origin', airport: 'IST' }])
    } finally { await dispose() }
  })

  it('explains legacy, claim and ground evidence where no flight exists', async () => {
    const { db, dispose } = await accountWith(FLIGHTS, extra)
    try {
      expect(await detail(db, 'RU')).toMatchObject({ status: 'pressed', flightIds: [], totalVisits: 2,
        entries: [{ kind: 'legacy', airport: 'SVO', visitCount: 2, firstVisit: '2019-01-01', lastVisit: '2019-02-01', provenance: 'archive', explanation: 'archived_counter', flightCount: 0 }] })
      expect(await detail(db, 'JP')).toMatchObject({ status: 'pressed', isClaimed: true, flightIds: [], entries: [{ kind: 'claim' }] })
      expect(await detail(db, 'DE')).toMatchObject({ status: 'pressed', flightIds: [], totalVisits: 1,
        entries: [{ kind: 'ground', id: 'g', visitYear: 2024, entryMethod: 'land' }] })
    } finally { await dispose() }
  })

  it('counts a country supported elsewhere as pressed even when one endpoint is suppressed', async () => {
    const { db, dispose } = await accountWith([...FLIGHTS, { id: 4, date: '2025-01-01', origin: 'TBS', destination: 'ADB', state: 'logged' }], extra)
    try {
      const body = await detail(db, 'TR')
      expect(body).toMatchObject({ status: 'pressed', flightIds: [4], entries: [{ kind: 'flight', flightId: 4, endpoint: 'destination', airport: 'ADB' }] })
      expect(body.suppressed).toHaveLength(2)
    } finally { await dispose() }
  })
})
