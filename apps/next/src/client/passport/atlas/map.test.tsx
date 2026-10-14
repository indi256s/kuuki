// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AtlasMap, { ATLAS_LAYERS } from './map'

type Layer = { id: string; paint?: Record<string, unknown>; filter?: unknown }
const state = vi.hoisted(() => ({
  layers: [] as Layer[],
  sources: new Map<string, { data: GeoJSON.FeatureCollection }>(),
  paint: [] as [string, string, unknown][],
  listeners: new Map<string, (event: unknown) => void>(),
  hit: undefined as string | undefined,
  /** Overlapping marker targets, in the renderer's order. */
  hits: [] as string[],
}))
vi.mock('../../maps/mapcn', () => ({
  Map: ({ children }: { children: ReactNode }) => children,
  useMap: () => ({ map, ready: true, themeRevision: 0 }),
}))
vi.mock('../../maps/resolve-color', () => ({ resolveColor: (value: string) => `c(${value})` }))
const map = {
  addSource: (id: string, source: { data: GeoJSON.FeatureCollection }) =>
    state.sources.set(id, source),
  addLayer: (layer: Layer) => state.layers.push(layer),
  getLayer: (id: string) => state.layers.find((layer) => layer.id === id),
  removeLayer: vi.fn(),
  removeSource: vi.fn(),
  getSource: (id: string) => state.sources.get(id),
  setPaintProperty: (layer: string, property: string, value: unknown) =>
    state.paint.push([layer, property, value]),
  setFilter: vi.fn(),
  setLayoutProperty: vi.fn(),
  fitBounds: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  getZoom: () => 1,
  getContainer: () => ({ clientWidth: 800, clientHeight: 500 }),
  getCanvas: () => ({ style: {} }),
  project: ([lon, lat]: [number, number]) => ({ x: lon * 10, y: lat * 10 }),
  queryRenderedFeatures: () =>
    state.hits.length
      ? state.hits.map((id) => ({ properties: { id } }))
      : state.hit
        ? [{ properties: { id: state.hit } }]
        : [],
  on: (event: string, listener: (event: unknown) => void) => state.listeners.set(event, listener),
  off: (event: string) => state.listeners.delete(event),
}
const geometry: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: ['FR', 'DE', 'JP'].map((id) => ({
    type: 'Feature',
    properties: { id, name: id },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  })),
}
beforeEach(() => {
  state.layers.length = 0
  state.sources.clear()
  state.paint.length = 0
  state.listeners.clear()
  state.hit = undefined
  state.hits = []
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => geometry }))
})
afterEach(() => vi.unstubAllGlobals())

const codesIn = (expression: unknown) =>
  Array.isArray(expression) && expression[0] === 'match'
    ? expression.filter(
        (part): part is string[] =>
          Array.isArray(part) && typeof part[0] === 'string' && part !== expression[1],
      )
    : []
const fill = () =>
  state.layers.find((layer) => layer.id === ATLAS_LAYERS.fill)!.paint!['fill-color']
const mount = async (entries: string[], pending: string[], onSelectCountry = vi.fn()) => {
  const view = render(
    <AtlasMap
      locale="en"
      entries={entries}
      pending={pending}
      name={(c) => c}
      onSelectCountry={onSelectCountry}
      fail={vi.fn()}
    />,
  )
  await act(async () => {})
  return { ...view, onSelectCountry }
}
const props = (entries: string[], pending: string[]) => ({
  locale: 'en' as const,
  entries,
  pending,
  name: (c: string) => c,
  onSelectCountry: vi.fn(),
  fail: vi.fn(),
})

it('fills exactly the visited codes and follows entry changes; pending styling needs pending countries', async () => {
  const { rerender } = await mount(['FR', 'JP'], [])
  expect(codesIn(fill())).toEqual([['FR', 'JP']])
  expect(state.layers.find((layer) => layer.id === ATLAS_LAYERS.pending)).toMatchObject({
    layout: { visibility: 'none' },
  })
  rerender(<AtlasMap {...props(['DE'], ['JP'])} />)
  await act(async () => {})
  const updated = state.paint.filter(([layer]) => layer === ATLAS_LAYERS.fill).at(-1)![2]
  expect(codesIn(updated)).toEqual([['DE'], ['JP']])
  expect(map.setFilter).toHaveBeenLastCalledWith(ATLAS_LAYERS.pending, [
    'in',
    ['get', 'id'],
    ['literal', ['JP']],
  ])
})

it('puts small states without polygons in the label-point layer', async () => {
  await mount([], [])
  const points = state.sources.get('atlas-points')!.data
  expect(points.features.map((feature) => feature.properties?.id)).toContain('MC')
})

it('selects the ISO2 code on a polygon or marker click, and ignores unknown ids', async () => {
  const { onSelectCountry } = await mount(['FR'], [])
  state.hit = 'DE'
  state.listeners.get('click')?.({ point: { x: 1, y: 1 } })
  state.hit = 'MC'
  state.listeners.get('click')?.({ point: { x: 1, y: 1 } })
  state.hit = '-99'
  state.listeners.get('click')?.({ point: { x: 1, y: 1 } })
  expect(onSelectCountry.mock.calls).toEqual([['DE'], ['MC']])
})

it('picks the nearest of overlapping small-state markers', async () => {
  const { onSelectCountry } = await mount([], [])
  // Monaco is listed first, but the pointer sits on San Marino (lon 12.44 → x 124 in the stand-in projection).
  state.hits = ['MC', 'SM']
  state.listeners.get('click')?.({ point: { x: 124, y: 439 } })
  expect(onSelectCountry).toHaveBeenLastCalledWith('SM')
})
