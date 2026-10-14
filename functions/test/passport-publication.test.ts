// Unified Passport server contracts (ADR 0007): the public country projection per publication scope, the owner
// preview, the publication opt-in and hiding. Hide is presentation only; evidence and counts stay factual.
import { describe, expect, it } from 'vitest'
import { accountWith, USER } from './country-fixture'
import { apiContext, csrfRequest } from './harness'
import {
  onRequestPut as hideCountry,
  onRequestDelete as unhideCountry,
} from '../api/passport/hidden/[cc]/index'
import { updateProfileRequest } from '../api/profiles/me'
import { readPassport } from '../api/_services/passport'
import { readPublicProfile, readPublicProfilePreview } from '../api/_services/publicProfiles'

const FLIGHT_DATE = '2019-07-04'
const CLAIM_DATE = '2018-05-06T07:08:09.000Z'

/**
 * GE+TR: logged flight. US+GB: awaiting flight only (pending). FR: claim. JP: ground visit. TR is then hidden.
 * Pressed: FR, GE, JP, TR. Pending: GB, US.
 */
async function fixture(options: { isPublic: boolean; publication: 'flights' | 'all' }) {
  const account = await accountWith(
    [
      { id: 1, date: FLIGHT_DATE, origin: 'TBS', destination: 'IST', state: 'logged' },
      { id: 2, date: '2019-08-01', origin: 'JFK', destination: 'LHR', state: 'awaiting' },
    ],
    (db) => [
      db
        .prepare('INSERT INTO country_claims (id,user_id,country_code,claimed_at) VALUES (?,?,?,?)')
        .bind('c1', USER.id, 'FR', CLAIM_DATE),
      db
        .prepare('INSERT INTO ground_visits (id,user_id,country_code,visit_year) VALUES (?,?,?,?)')
        .bind('g1', USER.id, 'JP', 2017),
      db
        .prepare(
          'UPDATE profiles SET username = ?, is_public = ?, passport_publication = ? WHERE id = ?',
        )
        .bind('pilot', options.isPublic ? 1 : 0, options.publication, USER.id),
    ],
  )
  return account
}

async function hide(db: D1Database, cc: string, method: 'PUT' | 'DELETE' = 'PUT', user = true) {
  const request = csrfRequest(`/api/passport/hidden/${cc}`, method)
  const context = {
    ...apiContext(db, request),
    data: { user: user ? USER : null },
    params: { cc },
  } as never
  return (method === 'PUT' ? hideCountry : unhideCountry)(context)
}

async function patch(db: D1Database, body: unknown) {
  return updateProfileRequest(csrfRequest('/api/profiles/me', 'PATCH', body), { DB: db } as Env, {
    user: USER,
  })
}

const FLIGHTS_SET = ['GB', 'GE', 'US']
const ALL_SET = ['FR', 'GE', 'JP']

