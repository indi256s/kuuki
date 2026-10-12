import { expect, it, vi } from 'vitest'
import {
  DEFAULT_PREFS,
  parsePrefs,
  type OverviewPrefs,
} from '../../packages/shared/src/overview/prefs'
import { onRequestGet, onRequestPut } from '../api/me/overview/prefs'
import { readOverviewData } from '../api/_services/overviewData'
import { apiContext, csrfRequest } from './harness'
import { overviewAccount, USER } from './overview-fixture'

const path = '/api/me/overview/prefs'
const valid: OverviewPrefs = {
  version: 1,
  filter: {
    airlines: ['NO_LONGER_FLOWN'],
    countries: ['ZZ'],
    period: { from: '2025-11', to: '2026-02' },
    haul: ['long'],
    departureBands: ['night'],
    airports: ['OBSOLETE'],
    alliances: ['oneworld'],
    families: ['obsolete'],
    makers: ['unknown'],
    bodies: ['narrow'],
    depHours: [0, 23],
    arrHours: [6],
    months: [3, 12],
  },
  layout: {
    order: ['aircraft', 'records', 'crossings', 'clock', 'rhythm', 'rankings', 'routes'],
    hidden: ['rhythm'],
  },
  replayPaused: true,
  publicSections: { records: true, fleet: false },
}
const call = (db: D1Database, request: Request) =>
  (request.method === 'PUT' ? onRequestPut : onRequestGet)({
    ...apiContext(db, request),
    data: { user: USER },
  } as never)

it('defaults when unset, with no-store', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    const response = await call(db, new Request(`https://kuuki.test${path}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      version: 1,
      filter: {},
      layout: {
        order: ['rankings', 'routes', 'records', 'crossings', 'rhythm', 'clock', 'aircraft'],
        hidden: [],
      },
      replayPaused: false,
      publicSections: { records: false, fleet: false },
    })
  } finally {
    await dispose()
  }
})

it.each([
  null,
  '{',
  'null',
  '[]',
  'true',
  '{"version":2,"replayPaused":true}',
  '{"version":"1","replayPaused":true}',
])('malformed or unknown-version stored preferences read as defaults: %s', (raw) => {
  expect(parsePrefs(raw)).toEqual(DEFAULT_PREFS)
})

it('old version merges known fields and defaults invalid fields independently', async () => {
  const { db, dispose } = await overviewAccount([], (d) => [
    d.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?').bind(
      JSON.stringify({
        version: 0,
        filter: { airlines: ['OLD_CODE'], countries: 9, period: { from: 'bad', to: 'bad' } },
        layout: { order: ['unknown'], hidden: ['fleet', 'manufacturers'] },
        replayPaused: true,
        publicSections: { records: 'yes', fleet: true },
        obsolete: 'ignored',
      }),
      USER.id,
    ),
  ])
  try {
    const response = await call(db, new Request(`https://kuuki.test${path}`))
    expect(await response.json()).toEqual({
      ...DEFAULT_PREFS,
      filter: { airlines: ['OLD_CODE'] },
      replayPaused: true,
      layout: { order: DEFAULT_PREFS.layout.order, hidden: ['aircraft'] },
      publicSections: { records: false, fleet: true },
    })
  } finally {
    await dispose()
  }
})

it('default results do not share mutable account preferences', () => {
  const prefs = parsePrefs(null)
  prefs.layout.order.reverse()
  prefs.publicSections.records = true
  expect(parsePrefs(null).layout.order[0]).toBe('rankings')
  expect(parsePrefs(null).publicSections.records).toBe(false)
})

it('PUT round-trips unknown facet values without touching another owner, home or revision', async () => {
  const { db, dispose } = await overviewAccount([], (d) => [
    d.prepare(
      "INSERT INTO users (id,email,password_hash) VALUES ('other','other@example.test','hash')",
    ),
    d.prepare("INSERT INTO profiles (id,overview_prefs) VALUES ('other',NULL)"),
    d.prepare("UPDATE profiles SET home_airport = 'TBS' WHERE id = ?").bind(USER.id),
  ])
  try {
    const etag = (await readOverviewData(db, USER.id)).etag
    const response = await call(db, csrfRequest(path, 'PUT', valid))
    expect(response.status).toBe(200)
    const returned = (await response.json()) as OverviewPrefs
    expect(returned).toEqual(valid)
    expect(Object.keys(returned.filter)).toEqual(Object.keys(valid.filter))
    const reloaded = (await (
      await call(db, new Request(`https://kuuki.test${path}`))
    ).json()) as OverviewPrefs
    expect(reloaded).toEqual(valid)
    expect(Object.keys(reloaded.filter)).toEqual(Object.keys(valid.filter))
    const stored = await db
      .prepare('SELECT overview_prefs,home_airport FROM profiles WHERE id = ?')
      .bind(USER.id)
      .first<{ overview_prefs: string; home_airport: string }>()
    expect(JSON.parse(stored!.overview_prefs)).toEqual(valid)
    expect(stored!.home_airport).toBe('TBS')
    expect(
      await db.prepare("SELECT overview_prefs FROM profiles WHERE id = 'other'").first(),
    ).toEqual({ overview_prefs: null })
    expect((await readOverviewData(db, USER.id)).etag).toBe(etag)
  } finally {
    await dispose()
  }
})

