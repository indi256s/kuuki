import { expect, it } from 'vitest'
import { createApiDatabase } from './harness'
import { readUserAnalytics } from '../api/_services/userAnalytics'
import { deleteUserCascade } from '../api/_lib/users'

const now = new Date('2026-10-28T12:00:00.000Z')

it('denies analytics before accessing the database unless the exact configured owner is signed in', async () => {
  for (const [owner, user] of [
    [undefined, 'owner'],
    ['', 'owner'],
    [' owner', 'owner'],
    ['owner ', 'owner'],
    ['owner,other', 'owner'],
    ['owner', null],
    ['owner', 'Owner'],
    ['owner', 'other'],
  ]) {
    await expect(
      readUserAnalytics(
        {
          ADMIN_USER_ID: owner ?? undefined,
          get DB(): D1Database {
            throw new Error('Unauthorized database access')
          },
        },
        user ?? null,
        7,
        now,
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  }
})

it('counts retained content once per account and normalizes UTC periods without future events or deleted journeys', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const users = [
      ['owner', '2026-10-22T00:00:00Z'],
      ['recent', '2026-10-28T13:00:00+02:00'],
      ['previous', '2026-10-15 00:00:00'],
      ['old', '2026-10-01T00:00:00Z'],
      ['claim', '2026-10-01T00:00:00Z'],
      ['manual', '2026-10-01T00:00:00Z'],
      ['blank', '2026-10-01T00:00:00Z'],
      ['future', '2026-10-28T12:00:00.001Z'],
      ['deleted', '2026-10-23T00:00:00Z'],
    ]
    await db.batch(
      users.flatMap(([id, createdAt]) => [
        db
          .prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)')
          .bind(id, `${id}@example.test`, 'RESET_REQUIRED', createdAt),
        db.prepare('INSERT INTO profiles(id) VALUES(?)').bind(id),
      ]),
    )
    await db.batch([
      db.prepare(
        "UPDATE profiles SET onboarded_at = '2026-10-22', username = 'owner', is_public = 1 WHERE id = 'owner'",
      ),
      db.prepare("UPDATE profiles SET onboarded_at = '2026-10-01' WHERE id = 'old'"),
      db.prepare("UPDATE profiles SET username = '  ', is_public = 1 WHERE id = 'blank'"),
      ...[
        ['owner', '2026-10-22T00:00:00+00:00', 'manual'],
        ['owner', '2026-10-22T01:00:00Z', 'ai_import'],
        ['recent', '2026-10-28T14:00:00+02:00', 'ai_import'],
        ['recent', '2026-10-28T12:00:00.001Z', 'manual'],
        ['previous', '2026-10-21T23:59:59Z', 'manual'],
        ['deleted', '2026-10-23T00:00:00Z', 'manual'],
      ].map(([id, createdAt, source]) =>
        db
          .prepare(
            "INSERT INTO flights(user_id,date,origin,destination,created_at,source) VALUES(?,'2000-01-01','LHR','CDG',?,?)",
          )
          .bind(id, createdAt, source),
      ),
      ...[
        ['rail', 'owner', 'rail', '2026-10-26 17:00:00'],
        ['road', 'recent', 'road', '2026-10-23T03:00:00Z'],
        ['old-road', 'old', 'road', '2026-10-01T03:00:00Z'],
      ].map(([id, userId, mode, createdAt]) =>
        db
          .prepare(
            "INSERT INTO ground_journeys(id,user_id,mode,status,version,created_at,updated_at) VALUES(?,?,?,'planned',1,?,?)",
          )
          .bind(id, userId, mode, createdAt, createdAt),
      ),
      db.prepare(
        "INSERT INTO ground_journeys(id,user_id,mode,version,deleted_at) VALUES('tombstone','owner','rail',2,'2026-10-27T00:00:00Z')",
      ),
      db.prepare(
        "INSERT INTO country_claims(id,user_id,country_code,claimed_at) VALUES('claim','claim','FR','2026-10-23T00:00:00Z')",
      ),
      db.prepare(
        "INSERT INTO ground_visits(id,user_id,country_code,created_at) VALUES('manual','manual','FR','2026-10-23T00:00:00Z')",
      ),
    ])
    await deleteUserCascade(db, 'deleted')

    const result = await readUserAnalytics({ DB: db, ADMIN_USER_ID: 'owner' }, 'owner', 7, now)
    expect(result.totals).toEqual({
      users: 8,
      onboarded: 2,
      withEntries: 6,
      publicProfiles: 1,
      flights: 5,
      railJourneys: 1,
      roadTrips: 2,
      importUsers: 2,
    })
    expect(result.period).toEqual({
      newUsers: 2,
      previousNewUsers: 1,
      contributors: 2,
      flightsAdded: 3,
      groundAdded: 2,
    })
    expect(result.daily).toEqual([
      { date: '2026-10-22', users: 1, flights: 2, ground: 0 },
      { date: '2026-10-23', users: 0, flights: 0, ground: 1 },
      { date: '2026-10-24', users: 0, flights: 0, ground: 0 },
      { date: '2026-10-25', users: 0, flights: 0, ground: 0 },
      { date: '2026-10-26', users: 0, flights: 0, ground: 1 },
      { date: '2026-10-27', users: 0, flights: 0, ground: 0 },
      { date: '2026-10-28', users: 1, flights: 1, ground: 0 },
    ])
    expect(result.asOf).toBe('2026-10-28T12:00:00.000Z')
    expect(result.startDate).toBe('2026-10-22')
    expect(result.days).toBe(7)
  } finally {
    await dispose()
  }
})

it('returns zero totals and a complete UTC calendar for an empty database', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const result = await readUserAnalytics({ DB: db, ADMIN_USER_ID: 'owner' }, 'owner', 30, now)
    expect(result.totals).toEqual({
      users: 0,
      onboarded: 0,
      withEntries: 0,
      publicProfiles: 0,
      flights: 0,
      railJourneys: 0,
      roadTrips: 0,
      importUsers: 0,
    })
    expect(result.period).toEqual({
      newUsers: 0,
      previousNewUsers: 0,
      contributors: 0,
      flightsAdded: 0,
      groundAdded: 0,
    })
    expect(result.daily).toHaveLength(30)
    expect(result.activity).toEqual({ since: null, daily: 0, weekly: 0, monthly: 0 })
    expect(result.daily[0]).toEqual({ date: '2026-09-29', users: 0, flights: 0, ground: 0 })
    expect(result.daily[29]).toEqual({ date: '2026-10-28', users: 0, flights: 0, ground: 0 })
    expect(
      result.daily.every((row) => row.users === 0 && row.flights === 0 && row.ground === 0),
    ).toBe(true)
  } finally {
    await dispose()
  }
})
