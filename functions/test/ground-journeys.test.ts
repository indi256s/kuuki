import { describe, expect, it } from 'vitest'
import type { RequestData } from '../api/_lib/auth'
import { createApiDatabase, apiContext, csrfRequest, count } from './harness'
import {
  onRequestGet as listJourneys,
  onRequestPost as createJourney,
} from '../api/ground-journeys/index'
import {
  onRequestGet as getJourney,
  onRequestPatch as patchJourney,
  onRequestDelete as deleteJourney,
} from '../api/ground-journeys/[id]'
import { onRequestGet as operationStatus } from '../api/ground-journeys/operations/[key]'

const owner = { id: 'gt-owner', email: 'gt-owner@example.test' }
const other = { id: 'gt-other', email: 'gt-other@example.test' }
type TestUser = typeof owner

const paris: Record<string, unknown> = {
  source: 'geonames',
  id: '2988507',
  name: 'Paris',
  nameRu: null,
  nameEn: 'Paris',
  countryCode: 'FR',
  region: null,
  lat: 48.8566,
  lon: 2.3522,
  timezone: 'Europe/Paris',
  catalogVersion: 'v1',
}
const lyon: Record<string, unknown> = {
  ...paris,
  id: '2996944',
  name: 'Lyon',
  nameEn: 'Lyon',
  lat: 45.764,
  lon: 4.8357,
}
const nice: Record<string, unknown> = {
  ...paris,
  id: '2990440',
  name: 'Nice',
  nameEn: 'Nice',
  lat: 43.7102,
  lon: 7.262,
}

