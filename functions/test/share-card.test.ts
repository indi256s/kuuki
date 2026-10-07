import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '../../packages/shared/src/overview/compute'
import type { OverviewPayload } from '../../packages/shared/src/overview/model'
import fixture from '../../packages/shared/src/overview/__fixtures__/n10.json'
import { onRequestGet, shareFilter } from '../api/me/overview/share.png'
import { shareCardTree } from '../api/_services/overviewShareCard'
import * as card from '../api/_services/overviewShareCard'
import { DEFAULT_PREFS } from '../../packages/shared/src/overview/prefs'
import { apiContext } from './harness'
import { overviewAccount, USER } from './overview-fixture'

// Node tests use the package's Node adapter; local workerd proves its Worker adapter separately.
vi.mock('@cf-wasm/og/workerd', async () => import('@cf-wasm/og/node'))
afterEach(() => vi.restoreAllMocks())

it('owner gets a 1200x1500 png with no external fetch or persistent caching', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Outbound request forbidden'))
    const response = await onRequestGet({ ...apiContext(db, new Request('https://kuuki.test/api/me/overview/share.png')),
      data: { user: USER } } as never)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const header = new DataView(bytes.buffer)
    expect(header.getUint32(16)).toBe(1200)
    expect(header.getUint32(20)).toBe(1500)
    expect(fetcher).not.toHaveBeenCalled()
  } finally { await dispose() }
})

it('card embeds the chart svg from unchanged Clock rows', () => {
  const scope = computeOverview(fixture as OverviewPayload, {})
  const tree = shareCardTree(scope)
  const image = tree.props.children.find(child => child.type === 'img')!
  if (!('src' in image.props)) throw new Error('The fixture card must embed its chart')
  expect(image.props.src).toMatch(/^data:image\/svg\+xml/)
  const svg = decodeURIComponent(String(image.props.src).split(',')[1])
  expect(svg).toContain('<svg')
  expect(svg).toContain('aria-label="Clock"')
})

it('valid filters survive decoding and remembered preferences apply only without an explicit filter', async () => {
  expect(shareFilter(Buffer.from('{"airlines":["unknown"]}').toString('base64url'))).toEqual({ airlines: ['unknown'] })
  const { db, dispose } = await overviewAccount(Array.from({ length: 3 }, (_, i) => ({
    id: i + 1, date: '2025-01-01', origin: 'TBS', destination: 'IST', state: 'logged' as const, airline: i < 2 ? 'TK' : 'BA',
  })), db => [db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?')
    .bind(JSON.stringify({ ...DEFAULT_PREFS, filter: { airlines: ['TK'] } }), USER.id)])
  try {
    const render = vi.spyOn(card, 'renderShareCard').mockImplementation(async scope => new Response(String(scope.figures.flights)))
    const get = (query = '') => onRequestGet({ ...apiContext(db, new Request(`https://kuuki.test/api/me/overview/share.png${query}`)),
      data: { user: USER } } as never)
    expect(await (await get()).text()).toBe('2')
    expect(await (await get('?filter=e30')).text()).toBe('3')
    expect(await (await get(`?filter=${Buffer.from('{"airlines":["unknown"]}').toString('base64url')}`)).text()).toBe('0')
    expect(render).toHaveBeenCalledTimes(3)
  } finally { await dispose() }
})

it('anonymous is 401 before database access', async () => {
  const db = { prepare: vi.fn(), batch: vi.fn() } as unknown as D1Database
  const response = await onRequestGet(apiContext(db, new Request('https://kuuki.test/api/me/overview/share.png')) as never)
  expect(response.status).toBe(401)
  expect(db.prepare).not.toHaveBeenCalled()
  expect(db.batch).not.toHaveBeenCalled()
})

it.each(['%', '', 'e30=', 'a', Buffer.from('{').toString('base64url'),
  Buffer.from('{"unexpected":true}').toString('base64url'), Buffer.from('{"period":{"from":"2025-12","to":"2025-01"}}').toString('base64url'),
  'A'.repeat(8193)])('invalid filter param is 400 before database access: %s', async filter => {
  const db = { prepare: vi.fn(), batch: vi.fn() } as unknown as D1Database
  const response = await onRequestGet({ ...apiContext(db, new Request(`https://kuuki.test/api/me/overview/share.png?filter=${encodeURIComponent(filter)}`)),
    data: { user: USER } } as never)
  expect(response.status).toBe(400)
  expect(db.prepare).not.toHaveBeenCalled()
  expect(db.batch).not.toHaveBeenCalled()
})
