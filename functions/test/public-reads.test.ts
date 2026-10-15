import { expect, it } from 'vitest'
import { createApiDatabase } from './harness'
import { readPublicProfile } from '../api/_services/publicProfiles'
import {
  readLeaderboardBoard,
  readOwnLeaderboardRank,
  readPublicLeaderboard,
} from '../api/_services/publicLeaderboard'
import { onRequestGet as getMyRankings } from '../api/me/rankings'
import { apiContext, testOrigin } from './harness'

it('checks live visibility, participation and publication before exposing cached public data', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db
        .prepare('INSERT INTO users(id,email,password_hash) VALUES (?,?,?)')
        .bind('public-owner', 'private@example.test', 'hash'),
      db
        .prepare(
          'INSERT INTO profiles(id,username,display_name,bio,avatar_url,theme_color,is_public,show_on_leaderboards) VALUES (?,?,?,?,?,?,1,1)',
        )
        .bind(
          'public-owner',
          'traveller',
          'Sensitive name',
          'Sensitive bio',
          'https://private.test/avatar',
          'red',
        ),
      db.prepare('INSERT INTO user_stats(user_id,total_flights) VALUES (?,5)').bind('public-owner'),
      db
        .prepare(
          'INSERT INTO user_derived_state(user_id,revision,published_revision) VALUES (?,1,1)',
        )
        .bind('public-owner'),
      db
        .prepare(
          "INSERT INTO leaderboard_cache(user_id,category,period,value,rank,metadata,updated_at) VALUES (?,'flights','all',5,1,?,?)",
        )
        .bind(
          'public-owner',
          JSON.stringify({ username: 'traveller' }),
          '2026-10-04T12:00:00.000Z',
        ),
      // Year and ground rows exist beside the all-time sky row; profile readers must not pick them up.
      db
        .prepare(
          "INSERT INTO leaderboard_cache(user_id,category,period,value,rank,metadata,updated_at) VALUES (?,'flights','2026',2,1,'{}',?),(?,'rail','all',3,1,'{}',?)",
        )
        .bind(
          'public-owner',
          '2026-10-04T12:00:00.000Z',
          'public-owner',
          '2026-10-04T12:00:00.000Z',
        ),
    ])
    const shown = await readPublicProfile(db, 'TRAVELLER')
    expect(shown).toMatchObject({ stats: { total_flights: 5 } })
    expect(shown?.rankings).toEqual([expect.objectContaining({ category: 'flights', value: 5 })])
    const own = async () => {
      const context = apiContext(db, new Request(`${testOrigin}/api/me/rankings`))
      const response = await getMyRankings({
        ...context,
        data: { user: { id: 'public-owner' } },
      } as unknown as Parameters<typeof getMyRankings>[0])
      return (await response.json()) as Array<{ category: string; value: number }>
    }
    expect(await own()).toEqual([expect.objectContaining({ category: 'flights', value: 5 })])
    expect(await readPublicLeaderboard(db, 'flights')).toMatchObject({
      total: 1,
      updatedAt: '2026-10-04T12:00:00.000Z',
    })
    await db
      .prepare('UPDATE user_derived_state SET revision=2 WHERE user_id=?')
      .bind('public-owner')
      .run()
    expect(await readPublicProfile(db, 'traveller')).toMatchObject({
      derivedState: 'pending',
      rankings: [],
    })
    expect(await readPublicLeaderboard(db, 'flights')).toMatchObject({
      entries: [],
      total: 0,
      updatedAt: null,
    })
    await db
      .prepare('UPDATE user_derived_state SET published_revision=2 WHERE user_id=?')
      .bind('public-owner')
      .run()
    await db
      .prepare('UPDATE profiles SET show_on_leaderboards=0 WHERE id=?')
      .bind('public-owner')
      .run()
    expect(await readPublicLeaderboard(db, 'flights')).toMatchObject({ entries: [], total: 0 })
    await db.prepare('UPDATE profiles SET is_public=0 WHERE id=?').bind('public-owner').run()
    await db
      .prepare('UPDATE profiles SET show_on_leaderboards=1 WHERE id=?')
      .bind('public-owner')
      .run()
    // A private owner has no place: the rebuild drops private members, and the owner read agrees at once.
    expect(await own()).toEqual([])
    const hidden = await readPublicProfile(db, 'traveller')
    expect(hidden).toMatchObject({
      profile: {
        id: 'public-owner',
        username: 'traveller',
        display_name: null,
        bio: null,
        avatar_url: null,
        theme_color: null,
        created_at: null,
      },
      stats: null,
      badges: [],
      rankings: [],
      derivedState: 'private',
    })
    expect(JSON.stringify(hidden)).not.toContain('Sensitive')
    expect(JSON.stringify(hidden)).not.toContain('private@example.test')
  } finally {
    await dispose()
  }
})

