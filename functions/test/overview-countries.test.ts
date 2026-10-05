// T08 / ADR 0001 §4 and A7: Overview counts countries from published data only, in one snapshot with the readiness gate.
import { expect, it } from 'vitest'
import { apiContext } from './harness'
import { accountWith, at, flightStatement, publish, T0, USER, type FixtureFlight } from './country-fixture'
import { onRequestGet as getOverview } from '../api/me/overview'
import { repairUserDerivedState } from '../api/_services/derivedState'
import { regionCount } from '../api/_lib/regions'
import { onRequestGet as listPassport } from '../api/passport/countries/index'
import type { OverviewSummary } from '../../packages/shared/src/overview'

const F1: FixtureFlight = { id: 1, date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'awaiting', dep: at(T0, -4), arr: T0 }
const F2: FixtureFlight = { id: 2, date: '2026-03-02', origin: 'IST', destination: 'JFK', state: 'logged', dep: at(T0, 3), arr: at(T0, 12) }

async function read(db: D1Database, query = 'period=all'): Promise<OverviewSummary> {
  const response = await getOverview({ ...apiContext(db, new Request(`https://kuuki.test/api/me/overview?${query}`)), data: { user: USER } } as never)
  expect(response.status).toBe(200)
  return response.json() as Promise<OverviewSummary>
}

