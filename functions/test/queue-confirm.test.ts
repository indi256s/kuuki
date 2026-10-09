// T09 / ADR 0001 §5 and C4: the awaiting queue, atomic confirmation receipts, replay, mixed invalid state,
// cross-account access, post-commit repair failure and concurrency (A3, A7, A8).
import { describe, expect, it } from 'vitest'
import { apiContext, count, csrfRequest } from './harness'
import { hasSql, instrumentDb } from './db-hooks'
import {
  FLIGHTS,
  USER,
  addUser,
  getAwaiting,
  operationId,
  postConfirm,
  queueAccount,
  tokens,
} from './queue-fixture'
import { flightStatement, publish } from './country-fixture'
import { onRequestGet as listPassport } from '../api/passport/countries/index'
import { onRequestGet as getOverview } from '../api/me/overview/data'
import { onRequestPost as confirmRoute } from '../api/flights/confirm'
import { stateOf } from '../api/_services/derivedState'

const flightRow = (db: D1Database, id: number) =>
  db
    .prepare(
      'SELECT lifecycle_state AS s, confirmation_source AS src, confirmed_at AS at, arrival_transit AS t, arrival_transit_leg_id AS leg FROM flights WHERE id = ?',
    )
    .bind(id)
    .first<any>()
const receipts = (db: D1Database) =>
  db
    .prepare(
      "SELECT operation_id, kind, complete, expected_count, applied_count, json_extract(result_json, '$.derivedState') IS NOT NULL AS frozen, pressed_before_json FROM lifecycle_operation_receipts ORDER BY created_at, operation_id",
    )
    .all()
    .then((r) => r.results as any[])
const item = (flightId: number, candidateToken: string, arrivalTransit?: boolean) => ({
  flightId,
  candidateToken,
  ...(arrivalTransit === undefined ? {} : { arrivalTransit }),
})

