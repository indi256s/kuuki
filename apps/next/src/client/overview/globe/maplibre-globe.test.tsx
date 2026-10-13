// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Map as LibreMap } from 'maplibre-gl'
import type { GlobeData } from '@kuuki/shared/overview/globe'
import * as geometry from '../../maps/geometry'
import { useMap } from '../../maps/mapcn'
import { createUIBus } from '../store/ui-bus'
import { createReplaySchedule } from './replay'
import { MaplibreGlobe, type MaplibreGlobeProps } from './maplibre-globe'

vi.mock('../../maps/mapcn', () => ({
  Map: ({ children }: { children: ReactNode }) => children,
  useMap: vi.fn(() => ({ map: null, ready: false, themeRevision: 0 })),
}))
vi.mock('./gestures', () => ({ attachGlobeGestures: vi.fn() }))
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

it('reuses flown and upcoming great circles across filters and refreshes changed airport coordinates', () => {
  const calculate = vi.spyOn(geometry, 'routeGeometry')
  const props = makeProps()
  const all = props.all
  const { rerender } = render(<MaplibreGlobe {...props} />)
  expect(calculate).toHaveBeenCalledTimes(2)
  expect(calculate.mock.results.every(({ value }) => value !== null)).toBe(true)
  rerender(
    <MaplibreGlobe
      {...props}
      filter={{ routes: ['CDG-LHR'] }}
      globe={{ ...all, routes: [{ ...all.routes[0], count: 1 }] }}
    />,
  )
  rerender(
    <MaplibreGlobe
      {...props}
      filter={{ routes: [] }}
      globe={{ ...all, routes: [], airports: [] }}
    />,
  )
  expect(calculate).toHaveBeenCalledTimes(2)
  rerender(
    <MaplibreGlobe
      {...props}
      airports={{ ...props.airports, LHR: { ...props.airports.LHR, lon: -0.5 } }}
    />,
  )
  expect(calculate).toHaveBeenCalledTimes(4)
  expect(calculate).toHaveBeenLastCalledWith({ from: [-0.5, 51.47], to: [2.55, 49.01] })
})

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
