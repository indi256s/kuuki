// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { useEffect, useImperativeHandle, type ReactNode, type RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WORLD_BOUNDS } from '../../maps/geometry'
import AtlasMap, { ATLAS_LAYERS } from './map'

type Layer = { id: string; paint?: Record<string, unknown>; filter?: unknown }
type Source = {
  data: GeoJSON.FeatureCollection
  setData: (data: GeoJSON.FeatureCollection) => void
}
const state = vi.hoisted(() => ({
  layers: [] as Layer[],
  sources: new Map<string, Source>(),
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
// The sticker's own behaviour is sticker.test.tsx; here it only records what the map routes to it.
const sticker = vi.hoisted(() => ({
  lift: vi.fn(),
  finish: vi.fn(),
  open: false,
  /** The country the sticker reports as on screen. */
  active: null as string | null,
}))
vi.mock('./sticker', () => ({
  Sticker: ({
    control,
    onActive,
  }: {
    control: RefObject<unknown>
    onActive: (code: string | null) => void
  }) => {
    useImperativeHandle(control, () => ({
      lift: sticker.lift,
      finish: sticker.finish,
      dismiss: () => sticker.open,
    }))
    useEffect(() => onActive(sticker.active), [onActive])
    return null
  },
}))
vi.mock('../../maps/resolve-color', () => ({ resolveColor: (value: string) => `c(${value})` }))
const map = {
  addSource: (id: string, source: { data: GeoJSON.FeatureCollection }) =>
    state.sources.set(id, {
      ...source,
      setData(data) {
        this.data = data
      },
    } as Source),
  setFontFaces: vi.fn(),
  keyboard: { disableRotation: vi.fn() },
  isMoving: () => false,
  addLayer: (layer: Layer) => state.layers.push(layer),
  getLayer: (id: string) => state.layers.find((layer) => layer.id === id),
  removeLayer: vi.fn(),
  removeSource: vi.fn(),
  getSource: (id: string) => state.sources.get(id),
  setPaintProperty: (layer: string, property: string, value: unknown) =>
    state.paint.push([layer, property, value]),
  setFilter: vi.fn(),
  setFeatureState: vi.fn(),
  setLayoutProperty: vi.fn(),
  fitBounds: vi.fn(),
  setRenderWorldCopies: vi.fn(),
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
  sticker.lift.mockReset()
  sticker.finish.mockReset()
  sticker.open = false
  sticker.active = null
  map.fitBounds.mockClear()
  map.setFilter.mockClear()
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => geometry }))
  // The tokens resolve to their own names, so a test can tell which one a paint uses.
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (name: string) => name }))
})
afterEach(() => vi.unstubAllGlobals())

const codesIn = (expression: unknown) =>
  Array.isArray(expression) && expression[0] === 'match'
    ? expression.filter(
        (part): part is string[] =>
          Array.isArray(part) && typeof part[0] === 'string' && part !== expression[1],
      )
    : []
/** The colour a `match` assigns to one code ('land' when no branch names it). */
const colorOf = (expression: unknown, code: string) => {
  const parts = expression as unknown[]
  for (let i = 2; i < parts.length - 1; i += 2)
    if ((parts[i] as string[]).includes(code)) return parts[i + 1]
  return parts.at(-1)
}
const fill = () =>
  state.paint
    .filter(([layer, property]) => layer === ATLAS_LAYERS.fill && property === 'fill-color')
    .at(-1)![2]
/** Visited countries as the atlas receives them: code → visit count. */
const visited = (codes: string[], count = 1) => new Map(codes.map((code) => [code, count]))
const mount = async (entries: string[], pending: string[], onSelectCountry = vi.fn()) => {
  const view = render(
    <AtlasMap
      locale="en"
      entries={visited(entries)}
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
  entries: visited(entries),
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
  expect(map.setFilter).toHaveBeenCalledWith(ATLAS_LAYERS.pending, [
    'in',
    ['get', 'id'],
    ['literal', ['JP']],
  ])
})

