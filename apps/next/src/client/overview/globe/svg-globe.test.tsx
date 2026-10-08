// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { readFileSync } from 'node:fs'
import type { GlobeLand } from './svg-globe'
const atlas = JSON.parse(readFileSync('public/maps/countries-110m-2.0.2.geojson', 'utf8')) as GlobeLand
import { SvgGlobe } from './svg-globe'

const payload = fixture as OverviewPayload
const all = computeOverview(payload, {}).globe
const scope = computeOverview(payload, { routes: [all.routes[0].key] }).globe
const props = { globe: scope, all, airports: payload.refs.airports, size: 436, locale: 'en' as const }
const response = (body: unknown = atlas) => ({ ok: true, json: async () => body }) as Response
const never = () => new Promise<Response>(() => {})
afterEach(() => vi.unstubAllGlobals())

it('server renders sphere, rim and great-circle routes without supplied land or requests', () => {
  const fetcher = vi.fn(never)
  vi.stubGlobal('fetch', fetcher)
  const doc = new DOMParser().parseFromString(renderToString(<SvgGlobe {...props} land={atlas} />), 'text/html')
  expect(doc.querySelector('.globe-sphere path')?.getAttribute('d')).toMatch(/^M/)
  expect(doc.querySelector('.globe-rim path')?.getAttribute('stroke-width')).toBe('16')
  expect(doc.querySelector('.globe-routes path')?.getAttribute('d')).toMatch(/^M/)
  expect(doc.querySelector('.globe-land path')).toBeNull()
  expect(fetcher).not.toHaveBeenCalled()
})

it('mounted public fetch joins the actual atlas by code and puts background arcs below selected arcs', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()))
  const { container } = render(<SvgGlobe {...props} rotate={[0, 0]} />)
  await waitFor(() => expect(container.querySelectorAll('.globe-land path').length).toBeGreaterThan(0))
  expect(fetch).toHaveBeenCalledWith('/maps/countries-110m-2.0.2.geojson', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  const groups = [...container.querySelectorAll('g')]
  const ghost = container.querySelector<SVGGElement>('.globe-ghost-routes')!
  const selected = container.querySelector<SVGGElement>('.globe-routes')!
  expect(groups.indexOf(ghost)).toBeLessThan(groups.indexOf(selected))
  expect(container.querySelector('.globe-ghost-routes path')?.getAttribute('opacity')).toBe('0.15')
  const fr = { ...scope, countries: [{ code: 'FR', visits: 10 }], ghostCountries: ['GB'] }
  const view = render(<SvgGlobe {...props} globe={fr} rotate={[0, 0]} land={atlas} />)
  await waitFor(() => expect(view.container.querySelector('.globe-countries path')?.getAttribute('fill')).toBe('var(--map-bucket-4)'))
  expect(view.container.querySelector('.globe-ghost-countries path')?.getAttribute('fill')).toBe('var(--mark-ghost)')
})

it('supplied land mounts after honest server paint without another request', async () => {
  vi.stubGlobal('fetch', vi.fn(never))
  const { container } = render(<SvgGlobe {...props} land={atlas} />)
  await waitFor(() => expect(container.querySelector('.globe-land path')).not.toBeNull())
  expect(fetch).not.toHaveBeenCalled()
})

it('centers the actual centroid and clips back-hemisphere dots and routes through the installed projection', () => {
  const globe = { ...all, routes: [{ key: 'AAA-BBB', a: 'AAA', b: 'BBB', count: 2 }, { key: 'CCC-DDD', a: 'CCC', b: 'DDD', count: 3 }], ghostRoutes: [], airports: [{ iata: 'AAA', count: 2 }, { iata: 'CCC', count: 3 }], centroid: { lon: 30, lat: 20 } }
  const airports = Object.fromEntries([['AAA', 30, 20], ['BBB', 40, 20], ['CCC', -150, -20], ['DDD', -140, -20]].map(([iata, lon, lat]) => [iata, { lon: Number(lon), lat: Number(lat), country: null, city: null, name: String(iata) }]))
  const doc = new DOMParser().parseFromString(renderToString(<SvgGlobe {...props} globe={globe} all={globe} airports={airports} size={400} />), 'text/html')
  expect(doc.querySelectorAll('.globe-airports path')).toHaveLength(1)
  expect(doc.querySelector('.globe-airports path')?.getAttribute('d')).toMatch(/^M200,200/)
  expect(doc.querySelectorAll('.globe-routes path')).toHaveLength(1)
})

it('omits missing, invalid, coincident and antipodal geometry without inventing positions', () => {
  const routes = [{ key: 'missing', a: 'AAA', b: 'ZZZ', count: 1 }, { key: 'invalid', a: 'AAA', b: 'BAD', count: 1 }, { key: 'same', a: 'AAA', b: 'AAA', count: 1 }, { key: 'opposite', a: 'AAA', b: 'OPP', count: 1 }]
  const airports = { AAA: { lat: 0, lon: 0, name: 'A', country: null, city: null }, BAD: { lat: 91, lon: 0, name: 'B', country: null, city: null }, OPP: { lat: 0, lon: 180, name: 'O', country: null, city: null } }
  const globe = { ...all, routes, ghostRoutes: [], airports: [{ iata: 'BAD', count: 1 }, { iata: 'ZZZ', count: 1 }] }
  const doc = new DOMParser().parseFromString(renderToString(<SvgGlobe {...props} globe={globe} airports={airports} />), 'text/html')
  expect(doc.querySelectorAll('.globe-routes path, .globe-airports path')).toHaveLength(0)
  expect(doc.body.textContent).toContain('AAA–ZZZ')
  expect(doc.body.innerHTML).not.toMatch(/NaN|undefined/)
})