describe('GET /api/me/awaiting', () => {
  it('returns the owner queue with candidates, effective defaults, tokens, distinct counts and the latest revision', async () => {
    const { db, dispose } = await queueAccount(FLIGHTS, (d) => [
      d
        .prepare(
          "INSERT INTO import_batches (id,user_id,source_type,status,submission_operation_id,created_at,updated_at,expires_at) VALUES ('b1',?,'pdf','review','op-b1','2026-10-04T00:00:00.000Z','2026-10-04T00:00:00.000Z','2099-01-01T00:00:00.000Z')",
        )
        .bind(USER.id),
      d
        .prepare(
          "INSERT INTO import_batches (id,user_id,source_type,status,submission_operation_id,created_at,updated_at,expires_at) VALUES ('b2',?,'text','processing','op-b2','2026-10-04T01:00:00.000Z','2026-10-04T01:00:00.000Z','2099-01-01T00:00:00.000Z')",
        )
        .bind(USER.id),
      d
        .prepare(
          "INSERT INTO import_batches (id,user_id,source_type,status,submission_operation_id,created_at,updated_at,expires_at) VALUES ('b3',?,'text','review','op-b3','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','2026-02-01T00:00:00.000Z')",
        )
        .bind(USER.id),
      ...[
        ['d1', 'b1', 0, 'review'],
        ['d2', 'b1', 1, 'review'],
        ['d3', 'b1', 2, 'dismissed'],
        ['d4', 'b3', 0, 'review'],
      ].map(([id, batch, ordinal, status]) =>
        d
          .prepare(
            "INSERT INTO import_drafts (id,user_id,batch_id,ordinal,fields_json,status,created_at,updated_at) VALUES (?,?,?,?,'{}',?,'2026-10-04T00:00:00.000Z','2026-10-04T00:00:00.000Z')",
          )
          .bind(id, USER.id, batch, ordinal, status),
      ),
    ])
    try {
      const { status, body } = await getAwaiting(db)
      expect(status).toBe(200)
      expect(body).toMatchObject({
        awaitingFlightCount: 2,
        draftRowCount: 2,
        actionableCount: 4,
        derivedState: 'ready',
      })
      expect(body.revision).toBe((await stateOf(db, USER.id))!.revision)
      // Newest awaiting flight first (hero order); each flight carries its own candidate and token.
      expect(body.awaitingFlights.map((entry: any) => entry.flight.id).sort()).toEqual([1, 3])
      const one = body.awaitingFlights.find((entry: any) => entry.flight.id === 1)
      expect(one.flight).toMatchObject({
        lifecycle_state: 'awaiting',
        origin: 'TBS',
        destination: 'IST',
      })
      expect(one.candidate).toMatchObject({
        label: 'precise',
        legId: 2,
        hubCountry: 'TR',
        thirdCountry: true,
      })
      expect(one.candidate.leg).toMatchObject({ id: 2, origin: 'IST', destination: 'JFK' })
      expect(one.effectiveDefault).toEqual({
        transit: true,
        legId: 2,
        source: 'default',
        label: 'precise',
      })
      expect(one.candidateToken).toMatch(/^[0-9a-f]{64}$/)
      const three = body.awaitingFlights.find((entry: any) => entry.flight.id === 3)
      expect(three.candidate).toMatchObject({ label: null, legId: null })
      expect(three.effectiveDefault).toMatchObject({ transit: false, legId: null })
      expect(one.candidateToken).not.toBe(three.candidateToken)
      // Draft summaries: unexpired batches only; processing with no rows has a label but no count.
      expect(body.drafts).toEqual([
        {
          batchId: 'b2',
          sourceType: 'text',
          sourceLabel: null,
          status: 'processing',
          reviewRowCount: 0,
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        {
          batchId: 'b1',
          sourceType: 'pdf',
          sourceLabel: null,
          status: 'review',
          reviewRowCount: 2,
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      ])
    } finally {
      await dispose()
    }
  })

  it('is read-only: it changes no rows or revisions and issues no write statement', async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const { db, hooks } = instrumentDb(raw)
      const before = [
        await count(raw, 'flights'),
        await count(raw, 'user_derived_state'),
        await count(raw, 'lifecycle_operation_receipts'),
        JSON.stringify(await stateOf(raw, USER.id)),
      ]
      await getAwaiting(db)
      await getAwaiting(db)
      expect([
        await count(raw, 'flights'),
        await count(raw, 'user_derived_state'),
        await count(raw, 'lifecycle_operation_receipts'),
        JSON.stringify(await stateOf(raw, USER.id)),
      ]).toEqual(before)
      expect(hooks.sql.filter((sql) => !/^\s*SELECT/i.test(sql))).toEqual([])
    } finally {
      await dispose()
    }
  })

  it("requires an authenticated owner and never shows another member's flights", async () => {
    const { db, dispose } = await queueAccount()
    try {
      await addUser(db, 'u2')
      await db.batch([
        flightStatement(db, {
          id: 50,
          user: 'u2',
          date: '2026-10-01',
          origin: 'TBS',
          destination: 'KUT',
          state: 'awaiting',
        }),
      ])
      expect((await getAwaiting(db, null)).status).toBe(401)
      const mine = await getAwaiting(db)
      expect(mine.body.awaitingFlights.map((entry: any) => entry.flight.id).sort()).toEqual([1, 3])
      const theirs = await getAwaiting(db, { id: 'u2', email: 'u2@example.test' })
      expect(theirs.body.awaitingFlights.map((entry: any) => entry.flight.id)).toEqual([50])
      expect(theirs.body.awaitingFlightCount).toBe(1)
    } finally {
      await dispose()
    }
  })

  it('A7: the queue, Passport and Overview agree before and after a confirmation, and during a pending repair', async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const passport = async (db: D1Database) =>
        (await (
          await listPassport({
            ...apiContext(db, new Request('https://kuuki.test/api/passport/countries')),
            data: { user: USER },
            params: {},
          } as never)
        ).json()) as any
      const overview = async (db: D1Database) =>
        (await (
          await getOverview({
            ...apiContext(db, new Request('https://kuuki.test/api/me/overview/data')),
            data: { user: USER },
          } as never)
        ).json()) as any
      const before = await passport(raw)
      expect(
        before.countries
          .filter((row: any) => row.status === 'pending')
          .map((row: any) => row.country_code)
          .sort(),
      ).toEqual(['GB', 'GE'])
      expect(before.countries.map((row: any) => row.country_code)).not.toContain('TR') // the queue says transit by default
      const queue = await getAwaiting(raw)
      expect(
        queue.body.awaitingFlights.find((entry: any) => entry.flight.id === 1).effectiveDefault
          .transit,
      ).toBe(true)
      expect((await overview(raw)).passport.countryCodes).toEqual(['AE', 'TH']) // only pressed Passport evidence counts

      // Confirm with the default (transit) while the repair is failing: committed but pending.
      const { db, hooks } = instrumentDb(raw)
      hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'))
      const t = await tokens(raw)
      const pending = await postConfirm(db, {
        operationId: operationId(),
        items: [item(1, t[1]), item(3, t[3])],
      })
      expect(pending.body).toMatchObject({ derivedState: 'pending', newlyStampedCountries: null })
      expect((await overview(raw)).derivedReady).toBe(false) // never a mixed figure while pending
      expect((await passport(raw)).derivedState).toBe('error') // the failed repair recorded its error: not ready either way
      expect((await getAwaiting(raw)).body.derivedState).toBe('error')
      expect((await getAwaiting(raw)).body.awaitingFlightCount).toBe(0) // the queue already knows the flights are confirmed

      await publish(raw)
      const after = await passport(raw)
      expect(after.countries.filter((row: any) => row.status === 'pending')).toEqual([])
      expect(after.countries.map((row: any) => row.country_code).sort()).toEqual([
        'AE',
        'GB',
        'GE',
        'TH',
      ])
      expect((await overview(raw)).passport.countryCodes).toEqual(['AE', 'GB', 'GE', 'TH'])
      expect((await getAwaiting(raw)).body).toMatchObject({
        awaitingFlightCount: 0,
        actionableCount: 0,
        derivedState: 'ready',
      })
    } finally {
      await dispose()
    }
  })
})

