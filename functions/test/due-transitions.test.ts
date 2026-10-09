// T09 / ADR 0001 §2 and §8: the one due-transition function (upcoming -> awaiting -> automatic), the owner sync
// contract (R1, A9), the revision guard, per-user caps with the stored deadline as the cursor, and A6's boundaries.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiContext, csrfRequest } from './harness'
import {
  accountWith,
  at,
  flightStatement,
  publish,
  USER,
  type FixtureFlight,
} from './country-fixture'
import { hasSql, instrumentDb } from './db-hooks'
import { lifecycleOf } from './lifecycle-fixture'
import { applyDueTransitions, deadlinesFor, DUE_TRANSITION_LIMIT } from '../api/_services/lifecycle'
import { dirtyUserStatement, stateOf } from '../api/_services/derivedState'
import { onRequestPost as syncRoute } from '../api/flights/sync-upcoming'
import maintenance from '../../workers/maintenance/index'

const NOW = new Date('2026-10-05T12:00:00.000Z')
const T = NOW.toISOString()
afterEach(() => {
  vi.useRealTimers()
})

const upcoming = (id: number, over: Partial<FixtureFlight> = {}): FixtureFlight => ({
  id,
  date: '2026-10-03',
  origin: 'TBS',
  destination: 'IST',
  state: 'upcoming',
  awaitingAfter: '2026-10-04T00:00:00.000Z',
  autoAfter: '2026-10-11T00:00:00.000Z',
  ...over,
})
const syncCtx = (db: D1Database) =>
  ({
    ...apiContext(db, csrfRequest('/api/flights/sync-upcoming', 'POST')),
    data: { user: USER },
    params: {},
  }) as never
const states = (db: D1Database) =>
  db
    .prepare(
      'SELECT id, lifecycle_state AS s, confirmation_source AS c, arrival_transit AS t, arrival_transit_leg_id AS leg FROM flights ORDER BY id',
    )
    .all()
    .then((r) => r.results)

