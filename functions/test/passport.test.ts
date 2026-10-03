import { expect, it } from 'vitest'
import { createApiDatabase, apiContext, csrfRequest, count } from './harness'
import { onRequestDelete as unclaimCountry } from '../api/passport/claims/[cc]/index'
import { onRequestPost as addGroundVisit } from '../api/passport/ground-visits/index'
import { repairUserDerivedState } from '../api/_services/derivedState'

const user = { id: 'passport-user', email: 'passport@example.test' }

function context(db: D1Database, path: string, method: string, body?: unknown, cc?: string) {
  const request = csrfRequest(path, method, body)
  return { ...apiContext(db, request), data: { user }, params: cc ? { cc } : {} } as never
}

async function derivedState(db: D1Database) {
  return db.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
    .bind(user.id).first<{ revision: number; published_revision: number }>()
}

async function seed(db: D1Database) {
  await db.batch([
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user.id),
  ])
}

it('unclaims and drops ground notes in one transaction, preserving both on a fault', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db.prepare('INSERT INTO country_claims (id,user_id,country_code) VALUES (?,?,?)').bind('claim-1', user.id, 'GE'),
      db.prepare('INSERT INTO ground_visits (id,user_id,country_code,note) VALUES (?,?,?,?)').bind('visit-1', user.id, 'GE', 'ground note'),
    ])
    await db.prepare("CREATE TRIGGER fail_unclaim BEFORE DELETE ON country_claims BEGIN SELECT RAISE(ABORT, 'synthetic unclaim failure'); END").run()
    const failed = await unclaimCountry(context(db, '/api/passport/claims/GE', 'DELETE', undefined, 'GE'))
    expect(failed.status).toBe(500)
    expect(await count(db, 'country_claims')).toBe(1)
    expect(await count(db, 'ground_visits')).toBe(1)
    await db.prepare('DROP TRIGGER fail_unclaim').run()
    const deleted = await unclaimCountry(context(db, '/api/passport/claims/GE', 'DELETE', undefined, 'GE'))
    expect(deleted.status).toBe(200)
    expect(await count(db, 'country_claims')).toBe(0)
    expect(await count(db, 'ground_visits')).toBe(0)
    const state = await derivedState(db)
    expect(state?.published_revision).toBe(state?.revision)
  } finally { await dispose() }
})

it('does not leave a ground note committed when dirty-state marking fails', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.prepare("CREATE TRIGGER fail_dirty BEFORE INSERT ON user_derived_state BEGIN SELECT RAISE(ABORT, 'synthetic dirty failure'); END").run()
    const failed = await addGroundVisit(context(db, '/api/passport/ground-visits', 'POST', { countryCode: 'GE', note: 'ground note' }))
    expect(failed.status).toBe(500)
    expect(await count(db, 'ground_visits')).toBe(0)
  } finally { await dispose() }
})

it('rejects malformed ground country codes before storing evidence', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    for (const countryCode of [12, 'GEO', 'ge', '']) {
      expect((await addGroundVisit(context(db, '/api/passport/ground-visits', 'POST', { countryCode }))).status).toBe(400)
    }
    expect(await count(db, 'ground_visits')).toBe(0)
  } finally { await dispose() }
})

it('keeps derived state published when unclaiming, including a no-op and ground-only unclaim', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await repairUserDerivedState(db, user.id)
    const before = await derivedState(db)

    const noop = await unclaimCountry(context(db, '/api/passport/claims/FR', 'DELETE', undefined, 'FR'))
    expect(noop.status).toBe(200)
    expect(await derivedState(db)).toEqual(before)

    // Ground visits need no claim; dropping only them must still repair.
    await db.prepare('INSERT INTO ground_visits (id,user_id,country_code) VALUES (?,?,?)').bind('visit-2', user.id, 'FR').run()
    const groundOnly = await unclaimCountry(context(db, '/api/passport/claims/FR', 'DELETE', undefined, 'FR'))
    expect(await groundOnly.json()).toMatchObject({ ok: true, derived_state: 'ready' })
    expect(await count(db, 'ground_visits')).toBe(0)
    const after = await derivedState(db)
    expect(after!.revision).toBeGreaterThan(before!.revision)
    expect(after!.published_revision).toBe(after!.revision)
  } finally { await dispose() }
})