describe('POST /api/flights/confirm', () => {
  it('confirms one flight with the effective default and returns the receipt result after publication', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const op = operationId()
      const { status, body } = await postConfirm(db, { operationId: op, items: [item(3, t[3])] })
      expect(status).toBe(200)
      expect(body).toMatchObject({
        derivedState: 'ready',
        newlyStampedCountries: ['GB'],
        pendingCountryCount: 1,
      }) // GE still pending (flight 1)
      expect(body.results).toEqual([
        expect.objectContaining({
          flightId: 3,
          lifecycleState: 'logged',
          confirmationSource: 'user',
          arrivalTransit: false,
          arrivalTransitLegId: null,
        }),
      ])
      expect(body.revision).toBe((await stateOf(db, USER.id))!.revision)
      expect(await flightRow(db, 3)).toMatchObject({ s: 'logged', src: 'user', t: 0, leg: null })
      expect((await flightRow(db, 3)).at).toBe(body.results[0].confirmedAt)
      expect(await flightRow(db, 1)).toMatchObject({ s: 'awaiting' }) // untouched
      expect(await receipts(db)).toEqual([
        {
          operation_id: op,
          kind: 'confirm',
          complete: 1,
          expected_count: 1,
          applied_count: 1,
          frozen: 1,
          pressed_before_json: expect.any(String),
        },
      ])
    } finally {
      await dispose()
    }
  })

  it('bulk-confirms with explicit and default decisions: transit stores the matched leg, a submitted false includes the hub', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const { body } = await postConfirm(db, {
        operationId: operationId(),
        items: [item(1, t[1], false), item(3, t[3])],
      })
      expect(
        body.results.map((row: any) => [row.flightId, row.arrivalTransit, row.arrivalTransitLegId]),
      ).toEqual([
        [1, false, null],
        [3, false, null],
      ])
      expect(body.newlyStampedCountries).toEqual(['GB', 'GE', 'TR']) // the member left the airport, so Turkey counts
      expect(body.pendingCountryCount).toBe(0)

      const second = await queueAccount()
      try {
        const t2 = await tokens(second.db)
        const defaulted = await postConfirm(second.db, {
          operationId: operationId(),
          items: [item(1, t2[1])],
        })
        expect(defaulted.body.results[0]).toMatchObject({
          arrivalTransit: true,
          arrivalTransitLegId: 2,
        })
        expect(defaulted.body.newlyStampedCountries).toEqual(['GE']) // Turkey is a transit hub: no stamp
        expect(await flightRow(second.db, 1)).toMatchObject({ s: 'logged', t: 1, leg: 2 })
        const explicit = await queueAccount()
        try {
          const t3 = await tokens(explicit.db)
          const forced = await postConfirm(explicit.db, {
            operationId: operationId(),
            items: [item(1, t3[1], true)],
          })
          expect(forced.body.results[0]).toMatchObject({
            arrivalTransit: true,
            arrivalTransitLegId: 2,
          })
        } finally {
          await explicit.dispose()
        }
      } finally {
        await second.dispose()
      }
    } finally {
      await dispose()
    }
  }, 60_000)

  it('rejects transit for a flight with no unambiguous connection', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const { status, body } = await postConfirm(db, {
        operationId: operationId(),
        items: [item(3, t[3], true)],
      })
      expect(status).toBe(400)
      expect(body).toMatchObject({ code: 'INVALID_ARRIVAL_TRANSIT', items: [{ flightId: 3 }] })
      expect(await flightRow(db, 3)).toMatchObject({ s: 'awaiting' })
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(0)
    } finally {
      await dispose()
    }
  })

  it('replays the exact operation with the recorded result, with no new write, also with refreshed tokens', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const op = operationId()
      const first = await postConfirm(db, {
        operationId: op,
        items: [item(1, t[1]), item(3, t[3], false)],
      })
      const state = await stateOf(db, USER.id)
      const confirmedAt = (await flightRow(db, 1)).at
      const replay = await postConfirm(db, {
        operationId: op,
        items: [item(3, 'a-stale-token-is-ignored-on-replay', false), item(1, t[1])],
      }) // same decisions, other order, stale token
      expect(replay.status).toBe(200)
      expect(replay.body).toEqual(first.body)
      expect(await stateOf(db, USER.id)).toEqual(state) // no dirty mark, no revision change
      expect((await flightRow(db, 1)).at).toBe(confirmedAt)
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(1)
      // The recorded result survives a later deletion of one of the flights.
      await db.prepare('DELETE FROM flights WHERE id = 3').run()
      expect(
        (await postConfirm(db, { operationId: op, items: [item(1, t[1]), item(3, t[3], false)] }))
          .body,
      ).toEqual(first.body)
    } finally {
      await dispose()
    }
  })

  it('conflicts when an operation id is reused with different decisions, and never validates a known operation', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const op = operationId()
      await postConfirm(db, { operationId: op, items: [item(3, t[3])] })
      const reused = await postConfirm(db, { operationId: op, items: [item(3, t[3], true)] })
      expect(reused.status).toBe(409)
      expect(reused.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', cause: 'operation_reused' })
      const other = await postConfirm(db, { operationId: op, items: [item(1, t[1])] })
      expect(other.body.code).toBe('IDEMPOTENCY_CONFLICT')
    } finally {
      await dispose()
    }
  })

  it('is all-or-nothing for a mixed request, with a cause per item', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const { status, body } = await postConfirm(db, {
        operationId: operationId(),
        items: [item(3, t[3]), item(4, 'x'.repeat(64)), item(2, 'y'.repeat(64)), item(1, t[1])],
      })
      expect(status).toBe(409)
      expect(body).toMatchObject({ code: 'STATE_CONFLICT', cause: 'not_awaiting' })
      expect(body.items).toEqual([
        { flightId: 4, cause: 'logged' },
        { flightId: 2, cause: 'upcoming' },
      ])
      expect(await flightRow(db, 3)).toMatchObject({ s: 'awaiting' })
      expect(await flightRow(db, 1)).toMatchObject({ s: 'awaiting' })
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(0)
    } finally {
      await dispose()
    }
  })

  it('treats a foreign flight exactly like a missing one and writes nothing for the valid items', async () => {
    const { db, dispose } = await queueAccount()
    try {
      await addUser(db, 'u2')
      await db.batch([
        flightStatement(db, {
          id: 50,
          user: 'u2',
          date: '2026-10-01',
          origin: 'TBS',
          destination: 'KUT',
          state: 'awaiting',
        }),
      ])
      const t = await tokens(db)
      const foreign = await postConfirm(db, {
        operationId: operationId(),
        items: [item(3, t[3]), item(50, t[3])],
      })
      const missing = await postConfirm(db, {
        operationId: operationId(),
        items: [item(3, t[3]), item(9999, t[3])],
      })
      expect(foreign.status).toBe(404)
      expect(foreign).toEqual(missing)
      expect(foreign.body).toEqual({ error: 'Flight not found', code: 'NOT_FOUND' })
      expect(await flightRow(db, 3)).toMatchObject({ s: 'awaiting' })
      expect(await flightRow(db, 50)).toMatchObject({ s: 'awaiting' })
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(0)
      // A foreign member cannot replay or see this member's operation either.
      const mine = await postConfirm(db, {
        operationId: 'shared-operation-1',
        items: [item(3, t[3])],
      })
      expect(mine.status).toBe(200)
      const theirs = await postConfirm(
        db,
        { operationId: 'shared-operation-1', items: [item(3, t[3])] },
        { id: 'u2', email: 'u2@example.test' },
      )
      expect(theirs.status).toBe(404) // flight 3 is not theirs; the operation id scope is per account
    } finally {
      await dispose()
    }
  })

  it('rejects a stale connection decision with CANDIDATES_CHANGED and a cause', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      // A second outgoing candidate from the hub makes the connection ambiguous: the effective default changes.
      await db.batch([
        flightStatement(db, {
          id: 6,
          date: '2026-10-02',
          origin: 'IST',
          destination: 'LHR',
          state: 'upcoming',
          dep: '2026-03-02T01:00:00.000Z',
          awaitingAfter: '2099-01-01T00:00:00.000Z',
          autoAfter: '2099-02-01T00:00:00.000Z',
        }),
      ])
      await publish(db)
      const { status, body } = await postConfirm(db, {
        operationId: operationId(),
        items: [item(3, t[3]), item(1, t[1])],
      })
      expect(status).toBe(409)
      expect(body).toMatchObject({
        code: 'CANDIDATES_CHANGED',
        cause: 'candidates_changed',
        items: [{ flightId: 1, cause: 'candidates_changed' }],
      })
      expect(await flightRow(db, 1)).toMatchObject({ s: 'awaiting' })
      expect(await flightRow(db, 3)).toMatchObject({ s: 'awaiting' })
      // Other flights' ticks never conflict: a refreshed token works.
      const fresh = await tokens(db)
      expect(
        (
          await postConfirm(db, {
            operationId: operationId(),
            items: [item(1, fresh[1]), item(3, fresh[3])],
          })
        ).status,
      ).toBe(200)
    } finally {
      await dispose()
    }
  })

  it('validates the request shape and requires CSRF and an authenticated owner', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const bad = (body: unknown) =>
        postConfirm(db, body).then((result) => [result.status, result.body.code])
      expect(await bad({ items: [item(3, t[3])] })).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: 'short', items: [item(3, t[3])] })).toEqual([
        400,
        'INVALID_REQUEST',
      ])
      expect(await bad({ operationId: operationId(), items: [] })).toEqual([400, 'INVALID_REQUEST'])
      expect(
        await bad({
          operationId: operationId(),
          items: Array.from({ length: 101 }, (_, i) => item(i + 1, t[3])),
        }),
      ).toEqual([400, 'INVALID_REQUEST'])
      expect(
        await bad({ operationId: operationId(), items: [item(3, t[3]), item(3, t[3])] }),
      ).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: operationId(), items: [{ flightId: 3 }] })).toEqual([
        400,
        'INVALID_REQUEST',
      ])
      expect(
        await bad({ operationId: operationId(), items: [item(3, t[3], 'yes' as never)] }),
      ).toEqual([400, 'INVALID_REQUEST'])
      expect(
        await bad({ operationId: operationId(), items: [{ flightId: -1, candidateToken: t[3] }] }),
      ).toEqual([400, 'INVALID_REQUEST'])
      expect(
        (await postConfirm(db, { operationId: operationId(), items: [item(3, t[3])] }, null))
          .status,
      ).toBe(401)
      const noCsrf = await confirmRoute({
        ...apiContext(
          db,
          new Request('https://kuuki.test/api/flights/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationId: operationId(), items: [item(3, t[3])] }),
          }),
        ),
        data: { user: USER },
        params: {},
      } as never)
      expect(noCsrf.status).toBe(403)
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(0)
    } finally {
      await dispose()
    }
  })
})

