// @vitest-environment jsdom
import { Profiler } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AirportLayer } from './renderer'
import type { ProjectedRoute } from './types'

const state = vi.hoisted(() => ({ offset: 0, zoom: 3, listeners: new Map<string, () => void>() }))
vi.mock('./mapcn', () => ({
  Map: () => null,
  MapGeoJSON: () => null,
  useMap: () => ({ map, ready: true, themeRevision: 0 }),
}))
const map = {
  addSource() {},
  addLayer() {},
  removeSource() {},
  removeLayer() {},
  getLayer: () => true,
  getSource: () => ({ setData() {} }),
  setLayoutProperty() {},
  setPaintProperty() {},
  getContainer: () => ({ clientWidth: 400, clientHeight: 300 }),
  getZoom: () => state.zoom,
  project: vi.fn(([x, y]: number[]) => ({ x: x + state.offset, y })),
  on: (event: string, listener: () => void) => state.listeners.set(event, listener),
  off: (event: string) => state.listeners.delete(event),
}
afterEach(() => {
  vi.unstubAllGlobals()
  state.listeners.clear()
})

it('moves visible labels without React commits and still removes colliding labels and skips projection below label zoom', () => {
  state.offset = 0
  state.zoom = 3
  let frame: FrameRequestCallback | undefined
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
    frame = next
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    frame = undefined
  })
  const routes: ProjectedRoute[] = [
    {
      origin: 'AAA',
      destination: 'BBB',
      originCountry: null,
      destinationCountry: null,
      count: 1,
      lastDate: '2026-01-01',
      from: [50, 50],
      to: [150, 50],
    },
  ]
  let commits = 0
  render(
    <Profiler
      id="airports"
      onRender={() => {
        commits++
      }}
    >
      <AirportLayer routes={routes} layer="routes" />
    </Profiler>,
  )
  const flush = () =>
    act(() => {
      const current = frame
      frame = undefined
      current?.(0)
    })
  flush()
  expect(screen.getByText('AAA')).toHaveStyle({ transform: 'translate(33px, 26px)' })
  const initialCommits = commits
  state.offset = 10
  act(() => state.listeners.get('move')?.())
  flush()
  expect(screen.getByText('AAA')).toHaveStyle({ transform: 'translate(43px, 26px)' })
  expect(commits).toBe(initialCommits)
  map.project.mockImplementation(([x, y]) => ({ x: x === 50 ? 50 : 55, y }))
  act(() => state.listeners.get('move')?.())
  flush()
  expect(screen.getByText('AAA')).toBeInTheDocument()
  expect(screen.queryByText('BBB')).not.toBeInTheDocument()
  state.zoom = 2
  map.project.mockClear()
  act(() => state.listeners.get('move')?.())
  flush()
  expect(screen.queryByText('AAA')).not.toBeInTheDocument()
  expect(map.project).not.toHaveBeenCalled()
})
