import { expect, it } from 'vitest'
import { apiContext, createApiDatabase } from './harness'
import { onRequestGet as getFlights } from '../api/flights/index'
import { onRequestGet as getJournal } from '../api/flights/journal'
import { onRequestGet as getPassport } from '../api/passport/countries/index'
import type { JournalPayload } from '../api/_services/journalPayload'
import { accountWith, flightStatement, USER } from './country-fixture'

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

it('returns the whole owner journal with countries, refs, firsts and revisions', async () => {
  const { db, dispose } = await accountWith([
    { id: 1, date: '2025-01-10', origin: 'TBS', destination: 'IST', state: 'logged' },
    { id: 2, date: '2025-02-10', origin: 'IST', destination: 'LHR', state: 'awaiting' },
    { id: 3, date: '2027-05-01', origin: 'LHR', destination: 'XXX', state: 'upcoming' },
  ], d => [
    d.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(other.id, other.email, 'hash'),
    flightStatement(d, { id: 4, date: '2024-01-01', origin: 'JFK', destination: 'DXB', state: 'logged', user: other.id }),
    d.prepare("UPDATE flights SET airline_iata = 'TK', aircraft_icao = 'A321' WHERE id IN (1, 2)"),
    d.prepare("INSERT INTO aircraft_reference (icao,name,manufacturer,model,type,engine_type,engine_count) VALUES ('A321','Airbus A321','Airbus','A321','jet','jet',2)"),
  ])
  try {
    const request = new Request(`https://kuuki.test/api/flights/journal?owner=${USER.id}`)
    const response = await getJournal({ ...apiContext(db, request), data: { user: USER } } as never)
    expect(response.status).toBe(200)
    const body = await response.json() as JournalPayload
    expect(body.flights.map(flight => [flight.id, flight.lifecycle_state, flight.origin_country, flight.destination_country])).toEqual([
      [3, 'upcoming', 'GB', null], [2, 'awaiting', 'TR', 'GB'], [1, 'logged', 'GE', 'TR'],
    ])
    expect(JSON.stringify(body)).not.toContain('DXB')
    expect(body.refs).toEqual({
      airports: {
        IST: { city: 'IST city', name: 'IST', country: 'TR' }, LHR: { city: 'LHR city', name: 'LHR', country: 'GB' },
        TBS: { city: 'TBS city', name: 'TBS', country: 'GE' }, XXX: { city: null, name: 'XXX', country: null },
      },
      airlines: { TK: { name: 'Turkish Airlines' } },
      aircraft: { A321: { name: 'Airbus A321', family: expect.any(String), manufacturer: 'Airbus', type: 'jet' } },
    })
    expect(body.firsts).toEqual({
      1: { countries: ['GE', 'TR'], airline: true, aircraft: true, pending: false },
      2: { countries: ['GB'], airline: false, aircraft: false, pending: true },
    })
    const state = await db.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(USER.id).first<{ revision: number; published_revision: number }>()
    expect(body).toMatchObject({ revision: state!.revision, publishedRevision: state!.published_revision, derivedState: 'ready' })
    expect(state!.revision).toBeGreaterThan(0)
    expect(typeof body.updatedAt).toBe('number')

    const guest = await getJournal({ ...apiContext(db, request) } as never)
    expect(guest.status).toBe(401)

    // A page rendered for another account (cross-tab switch) is refused before its read, and so is an unbound read.
    const switched = await getJournal({ ...apiContext(db, new Request(`https://kuuki.test/api/flights/journal?owner=${other.id}`)), data: { user: USER } } as never)
    expect(switched.status).toBe(409)
    const refused = await switched.json()
    expect(refused).toMatchObject({ code: 'OWNER_CHANGED' })
    expect(JSON.stringify(refused)).not.toContain('TBS')
    const unbound = await getJournal({ ...apiContext(db, new Request('https://kuuki.test/api/flights/journal')), data: { user: USER } } as never)
    expect(unbound.status).toBe(400)
  } finally { await dispose() }
})