it.each(['reject', 'status', 'json', 'malformed', 'geometry'])('keeps the useful fallback on %s fetch failure', async failure => {
  const malformedGeometry = structuredClone(atlas)
  malformedGeometry.features[0].geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 'bad'], [0, 0]]] } as never
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (failure === 'reject') throw new Error('offline')
    if (failure === 'json') return { ok: true, json: async () => { throw new SyntaxError('invalid json') } } as unknown as Response
    if (failure === 'status') return { ok: false, json: vi.fn() } as unknown as Response
    return response(failure === 'malformed' ? { type: 'FeatureCollection', features: [null] } : malformedGeometry)
  }))
  const { container } = render(<SvgGlobe {...props} />)
  await act(async () => {})
  expect(container.querySelector('.globe-sphere path')).not.toBeNull()
  expect(container.querySelector('.globe-routes path')).not.toBeNull()
  expect(container.querySelector('.globe-land path')).toBeNull()
})

it.each(['unmount', 'identity'])('aborts on %s and ignores completion even if transport ignores abort', async reason => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn<(input: string, options: RequestInit) => Promise<Response>>(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<SvgGlobe {...props} />)
  const signal = fetcher.mock.calls[0][1]?.signal as AbortSignal
  if (reason === 'unmount') view.unmount()
  else act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(signal.aborted).toBe(true)
  await act(async () => { finish(response()) })
  expect(view.container.querySelector('.globe-land path')).toBeNull()
})

it('reports selected weighted counts separately from all-time context and does not expose upcoming private IDs', async () => {
  vi.stubGlobal('fetch', vi.fn(never))
  render(<SvgGlobe {...props} />)
  const table = screen.getByRole('table', { hidden: true })
  const selectedRoute = scope.routes[0]
  const row = within(table).getByText(`${selectedRoute.a}–${selectedRoute.b}`).closest('tr')!
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Route · flights', `${selectedRoute.a}–${selectedRoute.b}`, String(selectedRoute.count), String(all.routes.find(route => route.key === selectedRoute.key)!.count)])
  const background = all.routes.find(route => scope.ghostRoutes.includes(route.key))!
  const ghostRow = within(table).getByText(`${background.a}–${background.b}`).closest('tr')!
  expect(within(ghostRow).getAllByRole('cell').map(cell => cell.textContent).slice(2)).toEqual(['0', String(background.count)])
  expect(table.textContent).not.toContain('flightId')
})

it('first-run engine data has no logged paths or replay controls; filtered zero retains background only', () => {
  vi.stubGlobal('fetch', vi.fn(never))
  const empty = computeOverview({ ...payload, rows: [{ ...payload.rows[0], id: 987654321, state: 'upcoming', date: '2027-01-01' }] }, {}).globe
  const first = render(<SvgGlobe {...props} globe={empty} all={empty} />)
  expect(first.container.querySelectorAll('.globe-routes path, .globe-ghost-routes path, .globe-airports path')).toHaveLength(0)
  expect(first.container.querySelectorAll('button')).toHaveLength(0)
  expect(first.container.innerHTML).not.toContain('987654321')
  expect(empty.ghosts).toHaveLength(1)
  first.unmount()
  const zero = computeOverview(payload, { routes: ['NOPE'] }).globe
  const filtered = render(<SvgGlobe {...props} globe={zero} />)
  expect(filtered.container.querySelectorAll('.globe-routes path')).toHaveLength(0)
  expect(filtered.container.querySelectorAll('.globe-ghost-routes path').length).toBeGreaterThan(0)
})

it('scoped and background arcs use their own weighted counts for the fixed ramp and bounded widths', () => {
  const airports = Object.fromEntries(['AAA', 'BBB', 'CCC', 'DDD', 'EEE'].map((iata, index) => [iata, { lat: 30, lon: index * 10, country: null, city: null, name: iata }]))
  const routes = ['BBB', 'CCC', 'DDD', 'EEE'].map((b, index) => ({ key: `AAA-${b}`, a: 'AAA', b, count: [1, 2, 4, 10][index] }))
  const globe = { ...all, routes, ghostRoutes: [], airports: [], centroid: null }
  const doc = new DOMParser().parseFromString(renderToString(<SvgGlobe {...props} globe={globe} all={globe} airports={airports} />), 'text/html')
  expect([...doc.querySelectorAll('.globe-routes path')].map(path => [path.getAttribute('stroke'), path.getAttribute('stroke-width')])).toEqual([
    ['var(--map-bucket-1)', '1'], ['var(--map-bucket-2)', '2'], ['var(--map-bucket-3)', '3'], ['var(--map-bucket-4)', '3'],
  ])
  const background = new DOMParser().parseFromString(renderToString(<SvgGlobe {...props} globe={{ ...globe, routes: [], ghostRoutes: routes.map(route => route.key) }} all={globe} airports={airports} />), 'text/html')
  expect([...background.querySelectorAll('.globe-ghost-routes path')].map(path => [path.getAttribute('stroke'), path.getAttribute('stroke-width'), path.getAttribute('opacity')])).toEqual([
    ['var(--mark-ghost)', '1', '0.15'], ['var(--mark-ghost)', '2', '0.15'], ['var(--mark-ghost)', '3', '0.15'], ['var(--mark-ghost)', '3', '0.15'],
  ])
})
