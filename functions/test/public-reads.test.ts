import { expect, it } from 'vitest'
import { createApiDatabase } from './harness'
import { readPublicProfile } from '../api/_services/publicProfiles'
import { readPublicLeaderboard } from '../api/_services/publicLeaderboard'
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
