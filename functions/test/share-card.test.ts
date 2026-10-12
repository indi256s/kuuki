import { inflateSync } from 'node:zlib'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '../../packages/shared/src/overview/compute'
import type { OverviewPayload } from '../../packages/shared/src/overview/model'
import fixture from '../../packages/shared/src/overview/__fixtures__/n10.json'
import { onRequestGet, shareFilter } from '../api/me/overview/share.png'
import { resolveShareAccent, shareCardTree } from '../api/_services/overviewShareCard'
import * as card from '../api/_services/overviewShareCard'
import { DEFAULT_PREFS } from '../../packages/shared/src/overview/prefs'
import {
  SURFACES,
  THEMES,
  type AccentKey,
  type Mode,
} from '../../packages/shared/src/theme/palette'
import { apiContext } from './harness'
import { overviewAccount, USER } from './overview-fixture'
import { dirtyUserStatement, repairUserDerivedState } from '../api/_services/derivedState'

// Node tests use the package's Node adapter; local workerd proves its Worker adapter separately.
vi.mock('@cf-wasm/og/workerd', async () => import('@cf-wasm/og/node'))
afterEach(() => vi.restoreAllMocks())

it('owner gets a 1200x1500 png with no external fetch or persistent caching', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Outbound request forbidden'))
    const response = await onRequestGet({
      ...apiContext(db, new Request('https://kuuki.test/api/me/overview/share.png')),
      data: { user: USER },
    } as never)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const header = new DataView(bytes.buffer)
    expect(header.getUint32(16)).toBe(1200)
    expect(header.getUint32(20)).toBe(1500)
    expect(fetcher).not.toHaveBeenCalled()
  } finally {
    await dispose()
  }
})

it('card embeds the chart svg from unchanged Clock rows', () => {
  const scope = computeOverview(fixture as OverviewPayload, {})
  const tree = shareCardTree(scope)
  const image = tree.props.children.find((child) => child.type === 'img')!
  if (!('src' in image.props)) throw new Error('The fixture card must embed its chart')
  expect(image.props.src).toMatch(/^data:image\/svg\+xml/)
  const svg = decodeURIComponent(String(image.props.src).split(',')[1])
  expect(svg).toContain('<svg')
  expect(svg).toContain('aria-label="Clock"')
  if (scope.clock.status !== 'ready') throw new Error('The fixture must satisfy the Clock minimum')
  for (const row of scope.clock.value.byHour)
    expect(svg).toContain(`data-hour="${row.hour}" data-flights="${row.flights}"`)
  expect(svg).not.toMatch(/NaN|Infinity/)
})

it('withholds filtered shares after failed D12 publication, then renders repaired evidence', async () => {
  const { db, dispose } = await overviewAccount([
    {
      id: 1,
      date: '2025-01-01',
      origin: 'TBS',
      destination: 'IST',
      state: 'logged',
      dep: '2025-01-01T08:00:00Z',
      arr: '2025-01-01T10:00:00Z',
    },
    {
      id: 2,
      date: '2025-01-01',
      origin: 'IST',
      destination: 'JFK',
      state: 'logged',
      dep: '2025-01-01T12:00:00Z',
      arr: '2025-01-01T22:00:00Z',
    },
  ])
  try {
    await db.batch([
      db.prepare('UPDATE flights SET arrival_transit=1,arrival_transit_leg_id=2 WHERE id=1'),
      dirtyUserStatement(db, USER.id, true),
    ])
    await db
      .prepare(
        "CREATE TRIGGER fail_share_publication BEFORE UPDATE OF published_revision ON user_derived_state BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
      )
      .run()
    expect(await repairUserDerivedState(db, USER.id)).toMatchObject({ derived_state: 'pending' })
    const render = vi
      .spyOn(card, 'renderShareCard')
      .mockImplementation(async (scope) => new Response(String(scope.figures.flights)))
    const filter = Buffer.from('{"countries":["TR"]}').toString('base64url')
    const get = () =>
      onRequestGet({
        ...apiContext(
          db,
          new Request(`https://kuuki.test/api/me/overview/share.png?filter=${filter}`),
        ),
        data: { user: USER },
      } as never)
    const pending = await get()
    expect(pending.status).toBe(503)
    expect(pending.headers.get('Cache-Control')).toBe('no-store')
    expect(await pending.json()).toMatchObject({ code: 'DERIVED_PENDING' })
    expect(render).not.toHaveBeenCalled()
    await db.prepare('DROP TRIGGER fail_share_publication').run()
    expect(await repairUserDerivedState(db, USER.id)).toMatchObject({ derived_state: 'ready' })
    const repaired = await get()
    expect(repaired.status).toBe(200)
    expect(await repaired.text()).toBe('0')
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0].figures.countries.value).toBe(0)
  } finally {
    await dispose()
  }
})