describe('public projection', () => {
  const cases = [
    { isPublic: true, publication: 'flights', expected: FLIGHTS_SET },
    { isPublic: true, publication: 'all', expected: ALL_SET },
    { isPublic: false, publication: 'flights', expected: [] },
    { isPublic: false, publication: 'all', expected: [] },
  ] as const

  it.each(cases)(
    'public=$isPublic publication=$publication publishes codes only',
    async ({ isPublic, publication, expected }) => {
      const { db, dispose } = await fixture({ isPublic, publication })
      try {
        await db
          .prepare('INSERT INTO passport_hidden_countries VALUES (?,?,?)')
          .bind(USER.id, 'TR', '2026-01-01T00:00:00.000Z')
          .run()
        const profile = await readPublicProfile(db, 'pilot')
        expect(profile?.countries).toEqual(expected)
        if (!isPublic) {
          expect(profile).toMatchObject({
            derivedState: 'private',
            publication: null,
            stats: null,
            badges: [],
            rankings: [],
          })
          expect(profile?.profile).toMatchObject({ display_name: null, bio: null })
        } else {
          expect(profile?.publication).toBe(publication)
        }
        for (const code of profile?.countries ?? []) expect(code).toMatch(/^[A-Z]{2}$/)
        const text = JSON.stringify(profile)
        for (const secret of [
          FLIGHT_DATE,
          '2019-08-01',
          CLAIM_DATE.slice(0, 10),
          'first_visit',
          'last_visit',
          'visit_count',
          'claimed',
          'ground',
        ])
          expect(text).not.toContain(secret)
      } finally {
        await dispose()
      }
    },
  )

  it.each(cases)(
    'preview scope=$publication reveals the would-be set even when public=$isPublic',
    async ({ isPublic, publication }) => {
      const { db, dispose } = await fixture({ isPublic, publication: 'flights' })
      try {
        await db
          .prepare('INSERT INTO passport_hidden_countries VALUES (?,?,?)')
          .bind(USER.id, 'TR', '2026-01-01T00:00:00.000Z')
          .run()
        const preview = await readPublicProfilePreview(db, USER.id, publication)
        expect(preview?.countries).toEqual(publication === 'all' ? ALL_SET : FLIGHTS_SET)
        expect(preview?.publication).toBe(publication)
        expect(preview?.rankings).toEqual([])
        expect(JSON.stringify(preview)).not.toContain(FLIGHT_DATE)
      } finally {
        await dispose()
      }
    },
  )

  it('returns to the flights-only set when the owner opts out of all', async () => {
    const { db, dispose } = await fixture({ isPublic: true, publication: 'flights' })
    try {
      expect((await patch(db, { passport_publication: 'all' })).status).toBe(200)
      expect((await readPublicProfile(db, 'pilot'))?.countries).toEqual(['FR', 'GE', 'JP', 'TR'])
      const back = await patch(db, { passport_publication: 'flights' })
      expect(await back.json()).toMatchObject({ passport_publication: 'flights' })
      expect((await readPublicProfile(db, 'pilot'))?.countries).toEqual(['GB', 'GE', 'TR', 'US'])
    } finally {
      await dispose()
    }
  })

  it('rejects an unknown passport_publication', async () => {
    const { db, dispose } = await fixture({ isPublic: true, publication: 'flights' })
    try {
      const response = await patch(db, { passport_publication: 'everything' })
      expect(response.status).toBe(400)
      expect(
        (await db.prepare('SELECT passport_publication p FROM profiles').first<{ p: string }>())?.p,
      ).toBe('flights')
    } finally {
      await dispose()
    }
  })
})

describe('hidden countries', () => {
  it('hides and restores idempotently without touching the factual counts', async () => {
    const { db, dispose } = await fixture({ isPublic: true, publication: 'all' })
    try {
      const before = await readPassport(db, USER.id)
      expect(before.pressedCountryCount).toBe(4)
      expect(before.hidden).toEqual([])

      for (let i = 0; i < 2; i++) {
        const response = await hide(db, 'TR')
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true, hidden: ['TR'] })
      }
      const after = await readPassport(db, USER.id)
      expect(after.hidden).toEqual(['TR'])
      expect(after.pressedCountryCount).toBe(4)
      expect(after.visibleCountryCount).toBe(3)
      expect(after.flightCountryCount).toBe(before.flightCountryCount)
      expect(after.countries.map((c) => c.country_code)).not.toContain('TR')
      expect(after.pendingCountryCount).toBe(before.pendingCountryCount)
      const evidence = await db
        .prepare(
          "SELECT status FROM country_visit_evidence WHERE user_id = ? AND country_code = 'TR'",
        )
        .bind(USER.id)
        .first<{ status: string }>()
      expect(evidence?.status).toBe('pressed')

      for (let i = 0; i < 2; i++)
        expect(await (await hide(db, 'TR', 'DELETE')).json()).toEqual({ ok: true, hidden: [] })
      expect((await readPassport(db, USER.id)).visibleCountryCount).toBe(4)
    } finally {
      await dispose()
    }
  })

  it('drops hidden pending countries from the pending count and refuses pending or absent ones', async () => {
    const { db, dispose } = await fixture({ isPublic: true, publication: 'all' })
    try {
      expect((await hide(db, 'US')).status).toBe(409)
      expect((await hide(db, 'AU')).status).toBe(409)
      expect((await hide(db, 'usa')).status).toBe(400)
      expect((await readPassport(db, USER.id)).hidden).toEqual([])
    } finally {
      await dispose()
    }
  })

  it('requires a session and a CSRF token', async () => {
    const { db, dispose } = await fixture({ isPublic: true, publication: 'all' })
    try {
      expect((await hide(db, 'TR', 'PUT', false)).status).toBe(401)
      const bare = new Request('https://kuuki.test/api/passport/hidden/TR', {
        method: 'PUT',
        headers: { Origin: 'https://kuuki.test' },
      })
      const response = await hideCountry({
        ...apiContext(db, bare),
        data: { user: USER },
        params: { cc: 'TR' },
      } as never)
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect((await readPassport(db, USER.id)).hidden).toEqual([])
    } finally {
      await dispose()
    }
  })
})
