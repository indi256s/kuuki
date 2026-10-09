import { expect, it } from 'vitest'
import { createApiDatabase } from './harness'
import { readPublicProfile } from '../api/_services/publicProfiles'
import { readPublicLeaderboard } from '../api/_services/publicLeaderboard'

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
          "INSERT INTO leaderboard_cache(user_id,category,value,rank,metadata,updated_at) VALUES (?,'flights',5,1,?,?)",
        )
        .bind(
          'public-owner',
          JSON.stringify({ username: 'traveller' }),
          '2026-10-04T12:00:00.000Z',
        ),
    ])
    expect(await readPublicProfile(db, 'TRAVELLER')).toMatchObject({
      stats: { total_flights: 5 },
      rankings: [{ rank: 1 }],
    })
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