describe('A3: concurrency, replay and committed-but-pending', () => {
  it('concurrent identical operations commit once and every caller gets the same result', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const body = { operationId: operationId(), items: [item(1, t[1]), item(3, t[3])] }
      const replies = await Promise.all([1, 2, 3, 4].map(() => postConfirm(db, body)))
      expect(replies.map((reply) => reply.status)).toEqual([200, 200, 200, 200])
      for (const reply of replies) expect(reply.body).toEqual(replies[0].body)
      expect(replies[0].body).toMatchObject({
        derivedState: 'ready',
        newlyStampedCountries: ['GB', 'GE'],
      })
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(1)
      expect(await receipts(db)).toMatchObject([{ complete: 1, applied_count: 2, frozen: 1 }])
    } finally {
      await dispose()
    }
  }, 30_000)

  it("a same-operation request that loses the receipt insert commits nothing and returns the winner's result", async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const t = await tokens(raw)
      const body = { operationId: operationId(), items: [item(1, t[1]), item(3, t[3])] }
      const { db: loser, hooks } = instrumentDb(raw)
      let winner: any
      hooks.beforeBatch(hasSql('INSERT INTO lifecycle_operation_receipts'), async () => {
        winner = await postConfirm(raw, body)
      })
      const result = await postConfirm(loser, body)
      expect(result.status).toBe(200)
      expect(result.body).toEqual(winner.body)
      expect(await count(raw, 'lifecycle_operation_receipts')).toBe(1)
      expect(await receipts(raw)).toMatchObject([{ complete: 1, applied_count: 2 }])
    } finally {
      await dispose()
    }
  })

  it('a different operation racing for the same flight rolls back whole and reports the cause; the winner is intact', async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const t = await tokens(raw)
      const winnerBody = { operationId: operationId('winner'), items: [item(3, t[3])] }
      const loserBody = { operationId: operationId('loser'), items: [item(3, t[3]), item(1, t[1])] }
      const { db: loser, hooks } = instrumentDb(raw)
      let winner: any
      hooks.beforeBatch(hasSql('INSERT INTO lifecycle_operation_receipts'), async () => {
        winner = await postConfirm(raw, winnerBody)
      })
      const result = await postConfirm(loser, loserBody)
      expect(winner.status).toBe(200)
      expect(result.status).toBe(409)
      expect(result.body).toMatchObject({
        code: 'STATE_CONFLICT',
        cause: 'not_awaiting',
        items: [{ flightId: 3, cause: 'logged' }],
      })
      expect(await flightRow(raw, 1)).toMatchObject({ s: 'awaiting' }) // all or nothing: the loser's other item did not apply
      expect((await receipts(raw)).map((row) => row.operation_id)).toEqual([winnerBody.operationId]) // no partial loser receipt
      // The rolled-back operation id is not burned: the member can re-send it with only what is still valid.
      const retry = await postConfirm(raw, {
        operationId: loserBody.operationId,
        items: [item(1, (await tokens(raw))[1])],
      })
      expect(retry.status).toBe(200)
    } finally {
      await dispose()
    }
  })

  it('an unrelated concurrent mutation only costs a retry: the confirmation still commits', async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const t = await tokens(raw)
      const { db, hooks } = instrumentDb(raw)
      hooks.beforeBatch(hasSql('INSERT INTO lifecycle_operation_receipts'), async () => {
        await raw.batch([
          raw
            .prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'JP')")
            .bind(USER.id),
          raw
            .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
            .bind(USER.id),
        ])
      })
      const result = await postConfirm(db, { operationId: operationId(), items: [item(3, t[3])] })
      expect(result.status).toBe(200)
      expect(result.body.derivedState).toBe('ready')
      expect(await flightRow(raw, 3)).toMatchObject({ s: 'logged', src: 'user' })
      expect(await count(raw, 'lifecycle_operation_receipts')).toBe(1)
      // The first batch rolled back on the revision guard; the second decided again on the new revision.
      expect(
        hooks.sql.filter((sql) => sql.includes('INSERT INTO lifecycle_operation_receipts')),
      ).toHaveLength(2)
    } finally {
      await dispose()
    }
  })

  it('exact replay after the rolled-back path returns the same conflict and writes nothing', async () => {
    const { db, dispose } = await queueAccount()
    try {
      const t = await tokens(db)
      const body = { operationId: operationId(), items: [item(3, t[3]), item(4, 'z'.repeat(64))] }
      const first = await postConfirm(db, body)
      const second = await postConfirm(db, body)
      expect(first.status).toBe(409)
      expect(second).toEqual(first)
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(0)
      expect(await flightRow(db, 3)).toMatchObject({ s: 'awaiting' })
    } finally {
      await dispose()
    }
  })

  it('post-commit repair failure returns committed-but-pending; a replay finishes it once and never re-applies', async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const t = await tokens(raw)
      const body = { operationId: operationId(), items: [item(1, t[1], false), item(3, t[3])] }
      const { db, hooks } = instrumentDb(raw)
      hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'), 2)
      const pending = await postConfirm(db, body)
      expect(pending.status).toBe(200)
      expect(pending.body).toMatchObject({
        derivedState: 'pending',
        newlyStampedCountries: null,
        pendingCountryCount: null,
      })
      expect(pending.body.results).toHaveLength(2)
      expect(pending.body.revision).toBe((await stateOf(raw, USER.id))!.revision)
      expect(await receipts(raw)).toMatchObject([{ complete: 1, applied_count: 2, frozen: 0 }])
      const confirmedAt = (await flightRow(raw, 1)).at
      const revision = (await stateOf(raw, USER.id))!.revision

      // Still failing: the replay reports pending again, with no second mutation and no second dirty mark.
      const again = await postConfirm(db, body)
      expect(again.body).toMatchObject({ derivedState: 'pending', newlyStampedCountries: null })
      expect((await stateOf(raw, USER.id))!.revision).toBe(revision)
      expect((await flightRow(raw, 1)).at).toBe(confirmedAt)

      // Healthy again: the replay repairs, freezes and returns the real outcome.
      const done = await postConfirm(raw, body)
      expect(done.body).toMatchObject({
        derivedState: 'ready',
        newlyStampedCountries: ['GB', 'GE', 'TR'],
        pendingCountryCount: 0,
      })
      expect((await flightRow(raw, 1)).at).toBe(confirmedAt)
      expect(await receipts(raw)).toMatchObject([{ frozen: 1 }])
      expect((await postConfirm(raw, body)).body).toEqual(done.body)
    } finally {
      await dispose()
    }
  })
})

