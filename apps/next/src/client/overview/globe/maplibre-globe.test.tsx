// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Map as LibreMap } from 'maplibre-gl'
import type { GlobeData } from '@kuuki/shared/overview/globe'
import { useMap } from '../../maps/mapcn'
import { createUIBus } from '../store/ui-bus'
import { createReplaySchedule } from './replay'
import { MaplibreGlobe, type MaplibreGlobeProps } from './maplibre-globe'
import * as atlas from './atlas'

vi.mock('../../maps/mapcn', () => ({
  Map: ({ children }: { children: ReactNode }) => children,
  useMap: vi.fn(() => ({ map: null, ready: false, themeRevision: 0 })),
}))
vi.mock('./gestures', () => ({ attachGlobeGestures: vi.fn() }))
vi.mock('../../maps/flightcn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../maps/flightcn')>()),
  FlightPlane: ({ from, to }: { from: [number, number]; to: [number, number] }) => (
    <span data-testid="plane">{`${from.join(',')} → ${to.join(',')}`}</span>
  ),
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.mocked(useMap).mockReturnValue({ map: null, ready: false, themeRevision: 0 })
})

function makeProps(): MaplibreGlobeProps {
  const all: GlobeData = {
    routes: [{ key: 'CDG-LHR', a: 'CDG', b: 'LHR', count: 12 }],
    ghosts: [{ id: 2, origin: 'LHR', destination: 'CDG', date: '2027-01-01' }],
    airports: [
      { iata: 'LHR', count: 12 },
      { iata: 'CDG', count: 12 },
    ],
    countries: [],
    ghostCountries: [],
    ghostRoutes: [],
    ground: [],
    centroid: null,
  }
  return {
    globe: all,
    all,
    airports: {
      LHR: { lat: 51.47, lon: -0.454, country: 'GB', city: 'London', name: 'Heathrow' },
      CDG: { lat: 49.01, lon: 2.55, country: 'FR', city: 'Paris', name: 'Charles de Gaulle' },
    },
    filter: {},
    locale: 'en',
    fullscreen: false,
    active: false,
    reduced: true,
    bus: createUIBus(),
    isCurrent: () => true,
    onScope: vi.fn(),
    routeDistances: new Map(),
    timeline: [],
    replay: {
      ...createReplaySchedule([], 12000).advance(0),
      seek: vi.fn(),
      getFrame: () => createReplaySchedule([], 12000).advance(0),
      subscribe: () => () => {},
    },
    onReady: vi.fn(),
    onError: vi.fn(),
  }
}

