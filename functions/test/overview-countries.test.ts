// T08 / ADR 0001 §4 and A7: Overview counts countries from published data only, in one snapshot with the readiness gate.
import { expect, it } from 'vitest'
import {
  accountWith,
  at,
  flightStatement,
  publish,
  T0,
  USER,
  type FixtureFlight,
} from './country-fixture'
import { readOverviewPayload as read, readOverviewScope } from './overview-fixture'
import { repairUserDerivedState } from '../api/_services/derivedState'
import { regionCount } from '../api/_lib/regions'

const F1: FixtureFlight = {
  id: 1,
  date: '2026-03-01',
  origin: 'TBS',
  destination: 'IST',
  state: 'awaiting',
  dep: at(T0, -4),
  arr: T0,
}
const F2: FixtureFlight = {
  id: 2,
  date: '2026-03-02',
  origin: 'IST',
  destination: 'JFK',
  state: 'logged',
  dep: at(T0, 3),
  arr: at(T0, 12),
}

const claimsAndLegacy = (db: D1Database) => [
  db
    .prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'JP')")
    .bind(USER.id),
  db
    .prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('g',?,'DE')")
    .bind(USER.id),
  db
    .prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
    VALUES ('l',?,'SVO','RU','2019-01-01','2019-01-01',1,'d','archive',1,'{}')`)
    .bind(USER.id),
]

it('reads all-time Passport countries from the published projection, including claims and ground visits, without the suppressed hub', async () => {
  const { db, dispose } = await accountWith([F1, F2], claimsAndLegacy)
  try {
    const all = await read(db)
    expect(all.derivedReady).toBe(true)
    expect(all.passport.countryCodes).toEqual(['DE', 'JP', 'RU', 'US'])
    expect((await readOverviewScope(db)).figures).toMatchObject({
      countries: { value: 4, source: 'passport' },
      airports: 3,
      flights: 2,
    }) // IST stays in the airport figure
    expect(all.passport.regions).toBe(regionCount(['DE', 'JP', 'RU', 'US'])) // six-region catalog model, not continentOf7
  } finally {
    await dispose()
  }
})

it('reads a year from canonical endpoints minus the published suppressions, legacy staying out', async () => {
  const { db, dispose } = await accountWith([F1, F2], claimsAndLegacy)
  try {
    const year = await readOverviewScope(db, { period: { years: [2026] } })
    expect((await read(db)).derivedReady).toBe(true)
    expect(year.globe.countries).toEqual([
      { code: 'GE', visits: 1 },
      { code: 'US', visits: 1 },
    ])
    expect(year.figures.countries).toEqual({ value: 2, source: 'by_air' })
    const filtered = await readOverviewScope(db, { routes: ['IST-JFK'] })
    expect(filtered.globe.countries).toEqual([{ code: 'US', visits: 1 }])
  } finally {
    await dispose()
  }
})

it('counts the hub again when the member left the airport, with no mixed figure', async () => {
  const { db, dispose } = await accountWith([{ ...F1, transit: 0 }, F2])
  try {
    expect(
      (await readOverviewScope(db, { period: { years: [2026] } })).globe.countries
        .map((row) => row.code)
        .sort(),
    ).toEqual(['GE', 'TR', 'US'])
    expect((await read(db)).passport.countryCodes).toEqual(['TR', 'US'])
  } finally {
    await dispose()
  }
})

it('A7: returns updating, never a mixed figure, while a repair is pending', async () => {
  const { db, dispose } = await accountWith([F1, F2])
  try {
    await flightStatement(db, {
      id: 3,
      date: '2026-03-03',
      origin: 'JFK',
      destination: 'LHR',
      state: 'logged',
    }).run()
    await db
      .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
      .bind(USER.id)
      .run()
    const pending = await read(db)
    expect(pending.derivedReady).toBe(false)
    expect(pending.passport.countryCodes).toEqual(['US']) // last published evidence is explicitly not ready
    expect((await readOverviewScope(db)).figures.flights).toBe(3)
    await repairUserDerivedState(db, USER.id)
    expect((await read(db)).passport.countryCodes).toEqual(['GB', 'US'])
  } finally {
    await dispose()
  }
})

it('A7: after an old edit and an old repair leave the evidence stamp stale, Overview is updating until the repair runs', async () => {
  const { db, dispose } = await accountWith([
    { ...F1, state: 'logged', source: 'user', transit: 1, leg: 2 },
    F2,
  ])
  try {
    expect((await read(db)).passport.countryCodes).toEqual(['GE', 'US'])
    // A build below the rollback floor publishes the revision without the evidence stamp.
    await db
      .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
      .bind(USER.id)
      .run()
    await db
      .prepare('UPDATE user_derived_state SET published_revision = revision WHERE user_id = ?')
      .bind(USER.id)
      .run()
    const stale = await read(db)
    expect(stale).toMatchObject({ derivedReady: false })
    expect(stale.passport.countryCodes).toEqual(['GE', 'US'])
    expect(await repairUserDerivedState(db, USER.id)).toMatchObject({ derived_state: 'ready' })
    expect(await read(db)).toMatchObject({
      derivedReady: true,
      passport: { countryCodes: ['GE', 'US'] },
    })
  } finally {
    await dispose()
  }
})

it('does not serve a stale suppression for a changed route even if the published row is still there', async () => {
  const { db, dispose } = await accountWith([
    { ...F1, state: 'logged', source: 'user', transit: 1, leg: 2 },
    F2,
  ])
  try {
    // Old route edit: the decision is cleared by the adapter, the published suppression remains until a repair.
    await db.prepare("UPDATE flights SET destination = 'LHR' WHERE id = 1").run()
    await db
      .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
      .bind(USER.id)
      .run()
    await db
      .prepare('UPDATE user_derived_state SET published_revision = revision WHERE user_id = ?')
      .bind(USER.id)
      .run()
    expect((await read(db)).derivedReady).toBe(false)
    await publish(db)
    expect((await read(db)).passport.countryCodes).toEqual(['GB', 'GE', 'TR', 'US'])
  } finally {
    await dispose()
  }
})