it('rejects malformed, oversize and invalid-field writes with INVALID_PREFS, preserving stored values', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    expect((await call(db, csrfRequest(path, 'PUT', valid))).status).toBe(200)
    const invalid: unknown[] = [
      '{',
      'x'.repeat(128 * 1024 + 1),
      null,
      [],
      { ...valid, version: 0 },
      { ...valid, replayPaused: 'yes' },
      { ...valid, filter: { airlines: ['x'.repeat(8192)] } },
      { ...valid, filter: { countries: [42] } },
      ...[
        { makers: ['Airbus'] },
        { bodies: ['widebody'] },
        { alliances: ['unknown'] },
        { depHours: [-1] },
        { depHours: [24] },
        { months: [0] },
        { months: [13] },
        { months: [3, 3] },
        { arrHours: [6.5] },
        { arrHours: ['6'] },
        { families: [42] },
        { airports: [42] },
        { manufacturers: ['Airbus'] },
        { unknown: [] },
      ].map((filter) => ({ ...valid, filter })),
      { ...valid, layout: { order: ['records', 'records'], hidden: [] } },
      { ...valid, layout: { order: ['unknown'], hidden: [] } },
      { ...valid, layout: { order: valid.layout.order, hidden: ['unknown'] } },
      { ...valid, layout: { order: valid.layout.order, hidden: ['aircraft', 'aircraft'] } },
      { ...valid, filter: { period: { from: '2025-13', to: '2026-01' } } },
      { ...valid, filter: { period: { from: '2026-02', to: '2025-11' } } },
      { ...valid, publicSections: { records: true, fleet: 'yes' } },
      { ...valid, home_airport: 'JFK' },
    ]
    for (const body of invalid) {
      const response = await call(db, csrfRequest(path, 'PUT', body))
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'INVALID_PREFS' })
    }
    expect(await (await call(db, new Request(`https://kuuki.test${path}`))).json()).toEqual(valid)
  } finally {
    await dispose()
  }
})

it('accepts exactly 8192 serialized characters and rejects 8193, including multibyte values', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    const body = { ...valid, filter: { airlines: [''] } }
    const base = JSON.stringify(body).length
    body.filter.airlines[0] = 'я'.repeat(8192 - base)
    expect(JSON.stringify(body).length).toBe(8192)
    expect((await call(db, csrfRequest(path, 'PUT', body))).status).toBe(200)
    body.filter.airlines[0] += 'я'
    const rejected = await call(db, csrfRequest(path, 'PUT', body))
    expect(rejected.status).toBe(400)
    expect(await rejected.json()).toMatchObject({ code: 'INVALID_PREFS' })
  } finally {
    await dispose()
  }
})

it.each(['missing token', 'cross-origin'])(
  'PUT rejects %s before database access',
  async (reason) => {
    const prepare = vi.fn()
    const response = await call(
      { prepare } as unknown as D1Database,
      csrfRequest(
        path,
        'PUT',
        valid,
        reason === 'missing token' ? { 'X-CSRF-Token': '' } : { Origin: 'https://other.test' },
      ),
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'CSRF' })
    expect(prepare).not.toHaveBeenCalled()
  },
)

it.each(['GET', 'PUT'])('%s authenticates before database access', async (method) => {
  const prepare = vi.fn()
  const request =
    method === 'GET' ? new Request(`https://kuuki.test${path}`) : csrfRequest(path, 'PUT', valid)
  const response = await (method === 'GET' ? onRequestGet : onRequestPut)(
    apiContext({ prepare } as unknown as D1Database, request) as never,
  )
  expect(response.status).toBe(401)
  expect(prepare).not.toHaveBeenCalled()
})

it('missing profiles return 404 on both reads and writes', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    await db.prepare('DELETE FROM profiles WHERE id = ?').bind(USER.id).run()
    expect((await call(db, new Request(`https://kuuki.test${path}`))).status).toBe(404)
    expect((await call(db, csrfRequest(path, 'PUT', valid))).status).toBe(404)
  } finally {
    await dispose()
  }
})