it('valid filters survive decoding and remembered preferences apply only without an explicit filter', async () => {
  expect(shareFilter(Buffer.from('{"airlines":["unknown"]}').toString('base64url'))).toEqual({
    airlines: ['unknown'],
  })
  const { db, dispose } = await overviewAccount(
    Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      date: '2025-01-01',
      origin: 'TBS',
      destination: 'IST',
      state: 'logged' as const,
      airline: i < 2 ? 'TK' : 'BA',
    })),
    (db) => [
      db
        .prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?')
        .bind(JSON.stringify({ ...DEFAULT_PREFS, filter: { airlines: ['TK'] } }), USER.id),
    ],
  )
  try {
    const render = vi
      .spyOn(card, 'renderShareCard')
      .mockImplementation(async (scope) => new Response(String(scope.figures.flights)))
    const get = (query = '') =>
      onRequestGet({
        ...apiContext(db, new Request(`https://kuuki.test/api/me/overview/share.png${query}`)),
        data: { user: USER },
      } as never)
    expect(await (await get()).text()).toBe('2')
    expect(await (await get('?filter=e30')).text()).toBe('3')
    expect(
      await (
        await get(`?filter=${Buffer.from('{"airlines":["unknown"]}').toString('base64url')}`)
      ).text(),
    ).toBe('0')
    expect(render).toHaveBeenCalledTimes(3)
  } finally {
    await dispose()
  }
})

it('anonymous is 401 before database access', async () => {
  const db = { prepare: vi.fn(), batch: vi.fn() } as unknown as D1Database
  const response = await onRequestGet(
    apiContext(db, new Request('https://kuuki.test/api/me/overview/share.png')) as never,
  )
  expect(response.status).toBe(401)
  expect(db.prepare).not.toHaveBeenCalled()
  expect(db.batch).not.toHaveBeenCalled()
})

it.each([
  '%',
  '',
  'e30=',
  'a',
  Buffer.from('{').toString('base64url'),
  Buffer.from('{"unexpected":true}').toString('base64url'),
  Buffer.from('{"period":{"from":"2025-12","to":"2025-01"}}').toString('base64url'),
  'A'.repeat(8193),
])('invalid filter param is 400 before database access: %s', async (filter) => {
  const db = { prepare: vi.fn(), batch: vi.fn() } as unknown as D1Database
  const response = await onRequestGet({
    ...apiContext(
      db,
      new Request(
        `https://kuuki.test/api/me/overview/share.png?filter=${encodeURIComponent(filter)}`,
      ),
    ),
    data: { user: USER },
  } as never)
  expect(response.status).toBe(400)
  expect(db.prepare).not.toHaveBeenCalled()
  expect(db.batch).not.toHaveBeenCalled()
})

// --- Theme snapshot: decode the real PNG and sample pixels -------------------------------------------------------------

/** Minimal 8-bit, non-interlaced RGB/RGBA PNG decoder (zlib inflate plus the five scanline filters). */
function decodePng(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const idat: Uint8Array[] = []
  let width = 0,
    height = 0,
    channels = 0
  for (let at = 8; at < bytes.length;) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...bytes.slice(at + 4, at + 8))
    const data = bytes.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
      expect([data[8], data[12]]).toEqual([8, 0]) // 8-bit, not interlaced
      channels = data[9] === 6 ? 4 : 3
      expect([2, 6]).toContain(data[9])
    }
    if (type === 'IDAT') idat.push(data)
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const pixels = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[y * stride + i - channels] : 0
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0
      const upLeft = y > 0 && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0
      const paeth = () => {
        const p = left + up - upLeft
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)]
        return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      }
      const predictor = [0, left, up, (left + up) >> 1, paeth()][filter]
      pixels[y * stride + i] = (line[i] + predictor) & 255
    }
  }
  return {
    width,
    height,
    rgb: (x: number, y: number) => [
      ...pixels.subarray(y * stride + x * channels, y * stride + x * channels + 3),
    ],
  }
}

const hex = (color: string) => [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16))
/** Sampled pixel within 2 per channel of the palette hex (the rasteriser may round). */
function expectPixel(png: ReturnType<typeof decodePng>, x: number, y: number, color: string) {
  const got = png.rgb(x, y)
  hex(color).forEach((channel, i) => expect(Math.abs(got[i] - channel)).toBeLessThanOrEqual(2))
}

// Four 08:10 departures and two 20:10 ones: hour 8 is the peak, hour 20 the runner-up, hour 3 is empty. The chart
// is drawn 1:1 at y=88 below the four figure rows; bar x = 40 + hour * 556/24, top = 98, baseline = 365.
const BARS = { peak: [236, 300], other: [514, 340], empty: [120, 300] } as const
const clockFlights = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  date: `2025-01-0${i + 1}`,
  origin: 'TBS',
  destination: 'IST',
  state: 'logged' as const,
}))
const clockAccount = (themeColor: string | null) =>
  overviewAccount(clockFlights, (db) => [
    db.prepare("UPDATE flights SET departure_time = '08:10' WHERE id <= 4"),
    db.prepare("UPDATE flights SET departure_time = '20:10' WHERE id > 4"),
    db.prepare('UPDATE profiles SET theme_color = ? WHERE id = ?').bind(themeColor, USER.id),
  ])
