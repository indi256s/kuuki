import { expect, it } from 'vitest'
import { createApiDatabase, apiContext, csrfRequest, count } from './harness'
import { onRequestDelete as unclaimCountry } from '../api/passport/claims/[cc]/index'
import {
  onRequestPost as addGroundVisit,
  onRequestGet as listGroundVisits,
} from '../api/passport/ground-visits/index'
import { onRequestPatch as editGroundVisit } from '../api/passport/ground-visits/[id]'
import { repairUserDerivedState } from '../api/_services/derivedState'

const user = { id: 'passport-user', email: 'passport@example.test' }

function context(db: D1Database, path: string, method: string, body?: unknown, cc?: string) {
  const request = csrfRequest(path, method, body)
  return { ...apiContext(db, request), data: { user }, params: cc ? { cc } : {} } as never
}

function editContext(db: D1Database, id: string, body: unknown) {
  const request = csrfRequest(`/api/passport/ground-visits/${id}`, 'PATCH', body)
  return { ...apiContext(db, request), data: { user }, params: { id } } as never
}

async function derivedState(db: D1Database) {
  return db
    .prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
    .bind(user.id)
    .first<{ revision: number; published_revision: number }>()
}

async function seed(db: D1Database) {
  await db.batch([
    db
      .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
      .bind(user.id, user.email, 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user.id),
  ])
}

it('exports complete ground evidence only for the authenticated owner', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db
      .prepare(
        "INSERT INTO users(id,email,password_hash) VALUES('other','other@example.test','hash')",
      )
      .run()
    await db.batch([
      db
        .prepare(
          'INSERT INTO ground_visits(id,user_id,country_code,visit_year,entry_method,note) VALUES(?,?,?,?,?,?)',
        )
        .bind('own-visit', user.id, 'GE', 2024, 'land', 'Train through Tbilisi'),
      db
        .prepare('INSERT INTO ground_visits(id,user_id,country_code,note) VALUES(?,?,?,?)')
        .bind('other-visit', 'other', 'US', 'Private other note'),
    ])
    const response = await listGroundVisits(context(db, '/api/passport/ground-visits', 'GET'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      expect.objectContaining({
        id: 'own-visit',
        countryCode: 'GE',
        visitYear: 2024,
        entryMethod: 'land',
        note: 'Train through Tbilisi',
      }),
    ])
    const anonymous = await listGroundVisits(
      apiContext(db, new Request('https://kuuki.test/api/passport/ground-visits')) as never,
    )
    expect(anonymous.status).toBe(401)
  } finally {
    await dispose()
  }
})

it('unclaims and drops ground notes in one transaction, preserving both on a fault', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db
        .prepare('INSERT INTO country_claims (id,user_id,country_code) VALUES (?,?,?)')
        .bind('claim-1', user.id, 'GE'),
      db
        .prepare('INSERT INTO ground_visits (id,user_id,country_code,note) VALUES (?,?,?,?)')
        .bind('visit-1', user.id, 'GE', 'ground note'),
    ])
    await db
      .prepare(
        "CREATE TRIGGER fail_unclaim BEFORE DELETE ON country_claims BEGIN SELECT RAISE(ABORT, 'synthetic unclaim failure'); END",
      )
      .run()
    const failed = await unclaimCountry(
      context(db, '/api/passport/claims/GE', 'DELETE', undefined, 'GE'),
    )
    expect(failed.status).toBe(500)
    expect(await count(db, 'country_claims')).toBe(1)
    expect(await count(db, 'ground_visits')).toBe(1)
    await db.prepare('DROP TRIGGER fail_unclaim').run()
    const deleted = await unclaimCountry(
      context(db, '/api/passport/claims/GE', 'DELETE', undefined, 'GE'),
    )
    expect(deleted.status).toBe(200)
    expect(await count(db, 'country_claims')).toBe(0)
    expect(await count(db, 'ground_visits')).toBe(0)
    const state = await derivedState(db)
    expect(state?.published_revision).toBe(state?.revision)
  } finally {
    await dispose()
  }
})