it('propagates unavailable public read models instead of reporting a confirmed empty result', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.prepare('DROP TABLE leaderboard_cache').run()
    await expect(readPublicLeaderboard(db, 'flights')).rejects.toThrow()
  } finally {
    await dispose()
  }
})

it('ranks visible cached members with competition ties before pagination and owner lookup', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const values = [100, 90, 80, 70, 70, 60]
    const ranks = [1, 2, 3, 4, 4, 6]
    for (const [i, value] of values.entries()) {
      const id = `rank-${i}`
      await db.batch([
        db
          .prepare('INSERT INTO users(id,email,password_hash) VALUES (?,?,?)')
          .bind(id, `${id}@example.test`, 'hash'),
        db
          .prepare(
            'INSERT INTO profiles(id,username,is_public,show_on_leaderboards) VALUES (?,?,1,1)',
          )
          .bind(id, id),
        db.prepare('INSERT INTO user_stats(user_id,total_flights) VALUES (?,?)').bind(id, value),
        db
          .prepare(
            'INSERT INTO user_derived_state(user_id,revision,published_revision) VALUES (?,1,1)',
          )
          .bind(id),
        ...['all', '2026'].map((period) =>
          db
            .prepare(
              "INSERT INTO leaderboard_cache(user_id,category,period,value,rank,percentile,metadata,updated_at) VALUES (?,'flights',?,?,?,0,'{}','2026-10-15T00:00:00Z')",
            )
            .bind(id, period, value, ranks[i]),
        ),
      ])
    }
    // Changes after publication must remove members and close their places immediately.
    await db.batch([
      db.prepare("UPDATE profiles SET is_public=0 WHERE id='rank-0'"),
      db.prepare("UPDATE profiles SET show_on_leaderboards=0 WHERE id='rank-1'"),
      db.prepare("UPDATE user_derived_state SET revision=2 WHERE user_id='rank-2'"),
    ])
    const expected = [
      { user_id: 'rank-3', rank: 1, percentile: 66.7 },
      { user_id: 'rank-4', rank: 1, percentile: 66.7 },
      { user_id: 'rank-5', rank: 3, percentile: 0 },
    ]
    const board = await readLeaderboardBoard(db, 'rank-5', new Date('2026-10-15T00:00:00Z'))
    for (const period of ['all', '2026']) {
      expect(board.boards.flights[period]).toMatchObject({ top: expected, total: 3 })
      expect(board.viewer?.places.flights[period]).toMatchObject({
        state: 'ranked',
        entry: expected[2],
        neighbours: expected,
        next: { entry: expected[1], gap: 10 },
      })
    }
    expect(await readPublicLeaderboard(db, 'flights', 1, 1)).toMatchObject({
      entries: [expected[1]],
      total: 3,
    })
    expect(await readOwnLeaderboardRank(db, 'rank-3', 'flights')).toMatchObject({
      entry: expected[0],
    })
    expect((await readPublicProfile(db, 'rank-3'))?.rankings).toMatchObject([expected[0]])
    const context = apiContext(db, new Request(`${testOrigin}/api/me/rankings`))
    const response = await getMyRankings({
      ...context,
      data: { user: { id: 'rank-3' } },
    } as unknown as Parameters<typeof getMyRankings>[0])
    expect(await response.json()).toMatchObject([expected[0]])
  } finally {
    await dispose()
  }
})