describe('applyDueTransitions', () => {
  it('moves a due upcoming flight to awaiting only, keeping both stored deadlines', async () => {
    const { db, dispose } = await accountWith([upcoming(1)])
    try {
      expect(await applyDueTransitions(db, { userId: USER.id, now: NOW })).toEqual({
        awaited: 1,
        autoConfirmed: 0,
        synced: 1,
        more: false,
      })
      expect(await lifecycleOf(db, 1)).toMatchObject({
        lifecycle_state: 'awaiting',
        is_upcoming: 0,
        confirmation_source: null,
        awaiting_after: '2026-10-04T00:00:00.000Z',
        auto_confirm_after: '2026-10-11T00:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })

  it('a flight past both deadlines passes awaiting and auto-confirms in one pass, counted once in synced', async () => {
    const { db, dispose } = await accountWith([
      upcoming(1, {
        date: '2026-09-20',
        awaitingAfter: '2026-09-21T00:00:00.000Z',
        autoAfter: '2026-09-28T00:00:00.000Z',
      }),
    ])
    try {
      expect(await applyDueTransitions(db, { userId: USER.id, now: NOW })).toEqual({
        awaited: 1,
        autoConfirmed: 1,
        synced: 1,
        more: false,
      })
      expect(await lifecycleOf(db, 1)).toMatchObject({
        lifecycle_state: 'logged',
        is_upcoming: 0,
        confirmation_source: 'automatic',
        confirmed_at: T,
        arrival_transit: 0,
        arrival_transit_leg_id: null,
        awaiting_after: '2026-09-21T00:00:00.000Z',
        auto_confirm_after: '2026-09-28T00:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })

  it('A6: the auto-confirm boundary is exact to the millisecond', async () => {
    const { db, dispose } = await accountWith([upcoming(1, { state: 'awaiting', autoAfter: T })])
    try {
      const before = await applyDueTransitions(db, {
        userId: USER.id,
        now: new Date(NOW.getTime() - 1),
      })
      expect(before).toMatchObject({ autoConfirmed: 0, synced: 0 })
      expect((await lifecycleOf(db, 1))!.lifecycle_state).toBe('awaiting')
      expect(await applyDueTransitions(db, { userId: USER.id, now: NOW })).toMatchObject({
        autoConfirmed: 1,
        synced: 1,
      })
      expect(await lifecycleOf(db, 1)).toMatchObject({
        lifecycle_state: 'logged',
        confirmation_source: 'automatic',
        confirmed_at: T,
      })
    } finally {
      await dispose()
    }
  })

  it('A6: stored deadlines in DST-midnight and extreme zones decide the boundary, not the server clock', async () => {
    const zones = [
      'America/Santiago',
      'America/Havana',
      'Pacific/Kiritimati',
      'Pacific/Pago_Pago',
      'UTC',
    ]
    const dates = ['2026-09-06', '2026-03-08', '2026-10-05']
    const flights: FixtureFlight[] = []
    zones.forEach((tz, zi) =>
      dates.forEach((date, di) => {
        const d = deadlinesFor(date, tz)
        flights.push(
          upcoming(zi * 10 + di + 1, {
            date,
            tz,
            awaitingAfter: d.awaiting_after,
            autoAfter: d.auto_confirm_after,
          }),
        )
      }),
    )
    const { db, dispose } = await accountWith([])
    try {
      for (const flight of flights) {
        await db.batch([db.prepare('DELETE FROM flights'), flightStatement(db, flight)])
        const at = (iso: string, offset = 0) => new Date(Date.parse(iso) + offset)
        const step = (now: Date) => applyDueTransitions(db, { userId: USER.id, now })
        const label = `${flight.tz} ${flight.date}`
        await step(at(flight.awaitingAfter!, -1))
        expect(
          (await lifecycleOf(db, flight.id))!.lifecycle_state,
          `${label} 1 ms before awaiting`,
        ).toBe('upcoming')
        await step(at(flight.awaitingAfter!))
        expect((await lifecycleOf(db, flight.id))!.lifecycle_state, `${label} on awaiting`).toBe(
          'awaiting',
        )
        await step(at(flight.autoAfter!, -1))
        expect(
          (await lifecycleOf(db, flight.id))!.lifecycle_state,
          `${label} 1 ms before auto-confirm`,
        ).toBe('awaiting')
        await step(at(flight.autoAfter!))
        expect(
          (await lifecycleOf(db, flight.id))!.lifecycle_state,
          `${label} on auto-confirm`,
        ).toBe('logged')
      }
    } finally {
      await dispose()
    }
  }, 60_000)

  it('writes the effective policy: transit with the matched leg for a third-country connection, include otherwise', async () => {
    const { db, dispose } = await accountWith([
      upcoming(1, {
        date: '2026-09-20',
        awaitingAfter: '2026-09-21T00:00:00.000Z',
        autoAfter: '2026-09-28T00:00:00.000Z',
      }),
      {
        id: 2,
        date: '2026-09-21',
        origin: 'IST',
        destination: 'JFK',
        state: 'upcoming',
        awaitingAfter: '2099-01-01T00:00:00.000Z',
        autoAfter: '2099-02-01T00:00:00.000Z',
      },
      upcoming(3, {
        date: '2026-09-01',
        origin: 'LHR',
        destination: 'DXB',
        awaitingAfter: '2026-09-02T00:00:00.000Z',
        autoAfter: '2026-09-09T00:00:00.000Z',
      }),
    ])
    try {
      await applyDueTransitions(db, { userId: USER.id, now: NOW })
      expect(await states(db)).toEqual([
        { id: 1, s: 'logged', c: 'automatic', t: 1, leg: 2 },
        { id: 2, s: 'upcoming', c: null, t: null, leg: null },
        { id: 3, s: 'logged', c: 'automatic', t: 0, leg: null },
      ])
    } finally {
      await dispose()
    }
  })

  it('the auto-confirm update is guarded by the revision it read: a concurrent mutation makes it a no-op that the next pass retries', async () => {
    const { db: raw, dispose } = await accountWith([
      upcoming(1, { state: 'awaiting', autoAfter: '2026-10-05T00:00:00.000Z' }),
      upcoming(2, { date: '2026-10-04', awaitingAfter: '2026-10-05T00:00:00.000Z' }),
    ])
    try {
      const { db, hooks } = instrumentDb(raw)
      hooks.beforeBatch(hasSql("confirmation_source = 'automatic'"), async () => {
        await dirtyUserStatement(raw, USER.id).run()
      })
      const first = await applyDueTransitions(db, { userId: USER.id, now: NOW })
      expect(first).toEqual({ awaited: 1, autoConfirmed: 0, synced: 1, more: true }) // the move to awaiting is unguarded, the confirm lost the race
      expect((await lifecycleOf(raw, 1))!.lifecycle_state).toBe('awaiting')
      await publish(raw)
      expect(await applyDueTransitions(db, { userId: USER.id, now: NOW })).toEqual({
        awaited: 0,
        autoConfirmed: 1,
        synced: 1,
        more: false,
      })
    } finally {
      await dispose()
    }
  })

  it('caps work per user and direction, oldest stored deadline first, and continues without moving eligibility', async () => {
    const total = DUE_TRANSITION_LIMIT + 20
    const flights = Array.from({ length: total }, (_, i) =>
      upcoming(i + 1, {
        awaitingAfter: at('2026-10-01T00:00:00.000Z', i / 60),
        autoAfter: '2026-10-20T00:00:00.000Z',
      }),
    )
    const { db, dispose } = await accountWith(flights)
    try {
      expect(await applyDueTransitions(db, { userId: USER.id, now: NOW })).toEqual({
        awaited: DUE_TRANSITION_LIMIT,
        autoConfirmed: 0,
        synced: DUE_TRANSITION_LIMIT,
        more: true,
      })
      const left = (
        await db
          .prepare("SELECT id FROM flights WHERE lifecycle_state = 'upcoming' ORDER BY id")
          .all<{ id: number }>()
      ).results.map((r) => r.id)
      expect(left).toEqual(Array.from({ length: 20 }, (_, i) => DUE_TRANSITION_LIMIT + i + 1)) // the newest deadlines wait
      expect(await applyDueTransitions(db, { userId: USER.id, now: NOW })).toEqual({
        awaited: 20,
        autoConfirmed: 0,
        synced: 20,
        more: false,
      })
      const deadlines = (
        await db
          .prepare('SELECT awaiting_after FROM flights ORDER BY id')
          .all<{ awaiting_after: string }>()
      ).results.map((r) => r.awaiting_after)
      expect(deadlines).toEqual(flights.map((f) => f.awaitingAfter)) // nothing was recomputed
    } finally {
      await dispose()
    }
  }, 60_000)

  it('catches missed days up in one pass without resetting eligibility', async () => {
    const { db, dispose } = await accountWith([
      upcoming(1, {
        date: '2026-08-01',
        awaitingAfter: '2026-08-02T00:00:00.000Z',
        autoAfter: '2026-08-09T00:00:00.000Z',
      }),
      upcoming(2, {
        date: '2026-09-30',
        awaitingAfter: '2026-10-01T00:00:00.000Z',
        autoAfter: '2026-10-08T00:00:00.000Z',
      }),
    ])
    try {
      expect(await applyDueTransitions(db, { userId: USER.id, now: NOW })).toMatchObject({
        awaited: 2,
        autoConfirmed: 1,
        synced: 2,
      })
      expect(await lifecycleOf(db, 1)).toMatchObject({
        lifecycle_state: 'logged',
        confirmation_source: 'automatic',
        auto_confirm_after: '2026-08-09T00:00:00.000Z',
      })
      expect(await lifecycleOf(db, 2)).toMatchObject({
        lifecycle_state: 'awaiting',
        auto_confirm_after: '2026-10-08T00:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })
})

describe('owner sync (R1) and A9', () => {
  it('returns synced, awaited, autoConfirmed, more and the publication outcome', async () => {
    const { db, dispose } = await accountWith([
      upcoming(1),
      upcoming(2, {
        date: '2026-09-20',
        awaitingAfter: '2026-09-21T00:00:00.000Z',
        autoAfter: '2026-09-28T00:00:00.000Z',
      }),
    ])
    try {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      const response = await syncRoute(syncCtx(db))
      expect(response.status).toBe(200)
      const body = (await response.json()) as Record<string, unknown>
      expect(body).toMatchObject({
        synced: 2,
        awaited: 2,
        autoConfirmed: 1,
        more: false,
        derived_state: 'ready',
      })
      const state = await stateOf(db, USER.id)
      expect(state).toMatchObject({
        revision: body.revision,
        published_revision: body.revision,
        evidence_revision: body.revision,
      })
      // Nothing due: a quiet call reports zeros and does not touch the publication.
      expect(await (await syncRoute(syncCtx(db))).json()).toEqual({
        synced: 0,
        awaited: 0,
        autoConfirmed: 0,
        more: false,
      })
    } finally {
      await dispose()
    }
  })

  it('A9: a Next-only session moves flights to awaiting and auto-confirms while the cron is held', async () => {
    const { db, dispose } = await accountWith([
      upcoming(1),
      upcoming(2, {
        date: '2026-09-20',
        awaitingAfter: '2026-09-21T00:00:00.000Z',
        autoAfter: '2026-09-28T00:00:00.000Z',
      }),
    ])
    try {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      const held = new Proxy(
        {},
        {
          get() {
            throw new Error('the held cron must not touch the database')
          },
        },
      ) as D1Database
      await maintenance.scheduled({} as ScheduledEvent, { DB: held, MAINTENANCE_MODE: 'true' })
      expect(await states(db)).toMatchObject([
        { id: 1, s: 'upcoming' },
        { id: 2, s: 'upcoming' },
      ]) // nothing moved without the sync
      await syncRoute(syncCtx(db))
      expect(await states(db)).toMatchObject([
        { id: 1, s: 'awaiting' },
        { id: 2, s: 'logged', c: 'automatic' },
      ])
    } finally {
      await dispose()
    }
  })

  it("requires CSRF and an authenticated owner, and only moves the caller's flights", async () => {
    const { db, dispose } = await accountWith([upcoming(1)])
    try {
      await db.batch([
        db
          .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
          .bind('u2', 'u2@example.test', 'hash'),
        flightStatement(db, upcoming(2, { user: 'u2' })),
      ])
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      expect(
        (
          await syncRoute({
            ...apiContext(
              db,
              new Request('https://kuuki.test/api/flights/sync-upcoming', { method: 'POST' }),
            ),
            data: { user: USER },
            params: {},
          } as never)
        ).status,
      ).toBe(403)
      expect(
        (
          await syncRoute({
            ...apiContext(db, csrfRequest('/api/flights/sync-upcoming', 'POST')),
            data: { user: null },
            params: {},
          } as never)
        ).status,
      ).toBe(401)
      expect(await states(db)).toMatchObject([
        { id: 1, s: 'upcoming' },
        { id: 2, s: 'upcoming' },
      ])
      expect(await (await syncRoute(syncCtx(db))).json()).toMatchObject({ synced: 1 })
      expect(await states(db)).toMatchObject([
        { id: 1, s: 'awaiting' },
        { id: 2, s: 'upcoming' },
      ]) // the other member is untouched
    } finally {
      await dispose()
    }
  })
})
