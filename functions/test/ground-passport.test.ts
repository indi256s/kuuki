// Ground travel: journey country evidence, Passport journey contributions, JSON export, account deletion and
// receipt cleanup. Journeys are inserted with SQL; the journeys API has its own tests.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { accountWith, publish, userStats, USER, type FixtureFlight } from './country-fixture'
import { apiContext, csrfRequest } from './harness'
import { onRequestDelete as unclaimCountry } from '../api/passport/claims/[cc]/index'
import { onRequestDelete as deleteGroundVisit } from '../api/passport/ground-visits/[id]'
import { onRequestGet as exportJourneys } from '../api/ground-journeys/export'
import { readCountryDetail, readPassport } from '../api/_services/passport'
import { deleteUserCascade } from '../api/_lib/users'
import maintenance from '../../workers/maintenance/index'

const OTHER = 'other-user'
const NOW = new Date('2026-10-05T12:00:00.000Z')
afterEach(() => {
  vi.useRealTimers()
})

const place = (id: string, name: string, countryCode: string) =>
  JSON.stringify({
    source: 'geonames',
    id,
    name,
    nameRu: null,
    nameEn: null,
    countryCode,
    region: null,
    lat: null,
    lon: null,
    timezone: null,
    catalogVersion: 'test',
  })

interface Journey {
  id: string
  status?: 'planned' | 'completed' | 'cancelled' | 'tombstone'
  mode?: 'rail' | 'road'
  user?: string
  countries?: string[]
  start?: string | null
  end?: string | null
  title?: string | null
}

/** Journey parent, one route and its confirmed countries, as the journeys API would leave them. */
function journeyStatements(db: D1Database, journey: Journey) {
  const status = journey.status ?? 'completed'
  const user = journey.user ?? USER.id
  const mode = journey.mode ?? 'rail'
  const out: D1PreparedStatement[] = []
  if (status === 'tombstone') {
    out.push(
      db
        .prepare(
          "INSERT INTO ground_journeys (id,user_id,mode,version,deleted_at) VALUES (?,?,?,2,'2026-02-01T00:00:00.000Z')",
        )
        .bind(journey.id, user, mode),
    )
  } else {
    out.push(
      db
        .prepare(
          `INSERT INTO ground_journeys (id,user_id,mode,status,version,start_date,end_date,title,created_at,updated_at,confirmed_at)
           VALUES (?,?,?,?,1,?,?,?,'2026-01-01T00:00:00.000Z','2026-01-02T00:00:00.000Z',?)`,
        )
        .bind(
          journey.id,
          user,
          mode,
          status,
          journey.start === undefined ? '2026-01-10' : journey.start,
          journey.end === undefined ? '2026-01-12' : journey.end,
          journey.title ?? null,
          status === 'completed' ? '2026-01-02T00:00:00.000Z' : null,
        ),
    )
    if (mode === 'rail') {
      out.push(
        db
          .prepare(
            'INSERT INTO ground_rail_legs (id,journey_id,user_id,ordinal,from_place,to_place) VALUES (?,?,?,0,?,?)',
          )
          .bind(
            `${journey.id}-l0`,
            journey.id,
            user,
            place('1', 'Tbilisi', 'GE'),
            place('2', 'Kars', 'TR'),
          ),
        db
          .prepare(
            'INSERT INTO ground_rail_legs (id,journey_id,user_id,ordinal,from_place,to_place) VALUES (?,?,?,1,?,?)',
          )
          .bind(
            `${journey.id}-l1`,
            journey.id,
            user,
            place('2', 'Kars', 'TR'),
            place('1', 'Tbilisi', 'GE'),
          ),
      )
    } else {
      out.push(
        db
          .prepare(
            'INSERT INTO ground_road_points (id,journey_id,user_id,ordinal,place) VALUES (?,?,?,0,?)',
          )
          .bind(`${journey.id}-p0`, journey.id, user, place('1', 'Tbilisi', 'GE')),
        db
          .prepare(
            'INSERT INTO ground_road_points (id,journey_id,user_id,ordinal,place) VALUES (?,?,?,1,?)',
          )
          .bind(`${journey.id}-p1`, journey.id, user, place('3', 'Yerevan', 'AM')),
      )
    }
  }
  for (const code of journey.countries ?? [])
    out.push(
      db
        .prepare(
          'INSERT INTO ground_journey_countries (journey_id,user_id,country_code) VALUES (?,?,?)',
        )
        .bind(journey.id, user, code),
    )
  return out
}

