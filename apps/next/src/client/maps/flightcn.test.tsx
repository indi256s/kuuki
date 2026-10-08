// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Map as LibreMap } from 'maplibre-gl'
import { MapContext } from './mapcn'
import { FlightPlane, interpolatePosition, unwrapArcCoordinates } from './flightcn'
import { routeGeometry } from './geometry'
const state = vi.hoisted(() => ({ markers: [] as Array<{ options: Record<string, unknown>; setLngLat: ReturnType<typeof vi.fn>; setRotation: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }> }))
vi.mock('maplibre-gl', () => ({ Marker: class {
  setLngLat = vi.fn(() => this); setRotation = vi.fn(() => this); remove = vi.fn(); addTo() { return this }
  constructor(public options: Record<string, unknown>) { state.markers.push(this) }
} }))
afterEach(() => { state.markers = [] })
it('controlled plane crosses the seam continuously, rotates with paused camera, hides behind globe and cleans ownership', () => {
  const listeners = new Map<string, Set<() => void>>()
  let rotated = false
  const map = { project: ([lng, lat]: [number, number]) => rotated ? { x: lat, y: lng } : { x: lng, y: -lat },
    on(event: string, callback: () => void) { const set = listeners.get(event) ?? new Set(); set.add(callback); listeners.set(event, set) },
    off(event: string, callback: () => void) { listeners.get(event)?.delete(callback) } }
  const from: [number, number] = [170, 10], to: [number, number] = [-170, 10]
  const scene = (progress: number) => <MapContext.Provider value={{ map: map as unknown as LibreMap, ready: true, themeRevision: 0 }}><FlightPlane from={from} to={to} progress={progress} color="var(--mark-1)" /></MapContext.Provider>
  const { rerender, unmount } = render(scene(.5))
  const marker = state.markers[0]
  expect(Math.abs(marker.setLngLat.mock.lastCall![0][0])).toBeGreaterThan(179)
  const heading = marker.setRotation.mock.lastCall![0]
  rotated = true; act(() => listeners.get('move')?.forEach(callback => callback()))
  expect(marker.setRotation.mock.lastCall![0]).not.toBeCloseTo(heading)
  expect(marker.options).toMatchObject({ rotationAlignment: 'viewport', opacityWhenCovered: 0 })
  rerender(scene(1)); expect(marker.setLngLat.mock.lastCall![0]).toEqual(to)
  expect(marker.setRotation.mock.lastCall![0]).toBeTypeOf('number')
  unmount(); expect(marker.remove).toHaveBeenCalledTimes(1)
  expect([...listeners.values()].every(set => set.size === 0)).toBe(true)
})
it('distance weighted interpolation skips duplicate seam vertices and undefined routes do not create planes', () => {
  const geometry = routeGeometry({ from: [170, 10], to: [-170, 10] })!
  const path = unwrapArcCoordinates(geometry)
  for (let index = 1; index < path.length; index++) expect(Math.abs(path[index][0] - path[index - 1][0])).toBeLessThan(180)
  expect(interpolatePosition([[0, 0], [1, 0], [1, 0], [10, 0]], .5)[0]).toBeCloseTo(5)
  render(<MapContext.Provider value={{ map: {} as LibreMap, ready: true, themeRevision: 0 }}><FlightPlane from={[0, 0]} to={[0, 0]} progress={.5} color="var(--mark-1)" /></MapContext.Provider>)
  expect(state.markers).toHaveLength(0)
})