it('fills visits 1, 2–3, 4–9 and 10+ with the four atlas visit tokens', async () => {
  render(
    <AtlasMap
      {...props([], [])}
      entries={
        new Map([
          ['FR', 1],
          ['DE', 3],
          ['JP', 9],
          ['MC', 10],
        ])
      }
    />,
  )
  await act(async () => {})
  const expression = fill()
  expect(['FR', 'DE', 'JP', 'MC'].map((code) => colorOf(expression, code))).toEqual([
    'c(--atlas-visit-1)',
    'c(--atlas-visit-2)',
    'c(--atlas-visit-3)',
    'c(--atlas-visit-4)',
  ])
  expect(colorOf(expression, 'US')).toBe('c(--map-land)')
})

it('opens on the member countries, or on the world without any', async () => {
  await mount(['FR'], [])
  // 800 × 500 canvas: a tenth of the short side is 50px of padding.
  expect(map.fitBounds).toHaveBeenCalledTimes(1)
  expect(map.fitBounds).toHaveBeenCalledWith(
    [
      [0, 0],
      [1, 1],
    ],
    { padding: 50, maxZoom: 4.5, duration: 0 },
  )
  cleanup()
  map.fitBounds.mockClear()
  await mount([], [])
  expect(map.fitBounds).toHaveBeenCalledWith(WORLD_BOUNDS, { padding: 16, duration: 0 })
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

describe('owner stickers', () => {
  const quick = (peelable: string[]) => ({
    ownerId: 'owner',
    peelable: (code: string) => peelable.includes(code),
    record: vi.fn(),
    recording: new Set<string>(),
  })
  const tap = (id: string) => {
    state.hit = id
    state.listeners.get('click')?.({ point: { x: 1, y: 1 } })
  }

  it('lifts a peelable polygon and sends every other tap to the sheet', async () => {
    const onSelectCountry = vi.fn()
    render(
      <AtlasMap
        {...props(['FR'], ['JP'])}
        onSelectCountry={onSelectCountry}
        quickVisit={quick(['DE', 'MC'])}
      />,
    )
    await act(async () => {})
    tap('DE')
    expect(sticker.lift).toHaveBeenCalledWith('DE')
    // Visited, pending and hidden countries are not peelable; a microstate marker never lifts, even when unrecorded.
    for (const code of ['FR', 'JP', 'MC']) tap(code)
    expect(onSelectCountry.mock.calls).toEqual([['FR'], ['JP'], ['MC']])
    expect(sticker.lift).toHaveBeenCalledTimes(1)
  })

  it('closes a lifted sticker on another tap without opening the sheet', async () => {
    const onSelectCountry = vi.fn()
    render(
      <AtlasMap {...props(['FR'], [])} onSelectCountry={onSelectCountry} quickVisit={quick([])} />,
    )
    await act(async () => {})
    sticker.open = true
    tap('FR')
    expect(onSelectCountry).not.toHaveBeenCalled()
    expect(sticker.finish).toHaveBeenCalled()
  })

  it('opens the sheet for every country without a quick visit (visitors, preview, filtered views)', async () => {
    const { onSelectCountry } = await mount(['FR'], [])
    tap('DE')
    expect(onSelectCountry).toHaveBeenCalledWith('DE')
    expect(sticker.lift).not.toHaveBeenCalled()
  })
})

describe('labels', () => {
  const quick = () => ({
    ownerId: 'owner',
    peelable: () => true,
    record: vi.fn(),
    recording: new Set<string>(),
  })
  const filterOf = (layer: string) =>
    JSON.stringify(map.setFilter.mock.calls.filter(([id]) => id === layer).at(-1)?.[1])

  it('keeps the lifted country out of the always-on labels while its sticker prints the name', async () => {
    sticker.active = 'DE'
    render(<AtlasMap {...props(['FR'], [])} quickVisit={quick()} />)
    await act(async () => {})
    expect(filterOf(ATLAS_LAYERS.labels)).toContain('["!=",["get","id"],"DE"]')
    expect(filterOf(ATLAS_LAYERS.labels)).toContain('["FR"]')
  })
})