describe('A8: newlyStampedCountries', () => {
  it('does not attribute a concurrent claim to the operation', async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const t = await tokens(raw)
      const { db, hooks } = instrumentDb(raw)
      // A claim lands after the confirmation committed and before its repair published.
      hooks.afterBatch(hasSql('INSERT INTO lifecycle_operation_receipts'), async () => {
        await raw.batch([
          raw
            .prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'JP')")
            .bind(USER.id),
          raw
            .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
            .bind(USER.id),
        ])
      })
      const result = await postConfirm(db, {
        operationId: operationId(),
        items: [item(1, t[1]), item(3, t[3])],
      })
      expect(result.body.derivedState).toBe('ready')
      expect(result.body.newlyStampedCountries).toEqual(['GB', 'GE']) // not JP
      const pressed = await raw
        .prepare(
          "SELECT country_code FROM country_visit_evidence WHERE user_id = ? AND status = 'pressed' ORDER BY country_code",
        )
        .bind(USER.id)
        .all()
      expect(pressed.results.map((row: any) => row.country_code)).toContain('JP') // it is pressed, just not by this operation
    } finally {
      await dispose()
    }
  })

  it('repairs a stale published projection before taking the snapshot, so nothing already pressed is mis-attributed', async () => {
    const { db, dispose } = await queueAccount()
    try {
      // The published projection wrongly says GE is already pressed and the evidence stamp is stale (an old writer's repair).
      await db.batch([
        db
          .prepare(
            "UPDATE country_visit_evidence SET status = 'pressed', logged_visit_count = 1, awaiting_visit_count = 0 WHERE user_id = ? AND country_code = 'GE'",
          )
          .bind(USER.id),
        db
          .prepare('UPDATE user_derived_state SET evidence_revision = 0 WHERE user_id = ?')
          .bind(USER.id),
      ])
      const t = await tokens(db)
      const result = await postConfirm(db, { operationId: operationId(), items: [item(1, t[1])] })
      expect(result.body).toMatchObject({ derivedState: 'ready', newlyStampedCountries: ['GE'] })
    } finally {
      await dispose()
    }
  })

  it('is null when the snapshot could not be taken (publication was not ready and the repair failed)', async () => {
    const { db: raw, dispose } = await queueAccount()
    try {
      const t = await tokens(raw)
      await raw
        .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
        .bind(USER.id)
        .run() // dirty
      const { db, hooks } = instrumentDb(raw)
      hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'), 1) // the snapshot repair fails once
      const result = await postConfirm(db, { operationId: operationId(), items: [item(3, t[3])] })
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ derivedState: 'ready', newlyStampedCountries: null }) // published now, but there was no trustworthy "before"
      expect(await receipts(raw)).toMatchObject([{ pressed_before_json: null, frozen: 1 }])
    } finally {
      await dispose()
    }
  })
})