const withJourneys = (
  journeys: Journey[],
  flights: FixtureFlight[] = [],
  extra: D1PreparedStatement[] = [],
) =>
  accountWith(flights, (db) => [
    db
      .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
      .bind(OTHER, 'other@example.test', 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(OTHER),
    ...journeys.flatMap((journey) => journeyStatements(db, journey)),
    ...extra,
  ])

const rows = async (db: D1Database) =>
  (
    await db
      .prepare(
        `SELECT country_code, status, logged_visit_count AS logged, claimed, ground_visit_count AS ground,
                ground_journey_count AS journeys, first_visit, last_visit
         FROM country_visit_evidence WHERE user_id = ? ORDER BY country_code`,
      )
      .bind(USER.id)
      .all()
  ).results
const pressed = async (db: D1Database) =>
  (await rows(db)).filter((row) => row.status === 'pressed').map((row) => row.country_code)

const logged = (id: number, date: string, origin: string, destination: string): FixtureFlight => ({
  id,
  date,
  origin,
  destination,
  state: 'logged',
})

describe('journey country evidence', () => {
  it('presses countries of completed journeys without inventing visit dates, ignoring plans, cancellations and tombstones', async () => {
    const { db, dispose } = await withJourneys([
      { id: 'done', countries: ['AM', 'GE'], start: null, end: null },
      { id: 'plan', status: 'planned', countries: ['FR'] },
      { id: 'cancelled', status: 'cancelled', countries: ['DE'] },
      { id: 'gone', status: 'tombstone', countries: ['IT'] },
      { id: 'foreign', user: OTHER, countries: ['ES'] },
    ])
    try {
      expect(await rows(db)).toEqual([
        {
          country_code: 'AM',
          status: 'pressed',
          logged: 0,
          claimed: 0,
          ground: 0,
          journeys: 1,
          first_visit: null,
          last_visit: null,
        },
        {
          country_code: 'GE',
          status: 'pressed',
          logged: 0,
          claimed: 0,
          ground: 0,
          journeys: 1,
          first_visit: null,
          last_visit: null,
        },
      ])
    } finally {
      await dispose()
    }
  })

  it('removes only the reopened journey support and keeps countries other sources still support', async () => {
    const { db, dispose } = await withJourneys(
      [
        { id: 'a', countries: ['AM', 'GE'] },
        { id: 'b', countries: ['GE'] },
      ],
      [logged(1, '2025-05-01', 'JFK', 'LHR')],
      [],
    )
    try {
      expect(await pressed(db)).toEqual(['AM', 'GB', 'GE', 'US'])
      // Reopen: the journey keeps its route but loses its confirmed countries (and stops being completed).
      await db.batch([
        db.prepare("DELETE FROM ground_journey_countries WHERE journey_id = 'a'"),
        db.prepare(
          "UPDATE ground_journeys SET status = 'planned', confirmed_at = NULL, version = 2 WHERE id = 'a'",
        ),
      ])
      await publish(db)
      expect(await pressed(db)).toEqual(['GB', 'GE', 'US'])
      expect((await rows(db)).find((row) => row.country_code === 'GE')).toMatchObject({
        journeys: 1,
      })
      // Flight evidence keeps its own dates.
      expect((await rows(db)).find((row) => row.country_code === 'US')).toMatchObject({
        first_visit: '2025-05-01',
        last_visit: '2025-05-01',
        journeys: 0,
      })
    } finally {
      await dispose()
    }
  })

  it('leaves flight countries_count and visit dates untouched by journeys', async () => {
    const flights = [logged(1, '2025-05-01', 'TBS', 'IST')]
    const plain = await accountWith(flights)
    const withJourney = await withJourneys([{ id: 'j', countries: ['AM', 'TR', 'FR'] }], flights)
    try {
      const before = await userStats(plain.db)
      const after = await userStats(withJourney.db)
      expect(after).toEqual(before)
      expect(after).toMatchObject({ countries_count: 2 })
      const passport = await readPassport(withJourney.db, USER.id)
      expect(passport.flightCountryCount).toBe(2)
      expect(passport.pressedCountryCount).toBe(4)
      expect((await rows(withJourney.db)).find((row) => row.country_code === 'TR')).toMatchObject({
        first_visit: '2025-05-01',
        last_visit: '2025-05-01',
        journeys: 1,
      })
    } finally {
      await plain.dispose()
      await withJourney.dispose()
    }
  })
})

describe('journey evidence survives manual edits and loses only its own support', () => {
  it('keeps a journey-supported country pressed after unclaim and ground visit deletion', async () => {
    const { db, dispose } = await withJourneys([{ id: 'j', countries: ['AM'] }])
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO country_claims (user_id,country_code,claimed_at) VALUES (?,'AM','2026-01-01T00:00:00.000Z')",
          )
          .bind(USER.id),
        db
          .prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('gv',?,'AM')")
          .bind(USER.id),
      ])
      await publish(db)
      expect((await rows(db))[0]).toMatchObject({ claimed: 1, ground: 1, journeys: 1 })

      const user = { id: USER.id, email: USER.email }
      const unclaimed = await unclaimCountry({
        ...apiContext(db, csrfRequest('/api/passport/claims/AM', 'DELETE')),
        data: { user },
        params: { cc: 'AM' },
      } as never)
      expect(unclaimed.status).toBeLessThan(300)
      const removed = await deleteGroundVisit({
        ...apiContext(db, csrfRequest('/api/passport/ground-visits/gv', 'DELETE')),
        data: { user },
        params: { id: 'gv' },
      } as never)
      expect(removed.status).toBeLessThan(300)
      await publish(db)
      expect(await rows(db)).toEqual([
        expect.objectContaining({
          country_code: 'AM',
          status: 'pressed',
          claimed: 0,
          ground: 0,
          journeys: 1,
        }),
      ])
    } finally {
      await dispose()
    }
  })

  it('unpresses a country when its only journey is deleted, keeps it when another source supports it', async () => {
    const { db, dispose } = await withJourneys(
      [
        { id: 'only', countries: ['AM'] },
        { id: 'with-flight', countries: ['TR'] },
        { id: 'with-visit', countries: ['FR'] },
        { id: 'shared-1', countries: ['DE'] },
        { id: 'shared-2', countries: ['DE'] },
      ],
      [logged(1, '2025-05-01', 'TBS', 'IST')],
      [],
    )
    try {
      await db
        .prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('v',?,'FR')")
        .bind(USER.id)
        .run()
      await publish(db)
      expect(await pressed(db)).toEqual(['AM', 'DE', 'FR', 'GE', 'TR'])
      // Journey deletion as the API leaves it: children gone, parent reduced to a tombstone.
      for (const id of ['only', 'with-flight', 'with-visit', 'shared-1']) {
        await db.batch([
          db.prepare('DELETE FROM ground_journey_countries WHERE journey_id = ?').bind(id),
          db.prepare('DELETE FROM ground_rail_legs WHERE journey_id = ?').bind(id),
          db
            .prepare(
              `UPDATE ground_journeys SET status = NULL, title = NULL, note = NULL, start_date = NULL, end_date = NULL,
               created_at = NULL, updated_at = NULL, confirmed_at = NULL, version = version + 1,
               deleted_at = '2026-03-01T00:00:00.000Z' WHERE id = ?`,
            )
            .bind(id),
        ])
      }
      await publish(db)
      expect(await pressed(db)).toEqual(['DE', 'FR', 'GE', 'TR'])
    } finally {
      await dispose()
    }
  })
})