const claimsAndLegacy = (db: D1Database) => [
  db.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'JP')").bind(USER.id),
  db.prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('g',?,'DE')").bind(USER.id),
  db.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
    VALUES ('l',?,'SVO','RU','2019-01-01','2019-01-01',1,'d','archive',1,'{}')`).bind(USER.id),
]

it('reads all-time countries from the published projection: flight and legacy countries, no claims, no suppressed hub', async () => {
  const { db, dispose } = await accountWith([F1, F2], claimsAndLegacy)
  try {
    const all = await read(db)
    expect(all).toMatchObject({ derivedState: 'ready', countryState: 'ready' })
    expect(all.countryIds).toEqual(['GE', 'RU', 'US'])
    expect(all.totals).toMatchObject({ countries: 3, airports: 3, flights: 2 }) // IST stays in the airport figure
    expect(all.totals.continents).toBe(regionCount(['GE', 'RU', 'US'])) // six-region catalog model, not continentOf7
  } finally { await dispose() }
})

it('reads a year from canonical endpoints minus the published suppressions, legacy staying out', async () => {
  const { db, dispose } = await accountWith([F1, F2], claimsAndLegacy)
  try {
    const year = await read(db, 'period=2026')
    expect(year.countryState).toBe('ready')
    expect(year.countryIds).toEqual(['GE', 'US'])
    expect(year.totals.countries).toBe(2)
    expect(year.topLists.countries).toEqual([{ id: 'GE', count: 1 }, { id: 'US', count: 1 }])
    const filtered = await read(db, 'period=all&origin=IST')
    expect(filtered.countryIds).toEqual(['US']) // IST as an origin is suppressed on leg 2; its destination JFK counts
  } finally { await dispose() }
})

it('counts the hub again when the member left the airport, with no mixed figure', async () => {
  const { db, dispose } = await accountWith([{ ...F1, transit: 0 }, F2])
  try {
    expect((await read(db, 'period=2026')).countryIds).toEqual(['GE', 'TR', 'US'])
    expect((await read(db)).countryIds).toEqual(['GE', 'TR', 'US'])
  } finally { await dispose() }
})

it('A7: returns updating, never a mixed figure, while a repair is pending', async () => {
  const { db, dispose } = await accountWith([F1, F2])
  try {
    await flightStatement(db, { id: 3, date: '2026-03-03', origin: 'JFK', destination: 'LHR', state: 'logged' }).run()
    await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
    for (const query of ['period=all', 'period=2026']) {
      const pending = await read(db, query)
      expect(pending).toMatchObject({ derivedState: 'pending', countryState: 'updating', countryIds: [] })
      expect(pending.totals).toMatchObject({ countries: null, continents: null, flights: 3 })
      expect(pending.topLists.countries).toEqual([])
    }
    await repairUserDerivedState(db, USER.id)
    expect((await read(db)).countryIds).toEqual(['GB', 'GE', 'US'])
  } finally { await dispose() }
})

it('A7: after an old edit and an old repair leave the evidence stamp stale, Overview is updating until the repair runs', async () => {
  const { db, dispose } = await accountWith([{ ...F1, state: 'logged', source: 'user', transit: 1, leg: 2 }, F2])
  try {
    expect((await read(db, 'period=2026')).countryIds).toEqual(['GE', 'US'])
    // A build below the rollback floor publishes the revision without the evidence stamp.
    await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
    await db.prepare('UPDATE user_derived_state SET published_revision = revision WHERE user_id = ?').bind(USER.id).run()
    const stale = await read(db, 'period=2026')
    expect(stale).toMatchObject({ derivedState: 'pending', countryState: 'updating', countryIds: [] })
    expect(stale.totals.countries).toBeNull()
    expect(await repairUserDerivedState(db, USER.id)).toMatchObject({ derived_state: 'ready' })
    expect(await read(db, 'period=2026')).toMatchObject({ derivedState: 'ready', countryState: 'ready', countryIds: ['GE', 'US'] })
  } finally { await dispose() }
})

it('does not serve a stale suppression for a changed route even if the published row is still there', async () => {
  const { db, dispose } = await accountWith([{ ...F1, state: 'logged', source: 'user', transit: 1, leg: 2 }, F2])
  try {
    // Old route edit: the decision is cleared by the adapter, the published suppression remains until a repair.
    await db.prepare("UPDATE flights SET destination = 'LHR' WHERE id = 1").run()
    await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
    await db.prepare('UPDATE user_derived_state SET published_revision = revision WHERE user_id = ?').bind(USER.id).run()
    expect((await read(db, 'period=2026')).countryState).toBe('updating')
    await publish(db)
    expect((await read(db, 'period=2026')).countryIds).toEqual(['GB', 'GE', 'TR', 'US'])
  } finally { await dispose() }
})

it('A7: Overview and Passport agree before and after the confirmation write, and during a pending repair', async () => {
  const { db, dispose } = await accountWith([F1, F2])
  try {
    const passport = async () => (await listPassport({ ...apiContext(db, new Request('https://kuuki.test/api/passport/countries')), data: { user: USER } } as never)).json() as Promise<any>
    const agree = async () => {
      const [overview, collection] = [await read(db), await passport()]
      if (collection.derivedState !== 'ready') {
        // Passport flags its last published rows as not current; Overview withholds its country figures.
        expect(overview).toMatchObject({ countryState: 'updating', countryIds: [] })
        return { countries: [] as string[], pressed: -1, pending: -1 }
      }
      const flightCountries = collection.countries.filter((row: any) => row.logged_visit_count + row.awaiting_visit_count > 0).map((row: any) => row.country_code)
      expect(overview.countryState).toBe('ready')
      expect(overview.countryIds).toEqual(flightCountries)
      expect(overview.totals.countries).toBe(collection.flightCountryCount)
      return { countries: overview.countryIds, pressed: collection.pressedCountryCount, pending: collection.pendingCountryCount }
    }
    const before = await agree()
    expect(before).toEqual({ countries: ['GE', 'US'], pressed: 1, pending: 1 }) // GE pending (awaiting origin), US pressed (logged)
    await db.prepare("UPDATE flights SET lifecycle_state='logged', confirmation_source='user', confirmed_at='2026-03-05T00:00:00.000Z', arrival_transit=1, arrival_transit_leg_id=2, awaiting_after=NULL, auto_confirm_after=NULL WHERE id=1").run()
    await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
    expect(await agree()).toMatchObject({ countries: [] }) // both updating while the repair is pending
    await repairUserDerivedState(db, USER.id)
    expect(await agree()).toEqual({ countries: ['GE', 'US'], pressed: 2, pending: 0 }) // the prospective default and the confirmed decision agree; GE is now pressed
  } finally { await dispose() }
})
