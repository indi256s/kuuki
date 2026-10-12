// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { GlobeData } from '@kuuki/shared/overview/globe'
import * as geometry from '../../maps/geometry'
import { createUIBus } from '../store/ui-bus'
import { createReplaySchedule } from './replay'
import { MaplibreGlobe, type MaplibreGlobeProps } from './maplibre-globe'

vi.mock('../../maps/mapcn', () => ({
  Map: ({ children }: { children: ReactNode }) => children,
  useMap: () => ({ map: null, ready: false, themeRevision: 0 }),
}))
afterEach(() => vi.restoreAllMocks())

it('reuses flown and upcoming great circles across filters and refreshes changed airport coordinates', () => {
  const calculate = vi.spyOn(geometry, 'routeGeometry')
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
  const props: MaplibreGlobeProps = {
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
