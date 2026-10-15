import { expect, it } from 'vitest'
import { onRequestGet as checkUsername } from '../api/profiles/check-username'
import { updateProfileRequest } from '../api/profiles/me'
import { onRequestPost as markOnboarded } from '../api/profiles/me/onboarded'
import { createUserWithProfile } from '../api/_lib/users'
import { apiContext, createApiDatabase, csrfRequest } from './harness'

async function setup(count = 3) {
  const { db, dispose } = await createApiDatabase()
  const users: { id: string; email: string }[] = []
  for (let i = 0; i < count; i++) {
    const u = await createUserWithProfile(
      db,
      { email: `u${i}@example.test`, password: 'password-1234' },
      'secret',
    )
    users.push({ id: u.id, email: u.email })
  }
  const patch = (user: (typeof users)[number], body: unknown) =>
    updateProfileRequest(csrfRequest('/api/profiles/me', 'PATCH', body), { DB: db } as Env, {
      user,
    })
  return { db, dispose, users, patch }
}

type Profile = { username: string | null; display_name: string | null; onboarded_at: string | null }
const read = async (res: Response) => (await res.json()) as Profile & { code?: string }

it('a derived address that collides gets the next free suffix, an edited one gets 409', async () => {
  const { dispose, users, patch } = await setup()
  try {
    expect(
      (await read(await patch(users[0], { username: 'alex-mor', username_derived: true })))
        .username,
    ).toBe('alex-mor')
    expect(
      (await read(await patch(users[1], { username: 'alex-mor', username_derived: true })))
        .username,
    ).toBe('alex-mor-2')
    expect(
      (await read(await patch(users[2], { username: 'ALEX-mor', username_derived: true })))
        .username,
    ).toBe('alex-mor-3')

    const taken = await patch(users[2], { username: 'Alex-Mor' })
    expect(taken.status).toBe(409)
    expect(await taken.json()).toMatchObject({ code: 'CONFLICT' })
  } finally {
    await dispose()
  }
})

it('rejects malformed usernames and names, and stores a normalized name', async () => {
  const { dispose, users, patch } = await setup(1)
  try {
    for (const username of ['ab', '-abc', 'has space', 'x'.repeat(31), null, '']) {
      const res = await patch(users[0], { username })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'INVALID_USERNAME' })
    }
    for (const display_name of ['x'.repeat(41), '   ']) {
      const res = await patch(users[0], { display_name })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'INVALID_NAME' })
    }
    expect((await patch(users[0], { display_name: 'x'.repeat(40) })).status).toBe(200)
    expect(
      (await read(await patch(users[0], { display_name: '  Alex   Mor ' }))).display_name,
    ).toBe('Alex Mor')
  } finally {
    await dispose()
  }
})

it('the onboarded endpoint stamps once and replays the same timestamp', async () => {
  const { db, dispose, users } = await setup(1)
  try {
    await db.prepare('UPDATE profiles SET onboarded_at = NULL').run()
    const call = () =>
      markOnboarded({
        ...apiContext(db, csrfRequest('/api/profiles/me/onboarded', 'POST')),
        data: { user: users[0] },
      } as never)
    const first = (await (await call()).json()) as { onboarded_at: string }
    expect(first.onboarded_at).toMatch(/^\d{4}-/)
    await new Promise((r) => setTimeout(r, 5))
    expect(await (await call()).json()).toEqual(first)

    await db.prepare('DELETE FROM profiles').run()
    expect((await call()).status).toBe(404)
  } finally {
    await dispose()
  }
})

it('only onboarded members without an address get a lazy one on save', async () => {
  const { db, dispose, users, patch } = await setup(2)
  try {
    await db.prepare('UPDATE profiles SET onboarded_at = NULL, username = NULL').run()
    await db
      .prepare('UPDATE profiles SET onboarded_at = ? WHERE id = ?')
      .bind('2026-10-01T00:00:00.000Z', users[1].id)
      .run()
    await patch(users[0], { display_name: 'Alex Mor' })
    await patch(users[1], { display_name: 'Alex Mor' })

    expect((await read(await patch(users[0], { is_public: true }))).username).toBeNull()
    const lazy = await read(await patch(users[1], { is_public: true }))
    expect(lazy.username).toBe('alex-mor')
    // Once set, a later save leaves it alone.
    expect((await read(await patch(users[1], { display_name: 'Someone Else' }))).username).toBe(
      'alex-mor',
    )
  } finally {
    await dispose()
  }
})

it('check-username reports pattern validity separately from availability', async () => {
  const { db, dispose, users, patch } = await setup(2)
  try {
    await patch(users[0], { username: 'taken_one' })
    const check = async (username: string, user = users[1]) =>
      (
        await checkUsername({
          ...apiContext(
            db,
            new Request(
              `https://kuuki.test/api/profiles/check-username?username=${encodeURIComponent(username)}`,
            ),
          ),
          data: { user },
        } as never)
      ).json()
    expect(await check('ab')).toEqual({ available: false, valid: false })
    expect(await check('bad name')).toEqual({ available: false, valid: false })
    expect(await check('Taken_One')).toEqual({ available: false, valid: true })
    expect(await check('taken_one', users[0])).toEqual({ available: true, valid: true })
    expect(await check('free-name')).toEqual({ available: true, valid: true })
  } finally {
    await dispose()
  }
})

it('stores only canonical accent names in theme_color and keeps the stored one on rejection', async () => {
  const { dispose, users, patch } = await setup(1)
  try {
    const saved = await patch(users[0], { theme_color: 'sakura' })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ theme_color: 'sakura' })
    // Retired names, other colours and the empty string are all refused; the client maps legacy names before writing.
    for (const theme_color of ['terracotta', 'blue', '#c23417', 'Shu', '', 7]) {
      const res = await patch(users[0], { theme_color })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'BAD_REQUEST', error: 'Invalid theme_color' })
    }
    const unrelated = await patch(users[0], { bio: 'hello' })
    expect(await unrelated.json()).toMatchObject({ theme_color: 'sakura' })
    const cleared = await patch(users[0], { theme_color: null })
    expect(await cleared.json()).toMatchObject({ theme_color: null })
  } finally {
    await dispose()
  }
})

it('stores a known avatar character, refuses others and null returns to the derived one', async () => {
  const { dispose, users, patch } = await setup(1)
  try {
    const saved = await patch(users[0], { avatar_face: 'sleepy' })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ avatar_face: 'sleepy' })
    for (const avatar_face of ['Sleepy', 'smile', '', 3]) {
      const res = await patch(users[0], { avatar_face })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'BAD_REQUEST', error: 'Invalid avatar_face' })
    }
    const cleared = await patch(users[0], { avatar_face: null })
    expect(await cleared.json()).toMatchObject({ avatar_face: null })
  } finally {
    await dispose()
  }
})