it('does not leave a ground note committed when dirty-state marking fails', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db
      .prepare(
        "CREATE TRIGGER fail_dirty BEFORE INSERT ON user_derived_state BEGIN SELECT RAISE(ABORT, 'synthetic dirty failure'); END",
      )
      .run()
    const failed = await addGroundVisit(
      context(db, '/api/passport/ground-visits', 'POST', {
        countryCode: 'GE',
        note: 'ground note',
      }),
    )
    expect(failed.status).toBe(500)
    expect(await count(db, 'ground_visits')).toBe(0)
  } finally {
    await dispose()
  }
})

it('rejects malformed ground country codes before storing evidence', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    for (const countryCode of [12, 'GEO', 'ge', '']) {
      expect(
        (await addGroundVisit(context(db, '/api/passport/ground-visits', 'POST', { countryCode })))
          .status,
      ).toBe(400)
    }
    expect(await count(db, 'ground_visits')).toBe(0)
  } finally {
    await dispose()
  }
})

it('keeps derived state published when unclaiming, including a no-op and ground-only unclaim', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await repairUserDerivedState(db, user.id)
    const before = await derivedState(db)

    const noop = await unclaimCountry(
      context(db, '/api/passport/claims/FR', 'DELETE', undefined, 'FR'),
    )
    expect(noop.status).toBe(200)
    expect(await derivedState(db)).toEqual(before)

    // Ground visits need no claim; dropping only them must still repair.
    await db
      .prepare('INSERT INTO ground_visits (id,user_id,country_code) VALUES (?,?,?)')
      .bind('visit-2', user.id, 'FR')
      .run()
    const groundOnly = await unclaimCountry(
      context(db, '/api/passport/claims/FR', 'DELETE', undefined, 'FR'),
    )
    expect(await groundOnly.json()).toMatchObject({ ok: true, derived_state: 'ready' })
    expect(await count(db, 'ground_visits')).toBe(0)
    const after = await derivedState(db)
    expect(after!.revision).toBeGreaterThan(before!.revision)
    expect(after!.published_revision).toBe(after!.revision)
  } finally {
    await dispose()
  }
})

it('records a land visit with its way and refuses a way without a land entry', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const post = (body: unknown) =>
      addGroundVisit(context(db, '/api/passport/ground-visits', 'POST', body))

    const rail = await post({ countryCode: 'AT', entryMethod: 'land', mode: 'rail' })
    expect(rail.status).toBe(201)
    expect(await rail.json()).toMatchObject({
      countryCode: 'AT',
      entryMethod: 'land',
      mode: 'rail',
    })

    for (const body of [
      { countryCode: 'AT', mode: 'rail' },
      { countryCode: 'AT', entryMethod: 'sea', mode: 'road' },
      { countryCode: 'AT', entryMethod: 'land', mode: 'plane' },
    ])
      expect((await post(body)).status).toBe(400)

    const rows = await db
      .prepare('SELECT entry_method, mode, visit_year FROM ground_visits WHERE user_id = ?')
      .bind(user.id)
      .all()
    expect(rows.results).toEqual([{ entry_method: 'land', mode: 'rail', visit_year: null }])
  } finally {
    await dispose()
  }
})

it("edits only the owner's visit, keeping omitted fields and checking the merged way", async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db
        .prepare(
          "INSERT INTO users(id,email,password_hash) VALUES('other','o@example.test','hash')",
        )
        .bind(),
      db
        .prepare(
          "INSERT INTO ground_visits(id,user_id,country_code,note,entry_method,mode) VALUES('own','passport-user','IT','Night train','land','rail')",
        )
        .bind(),
      db
        .prepare("INSERT INTO ground_visits(id,user_id,country_code) VALUES('theirs','other','IT')")
        .bind(),
    ])

    const foreign = await editGroundVisit(editContext(db, 'theirs', { visitYear: 2020 }))
    expect(foreign.status).toBe(404)
    expect(
      await db.prepare("SELECT visit_year FROM ground_visits WHERE id = 'theirs'").first(),
    ).toEqual({ visit_year: null })

    // Changing only the entry to sea would leave a rail way on a sea visit.
    expect((await editGroundVisit(editContext(db, 'own', { entryMethod: 'sea' }))).status).toBe(400)

    const edited = await editGroundVisit(editContext(db, 'own', { visitYear: 2019, mode: 'road' }))
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({
      id: 'own',
      visitYear: 2019,
      entryMethod: 'land',
      mode: 'road',
      note: 'Night train',
    })
    const state = await derivedState(db)
    expect(state?.published_revision).toBe(state?.revision)
  } finally {
    await dispose()
  }
})