let counter = 0
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`
const key = () => `operation-key-${++counter}`

const leg = (from = paris, to = lyon, extra: Record<string, unknown> = {}) => ({
  id: uuid(),
  from,
  to,
  fromStation: null,
  toStation: null,
  trainNumber: null,
  operator: null,
  departureDate: null,
  departureTime: null,
  arrivalDate: null,
  arrivalTime: null,
  durationMinutes: null,
  ...extra,
})
const point = (place = paris) => ({
  id: uuid(),
  place,
  arrivalDate: null,
  departureDate: null,
  nights: null,
  note: null,
})
const rail = (extra: Record<string, unknown> = {}, legs = [leg()]) => ({
  mode: 'rail',
  title: 'Paris to Lyon',
  note: null,
  startDate: null,
  endDate: null,
  legs,
  ...extra,
})
const road = (points = [point(paris), point(lyon)], extra: Record<string, unknown> = {}) => ({
  mode: 'road',
  title: null,
  note: null,
  startDate: null,
  endDate: null,
  points,
  ...extra,
})

async function setup() {
  const { db, dispose } = await createApiDatabase()
  await db.batch(
    [owner, other].flatMap((user) => [
      db
        .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
        .bind(user.id, user.email, 'hash'),
      db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user.id),
    ]),
  )
  const call = async (
    handler: PagesFunction<Env, string, RequestData>,
    user: TestUser,
    path: string,
    method: string,
    body?: unknown,
    params: Record<string, string> = {},
  ) => {
    const response = await handler({
      ...apiContext(db, csrfRequest(path, method, body)),
      data: { user },
      params,
    } as never)
    return { status: response.status, body: (await response.json()) as any }
  }
  const create = (input: Record<string, unknown>, user = owner) =>
    call(createJourney, user, '/api/ground-journeys', 'POST', input)
  const patch = (id: string, input: Record<string, unknown>, user = owner) =>
    call(patchJourney, user, `/api/ground-journeys/${id}`, 'PATCH', input, { id })
  const remove = (id: string, input: Record<string, unknown>, user = owner) =>
    call(deleteJourney, user, `/api/ground-journeys/${id}`, 'DELETE', input, { id })
  const get = (id: string, user = owner) =>
    call(getJourney, user, `/api/ground-journeys/${id}`, 'GET', undefined, { id })
  const list = (query = '', user = owner) =>
    call(listJourneys, user, `/api/ground-journeys${query}`, 'GET')
  const operation = (operationKey: string, user = owner) =>
    call(
      operationStatus,
      user,
      `/api/ground-journeys/operations/${operationKey}`,
      'GET',
      undefined,
      {
        key: operationKey,
      },
    )
  const revision = async () =>
    (
      await db
        .prepare('SELECT revision FROM user_derived_state WHERE user_id = ?')
        .bind(owner.id)
        .first<{ revision: number }>()
    )?.revision ?? 0
  const createPlanned = async (journey: Record<string, unknown> = rail()) => {
    const journeyId = uuid()
    const response = await create({ operationKey: key(), journeyId, status: 'planned', journey })
    expect(response.status).toBe(201)
    return journeyId
  }
  return { db, dispose, create, patch, remove, get, list, operation, revision, createPlanned }
}

describe('ground journeys API', () => {
  it('keeps journeys and manual places private to their owner', async () => {
    const t = await setup()
    try {
      const id = await t.createPlanned()
      const manualId = uuid()
      await t.db
        .prepare(
          "INSERT INTO ground_manual_places (id,user_id,name,name_key,country_code,created_at) VALUES (?,?,'Hut','hut','FR','2026-01-01')",
        )
        .bind(manualId, other.id)
        .run()
      expect((await t.get(id, other)).status).toBe(404)
      expect(
        (await t.patch(id, { action: 'cancel', operationKey: key(), expectedVersion: 1 }, other))
          .status,
      ).toBe(404)
      expect((await t.remove(id, { operationKey: key(), expectedVersion: 1 }, other)).status).toBe(
        404,
      )
      expect((await t.list('', other)).body.journeys).toEqual([])
      expect((await t.list()).body.journeys).toHaveLength(1)
      // A foreign manual place is indistinguishable from a missing one.
      const foreign = { ...paris, source: 'manual', id: manualId, catalogVersion: null }
      const refused = await t.create({
        operationKey: key(),
        journeyId: uuid(),
        status: 'planned',
        journey: rail({}, [leg(foreign, lyon)]),
      })
      expect(refused.status).toBe(400)
      expect(await count(t.db, 'ground_journeys')).toBe(1)
    } finally {
      await t.dispose()
    }
  })

  it('creates planned rail and road journeys with metrics and ordered children', async () => {
    const t = await setup()
    try {
      const railId = await t.createPlanned(
        rail({ startDate: '2099-01-01' }, [
          leg(paris, lyon, {
            departureDate: '2099-01-01',
            departureTime: '08:00',
            arrivalDate: '2099-01-01',
            arrivalTime: '10:00',
          }),
          leg(lyon, nice),
        ]),
      )
      const roadId = await t.createPlanned(road([point(paris), point(lyon), point(paris)]))
      const railDto = (await t.get(railId)).body
      expect(railDto.legs.map((l: any) => l.to.name)).toEqual(['Lyon', 'Nice'])
      expect(railDto.legs[0]).toMatchObject({ durationMinutes: 120, durationSource: 'schedule' })
      expect(railDto.metrics.distanceKm).toBeGreaterThan(600)
      expect(railDto.metrics.trainMinutesCoverage).toEqual({ known: 1, total: 2 })
      expect((await t.get(roadId)).body.metrics.uniqueCities).toBe(2)
      expect((await t.list('?today=2026-10-13')).body.journeys.map((j: any) => j.id)).toEqual([
        railId,
        roadId,
      ])
    } finally {
      await t.dispose()
    }
  })

  it('requires an explicit country list exactly when the result is completed', async () => {
    const t = await setup()
    try {
      const base = { operationKey: key(), journeyId: uuid(), journey: rail() }
      expect((await t.create({ ...base, status: 'completed' })).status).toBe(400)
      expect((await t.create({ ...base, status: 'planned', countries: ['FR'] })).status).toBe(400)
      expect((await t.create({ ...base, status: 'completed', countries: ['fr'] })).status).toBe(400)
      expect(await count(t.db, 'ground_journeys')).toBe(0)
      const empty = await t.create({ ...base, status: 'completed', countries: [] })
      expect(empty.status).toBe(201)
      expect(empty.body.current).toMatchObject({ status: 'completed', countries: [] })
      expect(empty.body.current.confirmedAt).toBeTruthy()
    } finally {
      await t.dispose()
    }
  })

  it('completes with countries and reopens clearing countries and confirmation', async () => {
    const t = await setup()
    try {
      const id = await t.createPlanned()
      const noCountries = await t.patch(id, {
        action: 'complete',
        operationKey: key(),
        expectedVersion: 1,
        journey: rail(),
      })
      expect(noCountries.status).toBe(400)
      const done = await t.patch(id, {
        action: 'complete',
        operationKey: key(),
        expectedVersion: 1,
        journey: rail(),
        countries: ['FR', 'CH'],
      })
      expect(done.body).toMatchObject({
        savedVersion: 2,
        current: { status: 'completed', countries: ['CH', 'FR'] },
      })
      expect((await t.list()).body.totals.rail.journeys).toBe(1)
      const reopened = await t.patch(id, {
        action: 'reopen',
        operationKey: key(),
        expectedVersion: 2,
      })
      expect(reopened.body.current).toMatchObject({
        status: 'planned',
        countries: [],
        confirmedAt: null,
        version: 3,
      })
      expect(await count(t.db, 'ground_journey_countries')).toBe(0)
      expect((await t.list()).body.totals.rail.journeys).toBe(0)
    } finally {
      await t.dispose()
    }
  })

  it('cancels and restores a plan keeping route and dates, and lists cancelled only on request', async () => {
    const t = await setup()
    try {
      const id = await t.createPlanned(
        rail({ startDate: '2099-02-01', endDate: '2099-02-03' }, [leg(), leg(lyon, nice)]),
      )
      const cancelled = await t.patch(id, {
        action: 'cancel',
        operationKey: key(),
        expectedVersion: 1,
      })
      expect(cancelled.body.current.status).toBe('cancelled')
      expect((await t.list()).body.journeys).toEqual([])
      expect((await t.list('?status=cancelled')).body.journeys).toHaveLength(1)
      // An illegal transition keeps its own error even with a fresh version.
      expect(
        (await t.patch(id, { action: 'cancel', operationKey: key(), expectedVersion: 2 })).body
          .code,
      ).toBe('STATE_CONFLICT')
      const restored = await t.patch(id, {
        action: 'restore',
        operationKey: key(),
        expectedVersion: 2,
      })
      expect(restored.body.current).toMatchObject({
        status: 'planned',
        startDate: '2099-02-01',
        endDate: '2099-02-03',
      })
      expect(restored.body.current.legs).toHaveLength(2)
    } finally {
      await t.dispose()
    }
  })

  it('accepts an undated completed journey', async () => {
    const t = await setup()
    try {
      const response = await t.create({
        operationKey: key(),
        journeyId: uuid(),
        status: 'completed',
        countries: ['FR'],
        journey: road(),
      })
      expect(response.status).toBe(201)
      expect(response.body.current).toMatchObject({ startDate: null, status: 'completed' })
    } finally {
      await t.dispose()
    }
  })

  it('answers a stale version with the current journey and leaves data unchanged', async () => {
    const t = await setup()
    try {
      const id = await t.createPlanned()
      await t.patch(id, {
        action: 'update',
        operationKey: key(),
        expectedVersion: 1,
        journey: rail({ title: 'Winner' }),
      })
      const before = await t.revision()
      const stale = await t.patch(id, {
        action: 'update',
        operationKey: key(),
        expectedVersion: 1,
        journey: rail({ title: 'Loser' }),
      })
      expect(stale.status).toBe(409)
      expect(stale.body).toMatchObject({
        code: 'VERSION_CONFLICT',
        current: { title: 'Winner', version: 2 },
      })
      expect((await t.get(id)).body.title).toBe('Winner')
      expect(await t.revision()).toBe(before)
    } finally {
      await t.dispose()
    }
  })

  it('commits nothing when the parent CAS loses on a journey without children to write', async () => {
    const t = await setup()
    try {
      const id = await t.createPlanned()
      // Another writer bumps the version after our classification would have passed.
      await t.db.prepare('UPDATE ground_journeys SET version = 2 WHERE id = ?').bind(id).run()
      const receipts = await count(t.db, 'ground_operation_receipts')
      const before = await t.revision()
      const lost = await t.patch(id, { action: 'cancel', operationKey: key(), expectedVersion: 1 })
      expect(lost.status).toBe(409)
      expect(await count(t.db, 'ground_operation_receipts')).toBe(receipts)
      expect(await t.revision()).toBe(before)
      expect((await t.get(id)).body.status).toBe('planned')
    } finally {
      await t.dispose()
    }
  })

  it('replays the same key and payload without a second write and refuses a different payload', async () => {
    const t = await setup()
    try {
      const id = await t.createPlanned()
      const command = {
        action: 'update',
        operationKey: key(),
        expectedVersion: 1,
        journey: rail({ title: 'Once' }),
      }
      const first = await t.patch(id, command)
      const revision = await t.revision()
      const again = await t.patch(id, command)
      expect(again.status).toBe(200)
      expect(again.body).toMatchObject({
        replayed: true,
        savedVersion: 2,
        accountRevision: first.body.accountRevision,
      })
      expect((await t.get(id)).body.version).toBe(2)
      expect(await t.revision()).toBe(revision)
      const different = await t.patch(id, { ...command, journey: rail({ title: 'Twice' }) })
      expect(different.status).toBe(409)
      expect(different.body.code).toBe('IDEMPOTENCY_CONFLICT')
      expect((await t.get(id)).body.title).toBe('Once')
    } finally {
      await t.dispose()
    }
  })

  it('reports a saved operation after a lost response', async () => {
    const t = await setup()
    try {
      const operationKey = key()
      const journeyId = uuid()
      expect((await t.operation(operationKey)).body).toEqual({ status: 'unknown', operationKey })
      await t.create({ operationKey, journeyId, status: 'planned', journey: rail() })
      const status = await t.operation(operationKey)
      expect(status.body).toMatchObject({
        status: 'saved',
        journeyId,
        action: 'create',
        savedVersion: 1,
      })
      expect((await t.operation(operationKey, other)).body.status).toBe('unknown')
    } finally {
      await t.dispose()
    }
  })

  it('deletes to a bare tombstone, replays the delete, refuses old saves and never reuses the id', async () => {
    const t = await setup()
    try {
      const operationKey = key()
      const id = uuid()
      const saveCommand = {
        operationKey,
        journeyId: id,
        status: 'completed',
        countries: ['FR'],
        journey: rail(),
      }
      await t.create(saveCommand)
      const deleteKey = key()
      const deleted = await t.remove(id, { operationKey: deleteKey, expectedVersion: 1 })
      expect(deleted.body).toMatchObject({ outcome: 'deleted', current: null, savedVersion: 2 })
      const tomb = await t.db
        .prepare('SELECT * FROM ground_journeys WHERE id = ?')
        .bind(id)
        .first<Record<string, unknown>>()
      expect(tomb).toMatchObject({
        id,
        user_id: owner.id,
        mode: 'rail',
        version: 2,
        status: null,
        title: null,
        note: null,
        start_date: null,
        end_date: null,
        created_at: null,
        updated_at: null,
        confirmed_at: null,
      })
      expect(tomb!.deleted_at).toBeTruthy()
      for (const table of ['ground_rail_legs', 'ground_road_points', 'ground_journey_countries'])
        expect(await count(t.db, table)).toBe(0)
      expect((await t.get(id)).status).toBe(404)
      expect((await t.list()).body.journeys).toEqual([])

      expect(
        (await t.remove(id, { operationKey: deleteKey, expectedVersion: 1 })).body,
      ).toMatchObject({ outcome: 'deleted', replayed: true })
      const old = await t.create(saveCommand)
      expect(old.status).toBe(410)
      const reuse = await t.create({
        operationKey: key(),
        journeyId: id,
        status: 'planned',
        journey: rail(),
      })
      expect(reuse.status).toBe(410)
      expect(
        (await t.patch(id, { action: 'cancel', operationKey: key(), expectedVersion: 2 })).status,
      ).toBe(410)
      expect((await t.operation(operationKey)).body.status).toBe('saved')
      // Another owner's id is refused too, without saying whose it is.
      const taken = await t.create(
        { operationKey: key(), journeyId: id, status: 'planned', journey: rail() },
        other,
      )
      expect(taken.status).toBe(409)
    } finally {
      await t.dispose()
    }
  })

  it('returns saved with a pending publication when the repair fails', async () => {
    const t = await setup()
    try {
      await t.db
        .prepare(
          "CREATE TRIGGER fail_publish BEFORE UPDATE OF published_revision ON user_derived_state BEGIN SELECT RAISE(ABORT, 'synthetic publish failure'); END",
        )
        .run()
      const saved = await t.create({
        operationKey: key(),
        journeyId: uuid(),
        status: 'planned',
        journey: rail(),
      })
      expect(saved.status).toBe(201)
      expect(saved.body).toMatchObject({ outcome: 'saved', derivedState: 'pending' })
      expect(await count(t.db, 'ground_journeys')).toBe(1)
      expect((await t.list()).body.derivedState).toBe('pending')
    } finally {
      await t.dispose()
    }
  })

  it('saves 100 legs in one batch and rejects 101', async () => {
    const t = await setup()
    try {
      const legs = (n: number) => Array.from({ length: n }, () => leg())
      const full = await t.create({
        operationKey: key(),
        journeyId: uuid(),
        status: 'planned',
        journey: rail({}, legs(100)),
      })
      expect(full.status).toBe(201)
      expect(full.body.current.legs).toHaveLength(100)
      expect(await count(t.db, 'ground_rail_legs')).toBe(100)
      const over = await t.create({
        operationKey: key(),
        journeyId: uuid(),
        status: 'planned',
        journey: rail({}, legs(101)),
      })
      expect(over.status).toBe(400)
      expect(await count(t.db, 'ground_rail_legs')).toBe(100)
    } finally {
      await t.dispose()
    }
  })
})
