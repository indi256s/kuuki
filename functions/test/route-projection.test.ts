import { expect, it } from 'vitest'
import { apiContext, createApiDatabase } from './harness'
import { onRequestGet } from '../api/flights/route-projection'

const user = { id: 'map-owner', email: 'map-owner@example.test' }
const other = { id: 'other-owner', email: 'other-owner@example.test' }

it('returns private, grouped, period-scoped routes with D1 coordinates and honest unknowns', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(other.id, other.email, 'hash'),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code,latitude,longitude) VALUES ('AAA','A','Tbilisi','Georgia','GE',41.7,44.8)"),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code,latitude,longitude) VALUES ('BBB','B','Paris','France','FR',49.0,2.5)"),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,0)").bind(user.id, '2024-03-01', 'AAA', 'BBB'),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,0)").bind(user.id, '2024-04-01', 'AAA', 'BBB'),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,0)").bind(user.id, '2024-05-01', 'BBB', 'AAA'),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,0)").bind(user.id, '2024-06-01', 'AAA', 'ZZZ'),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,1)").bind(user.id, '2024-07-01', 'AAA', 'BBB'),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,0)").bind(user.id, '2025-01-01', 'AAA', 'BBB'),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,0)").bind(other.id, '2024-01-01', 'AAA', 'BBB'),
    ])
    const request = new Request('https://kuuki.test/api/flights/route-projection?period=2024')
    const response = await onRequestGet({ ...apiContext(db, request), data: { user } } as never)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json() as { ownerId: string; period: string; routes: Array<Record<string, unknown>> }
    expect(body.ownerId).toBe(user.id)
    expect(body.period).toBe('2024')
    expect(body.routes).toHaveLength(3)
    expect(body.routes.find(route => route.origin === 'AAA' && route.destination === 'BBB')).toMatchObject({
      count: 2, lastDate: '2024-04-01', from: [44.8, 41.7], to: [2.5, 49],
      originCountry: 'GE', destinationCountry: 'FR',
    })
    expect(body.routes.find(route => route.destination === 'AAA')).toMatchObject({ count: 1, origin: 'BBB' })
    expect(body.routes.find(route => route.destination === 'ZZZ')).toMatchObject({ count: 1, to: null })
    expect(JSON.stringify(body)).not.toContain(other.id)
    expect(JSON.stringify(body)).not.toContain('2025-01-01')
    expect((await onRequestGet({ ...apiContext(db, request), data: {} } as never)).status).toBe(401)
    expect((await onRequestGet({ ...apiContext(db, new Request('https://kuuki.test/api/flights/route-projection?period=2024xxx')), data: { user } } as never)).status).toBe(400)
  } finally { await dispose() }
})

it.each(['0000', '1899', '2200'])('rejects unsupported period %s before any map read', async period => {
  const response = await onRequestGet({ request: new Request(`https://kuuki.test/api/flights/route-projection?period=${period}`), data: { user }, env: {} } as never)
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: 'INVALID_PERIOD' })
})