const shareGet = (db: D1Database, query = '') =>
  onRequestGet({
    ...apiContext(db, new Request(`https://kuuki.test/api/me/overview/share.png${query}`)),
    data: { user: USER },
  } as never)
const readPng = async (response: Response) =>
  decodePng(new Uint8Array(await response.arrayBuffer()))

it.each(['shu', 'asagi'] as AccentKey[])(
  'png draws background, bars and text from the %s snapshot in both modes',
  async (accent) => {
    const { db, dispose } = await clockAccount(accent)
    try {
      for (const mode of ['light', 'dark'] as Mode[]) {
        const response = await shareGet(db, `?mode=${mode}`)
        expect(response.status).toBe(200)
        const png = await readPng(response)
        const surfaces = SURFACES[mode]
        const { comparison, heat } = THEMES[accent][mode]
        expectPixel(png, 0, 0, surfaces.background)
        expectPixel(png, 1199, 1499, surfaces.background)
        expectPixel(png, ...BARS.peak, comparison[0])
        // Every other hour is the live `--mark-rest`, heat level 3.
        expectPixel(png, ...BARS.other, heat[2].color)
        // An hour without flights draws no bar: its column is still the card background.
        expectPixel(png, ...BARS.empty, surfaces.background)
        // The figure rows are text in the snapshot's text color (glyph stems reach full coverage).
        const target = hex(surfaces.text)
        let nearest = Infinity
        for (let y = 0; y < 80; y++)
          for (let x = 0; x < 12; x++)
            nearest = Math.min(
              nearest,
              Math.max(...png.rgb(x, y).map((value, i) => Math.abs(value - target[i]))),
            )
        expect(nearest).toBeLessThanOrEqual(2)
      }
    } finally {
      await dispose()
    }
  },
)

it('without a mode the card is light, in the owner accent; a missing accent falls back to shu', async () => {
  const { db, dispose } = await clockAccount(null)
  try {
    const png = await readPng(await shareGet(db))
    expectPixel(png, 0, 0, '#fbfaf8')
    expectPixel(png, ...BARS.peak, THEMES.shu.light.comparison[0])
  } finally {
    await dispose()
  }
})

it('request parameters cannot supply an accent or a color', async () => {
  const { db, dispose } = await clockAccount('asagi')
  try {
    const query = '?mode=dark&accent=sakura&theme_color=sakura&color=%23ff0000&background=%23ff0000'
    const png = await readPng(await shareGet(db, query))
    expectPixel(png, 0, 0, SURFACES.dark.background)
    expectPixel(png, ...BARS.peak, THEMES.asagi.dark.comparison[0])
  } finally {
    await dispose()
  }
})

it.each(['sepia', '', 'LIGHT', 'light,dark'])(
  'invalid mode %j is 400 BAD_REQUEST before database access',
  async (mode) => {
    const db = { prepare: vi.fn(), batch: vi.fn() } as unknown as D1Database
    const response = await shareGet(db, `?mode=${encodeURIComponent(mode)}`)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST', error: 'Invalid mode' })
    expect(db.prepare).not.toHaveBeenCalled()
    expect(db.batch).not.toHaveBeenCalled()
  },
)

it('anonymous with an invalid mode is still 401 before database access', async () => {
  const db = { prepare: vi.fn(), batch: vi.fn() } as unknown as D1Database
  const response = await onRequestGet(
    apiContext(db, new Request('https://kuuki.test/api/me/overview/share.png?mode=sepia')) as never,
  )
  expect(response.status).toBe(401)
  expect(db.prepare).not.toHaveBeenCalled()
})

it('legacy stored colors resolve to the canonical accent; unknown values fall back to shu', () => {
  expect(
    ['sakura', 'terracotta', 'blue', 'cyan', 'teal', 'purple', 'coral', 'nope', null].map(
      resolveShareAccent,
    ),
  ).toEqual(['sakura', 'shu', 'ai', 'asagi', 'asagi', 'sakura', 'sakura', 'shu', 'shu'])
})

it('chart draws a bar only for hours with flights and nothing for a clock that is not ready', () => {
  const scope = computeOverview(fixture as OverviewPayload, {})
  if (scope.clock.status !== 'ready') throw new Error('The fixture must satisfy the Clock minimum')
  const chart = (value: typeof scope) => {
    const image = shareCardTree(value).props.children.find((child) => child.type === 'img')!
    if (!('src' in image.props)) throw new Error('The card must embed its chart')
    return decodeURIComponent(String(image.props.src).split(',')[1])
  }
  const flown = scope.clock.value.byHour.filter((row) => row.flights > 0).length
  expect(flown).toBeLessThan(24)
  expect(chart(scope).match(/<rect/g)).toHaveLength(flown)
  const waiting = chart({ ...scope, clock: { status: 'below', have: 0, need: 5 } })
  expect(waiting).not.toMatch(/<rect|data-hour|NaN|Infinity/)
})
