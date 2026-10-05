// T08 / ADR 0001 §4: the one country-evidence calculation, with the effective arrival policy and its acceptance tests (A5).
import { describe, expect, it } from 'vitest'
import { readPublicProfile } from '../api/_services/publicProfiles'
import { accountWith, at, evidence, evidenceCountries, flightStatement, publish, suppressions, T0, USER, userStats, visitAirports, type FixtureFlight } from './country-fixture'

const F1: FixtureFlight = { id: 1, date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'awaiting', dep: at(T0, -4), arr: T0 }
const F2: FixtureFlight = { id: 2, date: '2026-03-02', origin: 'IST', destination: 'JFK', state: 'logged', dep: at(T0, 3), arr: at(T0, 12) }
const TRANSIT_ROWS = [
  { flight_id: 1, endpoint: 'destination', country_code: 'TR' },
  { flight_id: 2, endpoint: 'origin', country_code: 'TR' },
]

describe('unusable input never breaks or over-suppresses the repair', () => {
  it('publishes ready with correct countries when one flight has a malformed date', async () => {
    const { db, dispose } = await accountWith([F1, F2, { id: 9, date: 'not-a-date', origin: 'KUT', destination: 'IST', state: 'logged' }])
    try {
      const state = await db.prepare('SELECT revision, published_revision, evidence_revision FROM user_derived_state WHERE user_id = ?').bind(USER.id).first<{ revision: number; published_revision: number; evidence_revision: number }>()
      expect(state!.published_revision).toBe(state!.revision)
      expect(state!.evidence_revision).toBe(state!.revision)
      // The malformed flight arrives at the hub airport, so it is the leg that used to make the repair throw. It keeps
      // both endpoints as ordinary evidence (TR is pressed by it); the valid pair is still a transit link.
      expect(await evidenceCountries(db)).toEqual(['GE', 'TR', 'US'])
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
      expect(await userStats(db)).toMatchObject({ countries_count: 3 })
    } finally { await dispose() }
  })

  it('does not suppress a hub when the onward country is unknown', async () => {
    const { db, dispose } = await accountWith([F1, { ...F2, destination: 'ZZZ' }])
    try {
      expect(await suppressions(db)).toEqual([])
      expect(await evidenceCountries(db)).toEqual(['GE', 'TR'])
    } finally { await dispose() }
  })
})

describe('prospective default for an awaiting flight (rule 2)', () => {
  it('defaults an unambiguous third-country connection to transit: no pending hub, airports still counted', async () => {
    const { db, dispose } = await accountWith([F1, F2])
    try {
      expect(await evidenceCountries(db)).toEqual(['GE', 'US'])
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
      expect(await visitAirports(db)).toEqual([
        { airport_iata: 'IST', visit_count: 2 }, { airport_iata: 'JFK', visit_count: 1 }, { airport_iata: 'TBS', visit_count: 1 }])
      expect(await userStats(db)).toMatchObject({ airports_count: 3, countries_count: 2 })
    } finally { await dispose() }
  })

  it('agrees before and after confirmation writes the effective decision', async () => {
    const { db, dispose } = await accountWith([F1, F2])
    try {
      const before = { evidence: await evidence(db), suppressions: await suppressions(db), stats: await userStats(db) }
      expect((before.evidence as Array<{ country_code: string; status: string }>).map(row => [row.country_code, row.status]))
        .toEqual([['GE', 'pending'], ['US', 'pressed']])
      // What confirmation (T09) stores: logged/user with the effective default as an explicit decision.
      await db.prepare("UPDATE flights SET lifecycle_state='logged', confirmation_source='user', confirmed_at='2026-03-05T00:00:00.000Z', arrival_transit=1, arrival_transit_leg_id=2, awaiting_after=NULL, auto_confirm_after=NULL, lifecycle_timezone=lifecycle_timezone WHERE id=1").run()
      await publish(db)
      const after = { evidence: await evidence(db), suppressions: await suppressions(db), stats: await userStats(db) }
      // The only difference is that F1's own endpoint evidence moved from awaiting to logged (GE: pending to pressed).
      expect(after.suppressions).toEqual(before.suppressions)
      expect(after.stats).toEqual(before.stats)
      expect((after.evidence as Array<{ country_code: string; status: string }>).map(row => [row.country_code, row.status]))
        .toEqual([['GE', 'pressed'], ['US', 'pressed']])
    } finally { await dispose() }
  })

  it('«left the airport» (arrival_transit = 0) includes the hub as a pending country', async () => {
    const { db, dispose } = await accountWith([{ ...F1, transit: 0 }, F2])
    try {
      expect(await suppressions(db)).toEqual([])
      // The hub is pressed by F2's own departure from it; F1's arrival adds an awaiting visit on top.
      expect(await evidence(db)).toEqual([
        { country_code: 'GE', status: 'pending', logged: 0, awaiting: 1, claimed: 0, ground: 0 },
        { country_code: 'TR', status: 'pressed', logged: 1, awaiting: 1, claimed: 0, ground: 0 },
        { country_code: 'US', status: 'pressed', logged: 1, awaiting: 0, claimed: 0, ground: 0 },
      ])
    } finally { await dispose() }
  })

  it('does not suppress an ambiguous or estimated-ambiguous branch', async () => {
    const { db, dispose } = await accountWith([F1, F2, { id: 3, date: '2026-03-02', origin: 'IST', destination: 'LHR', state: 'logged', dep: at(T0, 5), arr: at(T0, 9) }])
    try {
      expect(await suppressions(db)).toEqual([])
      expect(await evidenceCountries(db)).toEqual(['GB', 'GE', 'TR', 'US'])
    } finally { await dispose() }
  })

  it('keeps a pending-only country unpressed but inside the flight-country figure', async () => {
    const { db, dispose } = await accountWith([{ id: 1, date: '2026-03-01', origin: 'TBS', destination: 'LHR', state: 'awaiting' }])
    try {
      expect(await evidence(db)).toEqual([
        { country_code: 'GB', status: 'pending', logged: 0, awaiting: 1, claimed: 0, ground: 0 },
        { country_code: 'GE', status: 'pending', logged: 0, awaiting: 1, claimed: 0, ground: 0 }])
      expect(await userStats(db)).toMatchObject({ countries_count: 2 })
    } finally { await dispose() }
  })

  it('never applies a prospective default to a logged flight (legacy or save keeps its endpoint policy)', async () => {
    for (const source of ['legacy', 'save'] as const) {
      const { db, dispose } = await accountWith([{ ...F1, state: 'logged', source }, F2])
      try {
        expect(await suppressions(db)).toEqual([])
        expect(await evidenceCountries(db)).toEqual(['GE', 'TR', 'US'])
      } finally { await dispose() }
    }
  })

  it('does not default across an upcoming-only onward leg that cannot be ambiguous: the outgoing origin is consumed too', async () => {
    const { db, dispose } = await accountWith([F1, { ...F2, state: 'upcoming' }])
    try {
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
      expect(await evidenceCountries(db)).toEqual(['GE'])
      await db.prepare("UPDATE flights SET lifecycle_state='awaiting', is_upcoming=0 WHERE id=2").run()
      await publish(db)
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
      expect(await evidenceCountries(db)).toEqual(['GE', 'US'])
    } finally { await dispose() }
  })
})

