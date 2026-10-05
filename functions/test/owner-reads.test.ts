import { expect, it } from 'vitest'
import { apiContext, createApiDatabase } from './harness'
import { onRequestGet as getFlights } from '../api/flights/index'
import { onRequestGet as getPassport } from '../api/passport/countries/index'

const owner = { id: 'read-owner', email: 'owner@example.test' }
const other = { id: 'read-other', email: 'other@example.test' }

it('returns a filtered owner flight page with its own count and current revisions', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(owner.id, owner.email, 'hash'),
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(other.id, other.email, 'hash'),
      db.prepare('INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,?)').bind(owner.id, '2025-04-02', 'TBS', 'IST', 0),
      db.prepare('INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,?)').bind(owner.id, '2025-04-03', 'TBS', 'JFK', 0),
      db.prepare('INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,?)').bind(other.id, '2025-04-04', 'TBS', 'LHR', 0),
      db.prepare('INSERT INTO user_derived_state (user_id,revision,published_revision) VALUES (?,?,?)').bind(owner.id, 7, 6),
      db.prepare('INSERT INTO user_derived_state (user_id,revision,published_revision) VALUES (?,?,?)').bind(other.id, 20, 20),
    ])
    const request = new Request('https://kuuki.test/api/flights?origin=TBS&limit=1&offset=1&sortOrder=asc')
    const response = await getFlights({ ...apiContext(db, request), data: { user: owner } } as never)
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body).toMatchObject({ total: 2, revision: 7, publishedRevision: 6, flights: [{ destination: 'JFK', is_upcoming: false }] })
    expect(typeof body.updatedAt).toBe('number')
    expect(JSON.stringify(body)).not.toContain('LHR')
  } finally { await dispose() }
})

it('returns owner passport collections including ground visit details and current revisions', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(owner.id, owner.email, 'hash'),
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(other.id, other.email, 'hash'),
      db.prepare('INSERT INTO visits (user_id,country_code,airport_iata,first_visit,last_visit) VALUES (?,?,?,?,?)').bind(owner.id, 'GE', 'TBS', '2024-01-01', '2025-01-01'),
      db.prepare('INSERT INTO country_claims (id,user_id,country_code) VALUES (?,?,?)').bind('claim-owner', owner.id, 'FR'),
      db.prepare('INSERT INTO ground_visits (id,user_id,country_code,visit_year,entry_method) VALUES (?,?,?,?,?)').bind('ground-owner', owner.id, 'TR', 2023, 'land'),
      db.prepare('INSERT INTO ground_visits (id,user_id,country_code,visit_year,entry_method) VALUES (?,?,?,?,?)').bind('ground-other', other.id, 'US', 2020, 'sea'),
      db.prepare('INSERT INTO user_derived_state (user_id,revision,published_revision) VALUES (?,?,?)').bind(owner.id, 9, 8),
    ])
    const request = new Request('https://kuuki.test/api/passport/countries')
    const response = await getPassport({ ...apiContext(db, request), data: { user: owner } } as never)
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body).toMatchObject({
      revision: 9, publishedRevision: 8,
      visits: [{ country_code: 'GE', airport_iata: 'TBS' }],
      claims: [{ country_code: 'FR' }],
      groundVisits: [{ country_code: 'TR', visit_year: 2023, entry_method: 'land' }],
    })
    expect(typeof body.updatedAt).toBe('number')
    expect(JSON.stringify(body)).not.toContain('US')
  } finally { await dispose() }
})
