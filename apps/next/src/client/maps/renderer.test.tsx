// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectedRoute } from './types'

// The renderer is exercised against a stand-in map: no WebGL, only the source/layer calls it makes.
vi.mock('maplibre-gl', () => ({}))
vi.mock('./resolve-color', () => ({ resolveColor: (value: string) => value || 'rgba(0,0,0,0)' }))
const { MapContext } = await import('./mapcn')
const { AirportLayer, FlightRoutes } = await import('./renderer')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function fakeMap() {
  const sources = new Map<string, unknown>()
  const layers = new Map<string, { layout: Record<string, unknown>; paint: Record<string, unknown> }>()
  const map = {
    addSource: vi.fn((id: string, spec: unknown) => { sources.set(id, { ...(spec as object), setData: vi.fn() }) }),
    addLayer: vi.fn((spec: { id: string; paint?: Record<string, unknown> }) => { layers.set(spec.id, { layout: {}, paint: { ...spec.paint } }) }),
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    setLayoutProperty: (id: string, key: string, value: unknown) => { layers.get(id)!.layout[key] = value },
    getLayoutProperty: (id: string, key: string) => layers.get(id)?.layout[key],
    setPaintProperty: (id: string, key: string, value: unknown) => { layers.get(id)!.paint[key] = value },
    setFilter: vi.fn(),
    on: vi.fn(), off: vi.fn(),
    getCanvas: () => document.createElement('canvas'),
    getContainer: () => document.createElement('div'),
    project: ([x, y]: [number, number]) => ({ x, y }),
    getZoom: () => 0,
  }
  return { map, sources, layers }
}

const routes = (count: number): ProjectedRoute[] => Array.from({ length: count }, (_, index) => ({
  origin: `A${index}`, destination: `B${index}`, originCountry: 'US', destinationCountry: 'JP', count: 1 + (index % 12),
  lastDate: '2026-01-01', from: [-100 + (index % 50), 30 + (index % 20)], to: [100 + (index % 40), 10 + (index % 30)],
}))

let root: ReturnType<typeof createRoot> | null = null
afterEach(() => { act(() => root?.unmount()); root = null })

function render(node: React.ReactNode, map: unknown) {
  root = createRoot(document.createElement('div'))
  act(() => root!.render(<MapContext.Provider value={{ map: map as never, ready: true, themeRevision: 0 }}>{node}</MapContext.Provider>))
}

/** The per-route alternative (one source and line + hit layers per route), as the flightcn example draws it. */
function perRouteCounts(list: ProjectedRoute[]) {
  const { map } = fakeMap()
  for (const route of list) {
    const id = `${route.origin}-${route.destination}`
    map.addSource(`route-${id}`, { type: 'geojson', data: {} })
    map.addLayer({ id: `route-${id}-line` })
    map.addLayer({ id: `route-${id}-hit` })
  }
  return { sources: map.addSource.mock.calls.length, layers: map.addLayer.mock.calls.length }
}

describe('batched route rendering', () => {
  it.each([0, 1, 10, 500, 5000])('draws %i routes and their airports with two sources and four layers', count => {
    const { map, sources } = fakeMap()
    const list = routes(count)
    render(<><FlightRoutes routes={list} selected={null} onSelect={() => {}} layer="routes" /><AirportLayer routes={list} layer="routes" /></>, map)
    expect(map.addSource).toHaveBeenCalledTimes(2)
    expect(map.addLayer).toHaveBeenCalledTimes(4)
    const routeSource = sources.get('routes-source') as { data: { features: unknown[] } }
    expect(routeSource.data.features).toHaveLength(count)
    // The per-route alternative grows linearly with the journal: 500 sources and 1000 layers for the same map.
    expect(perRouteCounts(list)).toEqual({ sources: count, layers: count * 2 })
  })

  it('keeps the same sources when routes change, replacing data instead of adding layers', () => {
    const { map, sources } = fakeMap()
    render(<FlightRoutes routes={routes(3)} selected={null} onSelect={() => {}} layer="routes" />, map)
    act(() => root!.render(<MapContext.Provider value={{ map: map as never, ready: true, themeRevision: 0 }}>
      <FlightRoutes routes={routes(40)} selected={null} onSelect={() => {}} layer="routes" />
    </MapContext.Provider>))
    expect(map.addSource).toHaveBeenCalledTimes(1)
    expect((sources.get('routes-source') as { setData: ReturnType<typeof vi.fn> }).setData).toHaveBeenCalled()
  })

  it('hides route layers on the countries layer and weights width by flights on the frequency layer', () => {
    const { map, layers } = fakeMap()
    render(<FlightRoutes routes={routes(5)} selected={null} onSelect={() => {}} layer="countries" />, map)
    expect(layers.get('routes-line')!.layout.visibility).toBe('none')
    act(() => root!.render(<MapContext.Provider value={{ map: map as never, ready: true, themeRevision: 1 }}>
      <FlightRoutes routes={routes(5)} selected="A1-B1" onSelect={() => {}} layer="frequency" />
    </MapContext.Provider>))
    expect(layers.get('routes-line')!.layout.visibility).toBe('visible')
    expect(layers.get('routes-line')!.paint['line-width']).toEqual(expect.arrayContaining(['match']))
    // Selection survives the theme revision: the filter is applied from props, not from paint state.
    expect(map.setFilter).toHaveBeenLastCalledWith('routes-selected', ['==', ['get', 'id'], 'A1-B1'])
  })
})

describe('airport labels', () => {
  it('renders an admitted label at exactly the box the collision gate measured, even at the viewport edge', async () => {
    const { LABEL_SIZE } = await import('./labels')
    const { map } = fakeMap()
    const container = document.createElement('div')
    Object.defineProperties(container, { clientWidth: { value: 400 }, clientHeight: { value: 300 } })
    Object.assign(map, { getZoom: () => 3, getContainer: () => container })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    // The point sits where its label box starts at the top-left corner: (17, 24) → box (0, 0)–(34, 18).
    const edge: ProjectedRoute = { origin: 'EDG', destination: 'FAR', originCountry: 'US', destinationCountry: 'JP', count: 2, lastDate: '2026-01-01', from: [17, 24], to: [200, 150] }
    const host = document.createElement('div')
    root = createRoot(host)
    act(() => root!.render(<MapContext.Provider value={{ map: map as never, ready: true, themeRevision: 0 }}><AirportLayer routes={[edge]} layer="routes" /></MapContext.Provider>))
    const label = [...host.querySelectorAll<HTMLElement>('.route-map-labels span')].find(node => node.textContent === 'EDG')!
    expect(label.style.transform).toBe('translate(0px, 0px)')
    expect([label.style.width, label.style.height, label.style.lineHeight]).toEqual([`${LABEL_SIZE.width}px`, `${LABEL_SIZE.height}px`, `${LABEL_SIZE.height}px`])
    vi.unstubAllGlobals()
  })

  it('adds no second offset or box in the stylesheet', async () => {
    const [{ readFileSync }, { URL: NodeURL, fileURLToPath }] = await Promise.all([import('node:fs'), import('node:url')])
    const css = readFileSync(fileURLToPath(new NodeURL('./map.css', import.meta.url)), 'utf8')
    const rule = /\.route-map-labels span\s*\{([^}]*)\}/.exec(css)![1]
    expect(rule).not.toMatch(/margin|padding|(?:^|[;\s])(?:border|width|height|line-height)\s*:/)
  })
})