it('keeps the whole globe inside the viewport on mount, filtering, resize and fullscreen', () => {
  const container = { clientWidth: 358, clientHeight: 358 }
  const fieldOfView = 36.86989764584402
  let latitude = 45
  let zoom = 0
  let resize: (() => void) | undefined
  const move = (camera: { center?: [number, number]; zoom: number }) => {
    latitude = camera.center?.[1] ?? latitude
    zoom = camera.zoom
  }
  const map = {
    getContainer: () => container,
    getVerticalFieldOfView: () => fieldOfView,
    getCenter: () => ({ lat: latitude }),
    setMaxZoom: vi.fn(),
    setMinZoom: vi.fn(),
    jumpTo: move,
    flyTo: move,
    on: (_event: string, handler: () => void) => {
      resize = handler
    },
    off: vi.fn(),
  }
  vi.mocked(useMap).mockReturnValue({
    map: map as unknown as LibreMap,
    ready: true,
    themeRevision: 0,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const props = { ...makeProps(), active: true }
  const { rerender, unmount } = render(<MaplibreGlobe {...props} />)
  const expectContained = () => {
    const radius = (512 * 2 ** zoom) / (2 * Math.PI * Math.cos((latitude * Math.PI) / 180))
    const distance = container.clientHeight / (2 * Math.tan((fieldOfView * Math.PI) / 360))
    const apparentRadius = (distance * radius) / Math.sqrt((distance + radius) ** 2 - radius ** 2)
    expect(apparentRadius).toBeCloseTo(
      Math.min(container.clientWidth, container.clientHeight) / 2 - 16,
      8,
    )
  }
  expectContained()
  rerender(
    <MaplibreGlobe
      {...props}
      filter={{ countries: ['GB'] }}
      globe={{ ...props.globe, centroid: { lat: 70, lon: 0 } }}
      reduced={false}
    />,
  )
  expectContained()
  container.clientWidth = 960
  container.clientHeight = 520
  act(() => resize?.())
  expectContained()
  container.clientWidth = 390
  container.clientHeight = 844
  rerender(<MaplibreGlobe {...props} fullscreen />)
  expectContained()
  unmount()
})

it('keeps idle routes free of aircraft and follows only the focused route, including reduced motion', async () => {
  vi.mocked(useMap).mockReturnValue({ map: null, ready: true, themeRevision: 0 })
  vi.spyOn(atlas, 'isLand').mockReturnValue(true)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })),
  )
  const props = { ...makeProps(), active: true }
  props.globe.routes.push({ key: 'CDG-JFK', a: 'CDG', b: 'JFK', count: 1 })
  props.airports.JFK = { lat: 40.64, lon: -73.78, country: 'US', city: 'New York', name: 'JFK' }
  let rerender!: ReturnType<typeof render>['rerender']
  await act(async () => {
    ;({ rerender } = render(<MaplibreGlobe {...props} />))
  })
  expect(screen.queryAllByTestId('plane')).toHaveLength(0)
  act(() => props.bus.setFocusRoute('CDG-LHR'))
  expect(screen.getAllByTestId('plane')).toHaveLength(1)
  expect(screen.getByTestId('plane')).toHaveTextContent('2.55,49.01 → -0.454,51.47')
  act(() => props.bus.setFocusRoute('CDG-JFK'))
  expect(screen.getAllByTestId('plane')).toHaveLength(1)
  expect(screen.getByTestId('plane')).toHaveTextContent('2.55,49.01 → -73.78,40.64')
  rerender(<MaplibreGlobe {...props} reduced={false} />)
  expect(screen.getAllByTestId('plane')).toHaveLength(1)
  act(() => props.bus.setFocusRoute(null))
  expect(screen.queryAllByTestId('plane')).toHaveLength(0)
})

it('releases a removed route selection so the current focused route keeps its aircraft', async () => {
  const listeners = new Map<string, (event: { point: { x: number; y: number } }) => void>()
  const map = {
    addSource() {},
    setFontFaces() {},
    addLayer() {},
    getSource: () => ({ setData() {} }),
    getLayer: () => true,
    getStyle: () => ({ layers: [] }),
    hasImage: () => false,
    setPaintProperty() {},
    removeLayer() {},
    removeSource() {},
    loaded: () => true,
    once() {},
    on: (event: string, listener: (event: { point: { x: number; y: number } }) => void) =>
      listeners.set(event, listener),
    off: (event: string) => listeners.delete(event),
    getContainer: () => ({ clientWidth: 358, clientHeight: 358 }),
    getVerticalFieldOfView: () => 36.86989764584402,
    getCenter: () => ({ lat: 0 }),
    setMaxZoom() {},
    setMinZoom() {},
    jumpTo() {},
    queryRenderedFeatures: () => [{ properties: { key: 'CDG-LHR' } }],
  }
  vi.mocked(useMap).mockReturnValue({
    map: map as unknown as LibreMap,
    ready: true,
    themeRevision: 0,
  })
  vi.spyOn(atlas, 'isLand').mockReturnValue(true)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })),
  )
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const props = { ...makeProps(), active: true }
  const remaining = { key: 'CDG-JFK', a: 'CDG', b: 'JFK', count: 1 }
  props.globe.routes.push(remaining)
  props.airports.JFK = { lat: 40.64, lon: -73.78, country: 'US', city: 'New York', name: 'JFK' }
  let rerender!: ReturnType<typeof render>['rerender']
  await act(async () => {
    ;({ rerender } = render(<MaplibreGlobe {...props} />))
  })
  act(() => listeners.get('click')?.({ point: { x: 50, y: 50 } }))
  expect(screen.getByRole('dialog', { name: 'CDG–LHR' })).toBeInTheDocument()
  expect(screen.getByTestId('plane')).toHaveTextContent('2.55,49.01 → -0.454,51.47')
  act(() => props.bus.setFocusRoute('CDG-JFK'))
  rerender(<MaplibreGlobe {...props} globe={{ ...props.globe, routes: [remaining] }} />)
  expect(screen.queryByRole('dialog', { name: 'CDG–LHR' })).not.toBeInTheDocument()
  expect(screen.getByTestId('plane')).toHaveTextContent('2.55,49.01 → -73.78,40.64')
})