describe('Passport journey contributions', () => {
  it('lists own live completed journeys apart from manual ground visits', async () => {
    const { db, dispose } = await withJourneys(
      [
        { id: 'rail', countries: ['TR'], title: 'Kars loop', start: '2026-01-10' },
        { id: 'road', mode: 'road', countries: ['TR'], start: null, end: null },
        { id: 'plan', status: 'planned', countries: ['TR'] },
        { id: 'gone', status: 'tombstone', countries: ['TR'] },
        { id: 'foreign', user: OTHER, countries: ['TR'] },
      ],
      [],
      [],
    )
    try {
      await db
        .prepare("INSERT INTO ground_visits (id,user_id,country_code) VALUES ('v',?,'TR')")
        .bind(USER.id)
        .run()
      await publish(db)
      const detail = await readCountryDetail(db, USER.id, 'TR')
      expect(detail.journeys).toEqual([
        {
          id: 'rail',
          mode: 'rail',
          title: 'Kars loop',
          startDate: '2026-01-10',
          endDate: '2026-01-12',
          route: 'Tbilisi → Kars → Tbilisi',
        },
        {
          id: 'road',
          mode: 'road',
          title: null,
          startDate: null,
          endDate: null,
          route: 'Tbilisi → Yerevan',
        },
      ])
      expect(detail.groundVisits.map((visit) => visit.id)).toEqual(['v'])
      expect(detail.entries.filter((entry) => entry.kind === 'ground')).toHaveLength(1)
      expect(
        await readCountryDetail(db, OTHER, 'TR').then((other) => other.journeys.map((j) => j.id)),
      ).toEqual(['foreign'])
      const list = await readPassport(db, USER.id)
      expect(list.countries.find((country) => country.country_code === 'TR')).toMatchObject({
        ground_visit_count: 1,
        ground_journey_count: 2,
      })
    } finally {
      await dispose()
    }
  })
})