describe('evidence from elsewhere keeps the hub country pressed', () => {
  const explicit = [{ ...F1, state: 'logged' as const, transit: 1 as const, leg: 2 }, F2]
  const cases: Array<[string, (db: D1Database) => D1PreparedStatement[], FixtureFlight[]]> = [
    ['a claim', db => [db.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'TR')").bind(USER.id)], []],
    ['a ground visit', db => [db.prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('g',?,'TR')").bind(USER.id)], []],
    ['a legacy row', db => [db.prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
      VALUES ('l',?,'ADB','TR','2019-01-01','2019-01-01',1,'d','archive',1,'{}')`).bind(USER.id)], []],
    ['another flight', () => [], [{ id: 9, date: '2025-01-01', origin: 'TBS', destination: 'ADB', state: 'logged' }]],
    ['a flight from the hub (an outgoing origin that is not the matched leg)', () => [], [{ id: 9, date: '2026-04-20', origin: 'IST', destination: 'TBS', state: 'logged' }]],
  ]
  for (const [name, extra, more] of cases) {
    it(`${name}`, async () => {
      const { db, dispose } = await accountWith([...explicit, ...more], extra)
      try {
        expect(await evidenceCountries(db)).toContain('TR')
        expect((await suppressions(db)).filter(row => row.flight_id === 1 || row.flight_id === 2)).toEqual(TRANSIT_ROWS)
        expect(await visitAirports(db)).toEqual(expect.arrayContaining([expect.objectContaining({ airport_iata: 'IST' })]))
      } finally { await dispose() }
    })
  }
})

describe('A5: explicit transit is stable under later changes', () => {
  const base: FixtureFlight[] = [{ ...F1, state: 'logged', source: 'user', transit: 1, leg: 2 }, F2]

  it('adding an ambiguous second onward leg does not revive or move the suppression', async () => {
    const { db, dispose } = await accountWith(base)
    try {
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
      await flightStatement(db, { id: 3, date: '2026-03-02', origin: 'IST', destination: 'LHR', state: 'logged', dep: at(T0, 5), arr: at(T0, 9) }).run()
      await publish(db)
      // Leg 3 is a competing onward leg, so the chain is ambiguous; the stored leg still carries the suppression.
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
      // Leg 3 itself departs from the hub (open item 7), so the hub counts once for that departure only.
      expect(await evidence(db)).toEqual(expect.arrayContaining([expect.objectContaining({ country_code: 'TR', status: 'pressed', logged: 1 })]))
      expect(await evidenceCountries(db)).toEqual(['GB', 'GE', 'TR', 'US'])
    } finally { await dispose() }
  })

  it('deleting the matched leg keeps the destination suppressed and moves nothing onto another leg', async () => {
    const { db, dispose } = await accountWith([...base, { id: 3, date: '2026-03-02', origin: 'IST', destination: 'LHR', state: 'logged', dep: at(T0, 5), arr: at(T0, 9) }])
    try {
      await db.prepare('DELETE FROM flights WHERE id = 2').run()
      await publish(db)
      expect(await suppressions(db)).toEqual([TRANSIT_ROWS[0]])
      // Leg 3 departs from the hub airport but is not the stored leg: its origin counts the hub (open item 7), the destination suppression stays.
      expect(await evidenceCountries(db)).toEqual(['GB', 'GE', 'TR'])
    } finally { await dispose() }
  })

  it('an unrelated later departure D from the hub counts the hub only for D; A keeps its suppression', async () => {
    const { db, dispose } = await accountWith(base)
    try {
      await flightStatement(db, { id: 3, date: '2026-04-20', origin: 'IST', destination: 'DXB', state: 'logged', dep: at('2026-04-20T08:00:00.000Z', 0), arr: at('2026-04-20T08:00:00.000Z', 4) }).run()
      await publish(db)
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
      expect(await evidence(db)).toEqual(expect.arrayContaining([
        expect.objectContaining({ country_code: 'TR', status: 'pressed', logged: 1 }), // D's origin only, not A's destination or leg 2's origin
      ]))
      expect(await evidenceCountries(db)).toEqual(['AE', 'GE', 'TR', 'US'])
    } finally { await dispose() }
  })

  it('removing D again restores the suppressed state exactly', async () => {
    const { db, dispose } = await accountWith(base)
    try {
      await flightStatement(db, { id: 3, date: '2026-04-20', origin: 'IST', destination: 'DXB', state: 'logged' }).run()
      await publish(db)
      await db.prepare('DELETE FROM flights WHERE id = 3').run()
      await publish(db)
      expect(await evidenceCountries(db)).toEqual(['GE', 'US'])
      expect(await suppressions(db)).toEqual(TRANSIT_ROWS)
    } finally { await dispose() }
  })

  it('a route edit resets the decision, so the new destination is never suppressed by the old hub decision', async () => {
    const { db, dispose } = await accountWith(base)
    try {
      await db.prepare("UPDATE flights SET destination = 'LHR' WHERE id = 1").run() // trigger 4 / lifecycle rules clear the decision
      await publish(db)
      expect(await suppressions(db)).toEqual([])
      expect(await evidenceCountries(db)).toEqual(['GB', 'GE', 'TR', 'US'])
    } finally { await dispose() }
  })
})

describe('derived consumers read the same calculation', () => {
  it('computes continents from the policy set, and never revokes an award earned earlier', async () => {
    const { db, dispose } = await accountWith([F1, F2], db => [
      db.prepare("INSERT INTO badge_definitions (id,code,name,criteria) VALUES (7,'two-continents','Two','{\"continents\":3}')"),
      db.prepare("INSERT INTO user_badges (user_id,badge_id,earned_at) VALUES (?,7,'2025-01-01T00:00:00.000Z')").bind(USER.id),
    ])
    try {
      // GE (Asia) and US (North America): TR no longer counts for the continent figure.
      expect(await userStats(db)).toMatchObject({ continents_count: 2 })
      expect(await db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?').bind(USER.id).all().then(r => r.results)).toEqual([{ badge_id: 7 }])
      const advanced = await db.prepare('SELECT continent_breakdown, region_breakdown FROM user_advanced_stats WHERE user_id = ?').bind(USER.id).first<{ continent_breakdown: string; region_breakdown: string }>()
      expect(JSON.parse(advanced!.region_breakdown)).toEqual({ asia: 1, americas: 1 })
    } finally { await dispose() }
  })
})

describe('public readers (ADR I3)', () => {
  it('show the published countries_count from the same calculation and stay gated on revision only', async () => {
    const { db, dispose } = await accountWith([F1, F2], db => [
      db.prepare("UPDATE profiles SET username = 'trav', is_public = 1 WHERE id = ?").bind(USER.id),
    ])
    try {
      expect((await readPublicProfile(db, 'trav'))).toMatchObject({ derivedState: 'ready', stats: { countries_count: 2, airports_count: 3 } })
      // A build below the floor publishes the revision without the stamp: the owner reads `updating`, public readers keep serving.
      await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
      await db.prepare('UPDATE user_derived_state SET published_revision = revision WHERE user_id = ?').bind(USER.id).run()
      expect((await readPublicProfile(db, 'trav'))).toMatchObject({ derivedState: 'ready', stats: { countries_count: 2 } })
    } finally { await dispose() }
  })
})
