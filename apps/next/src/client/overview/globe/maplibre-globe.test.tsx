// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any -- Minimal MapLibre stand-in for lifecycle tests. */
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { MaplibreGlobeProps } from './maplibre-globe'
import { MaplibreGlobe } from './maplibre-globe'
import { createUIBus } from '../store/ui-bus'
import { Map as MapCanvas } from '../../maps/mapcn'
import { readFileSync } from 'node:fs'
const state = vi.hoisted(() => ({ instances: [] as Array<Record<string, any>> }))
vi.mock('../../maps/resolve-color', () => ({ resolveColor: (value: string) => value || 'transparent' }))
vi.mock('maplibre-gl', () => ({ setWorkerUrl: vi.fn(), Map: class {
  options: unknown; canvas = document.createElement('canvas'); removed = false
  listeners = new Map<string, Set<(...args: any[]) => void>>(); sources = new Map<string, any>(); layers = new Map<string, any>(); images = new Map()
  flyTo = vi.fn(); jumpTo = vi.fn(); setFeatureState = vi.fn(); setPaintProperty = vi.fn(); queryRenderedFeatures = vi.fn(() => [])
  handler = () => ({ enable: vi.fn(), disable: vi.fn(), enableRotation: vi.fn(), disableRotation: vi.fn() })
  cooperativeGestures = this.handler(); scrollZoom = this.handler(); dragRotate = this.handler(); touchZoomRotate = this.handler(); touchPitch = this.handler(); dragPan = this.handler()
  constructor(options: unknown) { this.options = options; state.instances.push(this) }
  on(event: string, callback: (...args: any[]) => void) { const set = this.listeners.get(event) ?? new Set(); set.add(callback); this.listeners.set(event, set); return this }
  off(event: string, callback: (...args: any[]) => void) { this.listeners.get(event)?.delete(callback); return this }
  once(event: string, callback: (...args: any[]) => void) { const once = (...args: any[]) => { this.off(event, once); callback(...args) }; this.on(event, once); return this }
  emit(event: string, data?: unknown) { this.listeners.get(event)?.forEach(callback => callback(data)) }
  getStyle() { return this.removed ? undefined : { version: 8 } }
  getCanvas() { return this.canvas } loaded() { return true } remove() { this.removed = true; this.listeners.clear() }
  getCenter() { return { lng: 0, lat: 0 } }
  addSource(id: string, source: any) { this.sources.set(id, { ...source, setData: vi.fn() }) }
  getSource(id: string) { return this.sources.get(id) } removeSource(id: string) { this.sources.delete(id) }
  addLayer(layer: any) { this.layers.set(layer.id, layer) } getLayer(id: string) { return this.layers.get(id) } removeLayer(id: string) { this.layers.delete(id) }
  hasImage(id: string) { return this.images.has(id) } addImage(id: string, image: unknown) { this.images.set(id, image) } updateImage = this.addImage; removeImage(id: string) { this.images.delete(id) }
} }))
vi.mock('../../maps/flightcn', async original => ({ ...await original<typeof import('../../maps/flightcn')>(), FlightPlane: () => null }))
const atlas = JSON.parse(readFileSync('public/maps/countries-110m-2.0.2.geojson', 'utf8'))
const globe = { routes: [{ key: 'AAA-BBB', a: 'AAA', b: 'BBB', count: 11 }], ghostRoutes: [], countries: [{ code: 'SG', visits: 3 }], ghostCountries: ['US'], airports: [], ghosts: [{ id: 47, origin: 'AAA', destination: 'BBB', date: '2027-01-01' }], centroid: { lon: 20, lat: 30 } }
const props = (): MaplibreGlobeProps => ({ globe, all: globe, airports: { AAA: { lat: 10, lon: 20, name: 'AAA', country: null, city: null }, BBB: { lat: 30, lon: 60, name: 'BBB', country: null, city: null } },
  filter: {}, locale: 'en', fullscreen: false, active: true, reduced: false, bus: createUIBus(), isCurrent: () => true, onScope: vi.fn(),
  routeDistances: new Map([['AAA-BBB', 1791]]), replay: { arcs: new Set(), planes: [], timeMs: 0 }, timeline: [], absoluteMs: 0,
  nightDate: new Date('2026-06-21T12:00:00Z'), onReady: vi.fn(), onError: vi.fn() })
beforeEach(() => {
  state.instances = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type: string) => type === 'webgl2' ? {} : { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, getImageData: () => ({ width: 8, height: 8, data: new Uint8ClampedArray(256) }) } as any)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => atlas })))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('projection is in globe style only; flat default and rotation stay preserved', () => {
  const { unmount } = render(<MapCanvas onError={vi.fn()}><span /></MapCanvas>)
  expect(state.instances[0].options.style.projection).toBeUndefined()
  expect(state.instances[0].touchZoomRotate.disableRotation).toHaveBeenCalled()
  unmount(); render(<MaplibreGlobe {...props()} />)
  expect(state.instances[1].options.style.projection).toEqual({ type: 'globe' })
  expect(state.instances[1].options.projection).toBeUndefined()
})
it('application layers must exist before idle fade; filter camera flies 600ms or cuts; actual ghost hover and scope action work', async () => {
  const p = props(), { rerender, unmount } = render(<MaplibreGlobe {...p} />)
  const map = state.instances[0]
  act(() => map.emit('idle')); expect(p.onReady).not.toHaveBeenCalled()
  act(() => map.emit('load'))
  await waitFor(() => expect(map.getSource('globe-countries')).toBeTruthy())
  act(() => map.emit('idle')); expect(p.onReady).toHaveBeenCalledTimes(1)
  expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: [20, 30], duration: 600 }))
  expect(map.getSource('globe-microstates').setData.mock.lastCall[0].features[0].geometry.coordinates).toEqual([103.813465, 1.358924])
  act(() => p.bus.setHoverGhost(47))
  expect(map.setPaintProperty).toHaveBeenCalledWith('globe-upcoming', 'line-opacity', ['case', ['==', ['get', 'id'], 47], .8, .15])
  act(() => p.bus.setFocusRoute('AAA-BBB'))
  expect(map.flyTo.mock.lastCall[0].center[0]).toBeGreaterThan(20)
  rerender(<MaplibreGlobe {...p} globe={{ ...globe, centroid: { lon: -10, lat: 40 } }} filter={{ countries: ['US'] }} reduced />)
  expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [-10, 40] })
  expect(map.scrollZoom.disable).toHaveBeenCalled()
  unmount(); expect(map.removed).toBe(true)
})
it('unmounted fetch cannot admit stale country sources or readiness', async () => {
  let resolve!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done })))
  const p = props(), { unmount } = render(<MaplibreGlobe {...p} />), map = state.instances[0]
  act(() => map.emit('load')); unmount()
  await act(async () => resolve({ ok: true, json: async () => atlas }))
  expect(map.sources.size).toBe(0); expect(p.onReady).not.toHaveBeenCalled()
})