describe('ground journeys export', () => {
  it('exports every live journey and manual place of the owner only', async () => {
    const { db, dispose } = await withJourneys(
      [
        { id: 'done', countries: ['TR', 'GE'], title: 'Kars loop' },
        { id: 'plan', status: 'planned', mode: 'road' },
        { id: 'cancelled', status: 'cancelled' },
        { id: 'gone', status: 'tombstone' },
        { id: 'foreign', user: OTHER, countries: ['ES'] },
      ],
      [],
      [],
    )
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO ground_manual_places (id,user_id,name,name_key,country_code,created_at) VALUES ('m1',?,'Old farm','old farm','GE','2026-01-01T00:00:00.000Z')",
          )
          .bind(USER.id),
        db
          .prepare(
            "INSERT INTO ground_manual_places (id,user_id,name,name_key,country_code,created_at) VALUES ('m2',?,'Other farm','other farm','ES','2026-01-01T00:00:00.000Z')",
          )
          .bind(OTHER),
        db
          .prepare(
            "INSERT INTO ground_operation_receipts (user_id,operation_key,request_digest,journey_id,kind,batch_nonce,created_at,expires_at) VALUES (?,'key-12345678','d','done','create','n','2026-01-01T00:00:00.000Z','2026-02-07T00:00:00.000Z')",
          )
          .bind(USER.id),
      ])
      const request = new Request('https://kuuki.test/api/ground-journeys/export')
      const response = await exportJourneys({
        ...apiContext(db, request),
        data: { user: { id: USER.id, email: USER.email } },
        params: {},
      } as never)
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="kuuki-ground-journeys-\d{4}-\d{2}-\d{2}\.json"$/,
      )
      const text = await response.text()
      const body = JSON.parse(text)
      expect(body).toMatchObject({ format: 'kuuki.ground-journeys', version: 1 })
      expect(typeof body.exportedAt).toBe('string')
      expect(body.journeys.map((j: { id: string }) => j.id).sort()).toEqual([
        'cancelled',
        'done',
        'plan',
      ])
      const done = body.journeys.find((j: { id: string }) => j.id === 'done')
      expect(done).toMatchObject({
        mode: 'rail',
        status: 'completed',
        version: 1,
        title: 'Kars loop',
        note: null,
        startDate: '2026-01-10',
        confirmedAt: '2026-01-02T00:00:00.000Z',
        countries: ['GE', 'TR'],
      })
      expect(done.legs.map((leg: { ordinal: number }) => leg.ordinal)).toEqual([0, 1])
      expect(done.legs[0]).toMatchObject({
        from: { name: 'Tbilisi' },
        to: { name: 'Kars' },
        trainNumber: null,
        durationMinutes: null,
      })
      expect(body.journeys.find((j: { id: string }) => j.id === 'plan').points).toHaveLength(2)
      expect(body.manualPlaces).toEqual([
        {
          id: 'm1',
          name: 'Old farm',
          countryCode: 'GE',
          latitude: null,
          longitude: null,
          timezone: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ])
      for (const secret of [USER.id, OTHER, 'key-12345678', 'foreign', 'gone', 'deleted_at'])
        expect(text).not.toContain(secret)
      const anonymous = await exportJourneys(apiContext(db, request) as never)
      expect(anonymous.status).toBe(401)
    } finally {
      await dispose()
    }
  })
})

const GROUND_TABLES = [
  'ground_operation_receipts',
  'ground_journey_countries',
  'ground_rail_legs',
  'ground_road_points',
  'ground_journeys',
  'ground_manual_places',
]
const receipt = (db: D1Database, user: string, key: string, expires: string) =>
  db
    .prepare(
      "INSERT INTO ground_operation_receipts (user_id,operation_key,request_digest,journey_id,kind,batch_nonce,created_at,expires_at) VALUES (?,?,'d','j','create','n','2026-01-01T00:00:00.000Z',?)",
    )
    .bind(user, key, expires)
const manualPlace = (db: D1Database, user: string, id: string) =>
  db
    .prepare(
      "INSERT INTO ground_manual_places (id,user_id,name,name_key,country_code,created_at) VALUES (?,?,'P','p','GE','2026-01-01T00:00:00.000Z')",
    )
    .bind(id, user)
const countsFor = async (db: D1Database, user: string): Promise<Record<string, number>> =>
  Object.fromEntries(
    await Promise.all(
      GROUND_TABLES.map(async (table) => [
        table,
        (await db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`)
          .bind(user)
          .first<{ n: number }>())!.n,
      ]),
    ),
  )

describe('account deletion and receipt cleanup', () => {
  it('removes every ground row of the deleted user, tombstones and receipts included, and no one else’s', async () => {
    const { db, dispose } = await withJourneys(
      [
        { id: 'rail', countries: ['TR'] },
        { id: 'road', mode: 'road', countries: ['AM'] },
        { id: 'gone', status: 'tombstone' },
        { id: 'foreign', user: OTHER, countries: ['ES'] },
        { id: 'foreign-gone', user: OTHER, status: 'tombstone' },
      ],
      [],
      [],
    )
    try {
      await db.batch([
        manualPlace(db, USER.id, 'm1'),
        manualPlace(db, OTHER, 'm2'),
        receipt(db, USER.id, 'own-key-0001', '2026-12-01T00:00:00.000Z'),
        receipt(db, OTHER, 'other-key-001', '2026-12-01T00:00:00.000Z'),
      ])
      const own = await countsFor(db, USER.id)
      expect(Object.values(own).every((n) => n > 0)).toBe(true)
      const foreign = await countsFor(db, OTHER)
      await deleteUserCascade(db, USER.id)
      expect(Object.values(await countsFor(db, USER.id)).every((n) => n === 0)).toBe(true)
      expect(await countsFor(db, OTHER)).toEqual(foreign)
    } finally {
      await dispose()
    }
  })

  it('maintenance deletes only expired receipts', async () => {
    const { db, dispose } = await withJourneys([{ id: 'gone', status: 'tombstone' }])
    try {
      await db.batch([
        receipt(db, USER.id, 'expired-0001', '2026-10-05T11:59:59.000Z'),
        receipt(db, USER.id, 'due-now-0001', NOW.toISOString()),
        receipt(db, OTHER, 'future-00001', '2026-10-05T12:00:01.000Z'),
      ])
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      await maintenance.scheduled({} as ScheduledEvent, { DB: db, MAINTENANCE_MODE: 'false' })
      const left = await db
        .prepare('SELECT operation_key FROM ground_operation_receipts ORDER BY operation_key')
        .all<{ operation_key: string }>()
      expect(left.results.map((row) => row.operation_key)).toEqual(['future-00001'])
      expect(await db.prepare('SELECT COUNT(*) AS n FROM ground_journeys').first()).toEqual({
        n: 1,
      })
    } finally {
      await dispose()
    }
  })
})
