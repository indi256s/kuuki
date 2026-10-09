'use client'

import type { Map as LibreMap, MapMouseEvent, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { coordinates } from '@kuuki/shared/geo'
import { routeKey } from '@kuuki/shared/overview/filter'
import type { GlobeData } from '@kuuki/shared/overview/globe'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { BUCKET_TOKENS, visitBucket } from '../../../lib/map-buckets'
import type { Locale } from '../../../lib/format'
import { Map as MapCanvas, useMap } from '../../maps/mapcn'
import { routeGeometry } from '../../maps/geometry'
import { FlightPlane, interpolatePosition, unwrapArcCoordinates } from '../../maps/flightcn'
import { resolveColor } from '../../maps/resolve-color'
import { attachGlobeGestures } from './gestures'
import { nightPolygon } from './night'
import { RouteCard, type GlobeRouteCard } from './route-card'
import { PLANE_MS, type ReplayPlane, type TimelineItem } from './replay'
import type { createUIBus } from '../store/ui-bus'
import { isLand, type GlobeLand } from './atlas'
import { GLOBE_ZOOM_RANGE, globeZoom } from './camera'

export type MaplibreGlobeProps = {
  globe: GlobeData; all: GlobeData; airports: OverviewPayload['refs']['airports']; filter: OverviewFilter
  locale: Locale; fullscreen: boolean; active: boolean; reduced: boolean; bus: ReturnType<typeof createUIBus>
  isCurrent: () => boolean; onScope: (key: string) => void; routeDistances: ReadonlyMap<string, number | null>
  replay: { planes: ReplayPlane[]; arcs: Set<string>; timeMs: number }; timeline: TimelineItem[]
  absoluteMs: number; nightDate: Date; onReady: () => void; onError: () => void
}
const token = (name: string) => resolveColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim())
const empty = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] })
// Approximate Natural Earth 10m admin-0 label points (5.1.0), not capitals/centroids.
// https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_label_points.geojson
const MICROSTATES: Record<string, [number, number]> = {
  MC: [7.398449, 43.746141], VA: [12.453364, 41.903327], SM: [12.442237, 43.936454],
  LI: [9.540900, 47.138206], AD: [1.560756, 42.541327], SG: [103.813465, 1.358924],
}
const sources = ['globe-countries', 'globe-routes', 'globe-airports', 'globe-microstates', 'globe-night']
const layers = ['globe-land', 'globe-ghost-countries', 'globe-route-lines', 'globe-upcoming', 'globe-airport-dots', 'globe-microstate-dots', 'globe-night-fill']

function GlobeLayers({ props, host, select }: { props: MaplibreGlobeProps; host: RefObject<HTMLDivElement | null>; select: (route: GlobeRouteCard | null) => void }) {
  const { map, ready, themeRevision } = useMap()
  const [land, setLand] = useState<GlobeLand | null>(null)
  const latest = useRef(props)
  useEffect(() => { latest.current = props }, [props])
  const selection = useRef(select)
  useEffect(() => { selection.current = select }, [select])
  const point = (iata: string): [number, number] | null => {
    const ref = coordinates(props.airports[iata]); return ref ? [ref.lon, ref.lat] : null
  }
  const data = useMemo(() => {
    const point = (iata: string): [number, number] | null => { const ref = coordinates(props.airports[iata]); return ref ? [ref.lon, ref.lat] : null }
    const selected = new Set(props.globe.routes.map(route => route.key))
    const revealed = new Set(props.timeline.filter(item => props.replay.arcs.has(item.key)).map(item => routeKey(item.origin, item.destination)))
    const routes = props.all.routes.flatMap(route => {
      const geometry = routeGeometry({ from: point(route.a), to: point(route.b) })
      const scoped = props.globe.routes.find(item => item.key === route.key)
      return geometry ? [{ type: 'Feature' as const, id: route.key, properties: { key: route.key, selected: selected.has(route.key),
        bucket: visitBucket(scoped?.count ?? route.count), opacity: !selected.has(route.key) ? .15 : props.reduced || !props.timeline.length || revealed.has(route.key) ? 1 : .15, upcoming: false },
        geometry: { type: 'LineString' as const, coordinates: unwrapArcCoordinates(geometry) } }] : []
    })
    const ghosts = props.all.ghosts.flatMap(ghost => {
      const geometry = routeGeometry({ from: point(ghost.origin), to: point(ghost.destination) })
      return geometry ? [{ type: 'Feature' as const, id: `upcoming:${ghost.id}`, properties: { id: ghost.id, key: routeKey(ghost.origin, ghost.destination), selected: false, bucket: 1, opacity: .15, upcoming: true },
        geometry: { type: 'LineString' as const, coordinates: unwrapArcCoordinates(geometry) } }] : []
    })
    const airports = props.globe.airports.flatMap(airport => { const position = point(airport.iata)
      return position ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: position } }] : [] })
    const present = new Set(land?.features.map(feature => String(feature.id ?? feature.properties?.id)))
    const visits = new Map(props.globe.countries.map(country => [country.code, country.visits]))
    const microstates = [...new Set([...visits.keys(), ...props.globe.ghostCountries])].flatMap(code => {
      const position = MICROSTATES[code]
      return position && !present.has(code) ? [{ type: 'Feature' as const, properties: { bucket: visitBucket(visits.get(code) ?? 0), opacity: visits.has(code) ? 1 : .15 }, geometry: { type: 'Point' as const, coordinates: position } }] : []
    })
    return { routes: { type: 'FeatureCollection' as const, features: [...routes, ...ghosts] }, airports: { type: 'FeatureCollection' as const, features: airports },
      microstates: { type: 'FeatureCollection' as const, features: microstates }, night: { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: {}, geometry: nightPolygon(props.nightDate) }] } }
  }, [props.all, props.globe, props.airports, props.timeline, props.replay.arcs, props.reduced, props.nightDate, land])
  const latestData = useRef(data)
  useEffect(() => { latestData.current = data }, [data])
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const retire = () => controller.abort()
    window.addEventListener('kuuki:identity-reset', retire)
    void fetch('/maps/countries-110m-2.0.2.geojson', { signal: controller.signal, cache: 'force-cache' }).then(async response => {
      if (!response.ok) throw new Error('Atlas unavailable')
      const value: unknown = await response.json()
      if (!isLand(value)) throw new Error('Invalid atlas')
      if (!controller.signal.aborted && latest.current.isCurrent()) setLand(value)
    }).catch(() => { if (!controller.signal.aborted) latest.current.onError() })
    return () => { retire(); window.removeEventListener('kuuki:identity-reset', retire) }
  }, [ready])
  useEffect(() => {
    if (!map || !ready || !land) return
    let disposed = false
    try {
      map.addSource('globe-countries', { type: 'geojson', data: land, promoteId: 'id' })
      for (const id of sources.slice(1)) map.addSource(id, { type: 'geojson', data: empty() })
      map.addLayer({ id: layers[0], type: 'fill', source: sources[0], paint: { 'fill-color': token('--map-land'), 'fill-outline-color': token('--map-border') } })
      map.addLayer({ id: layers[1], type: 'fill', source: sources[0], paint: { 'fill-opacity': ['case', ['boolean', ['feature-state', 'ghost'], false], 1, 0] } })
      map.addLayer({ id: layers[2], type: 'line', source: sources[1], filter: ['!', ['get', 'upcoming']], paint: { 'line-width': ['min', 3, ['get', 'bucket']], 'line-opacity': ['get', 'opacity'] } })
      map.addLayer({ id: layers[3], type: 'line', source: sources[1], filter: ['get', 'upcoming'], paint: { 'line-width': 1, 'line-dasharray': [3, 3], 'line-opacity': .15 } })
      map.addLayer({ id: layers[4], type: 'circle', source: sources[2], paint: { 'circle-radius': 2.5 } })
      map.addLayer({ id: layers[5], type: 'circle', source: sources[3], paint: { 'circle-radius': 3, 'circle-opacity': ['get', 'opacity'] } })
      map.addLayer({ id: layers[6], type: 'fill', source: sources[4], paint: { 'fill-opacity': .15 } })
      ;(map.getSource(sources[1]) as GeoJSONSource).setData(latestData.current.routes)
      ;(map.getSource(sources[2]) as GeoJSONSource).setData(latestData.current.airports)
      ;(map.getSource(sources[3]) as GeoJSONSource).setData(latestData.current.microstates)
      ;(map.getSource(sources[4]) as GeoJSONSource).setData(latestData.current.night)
    } catch { latest.current.onError() }
    const idle = () => { if (!disposed && latest.current.isCurrent()) latest.current.onReady() }
    map.once('idle', idle)
    const timeout = window.setTimeout(() => { if (!disposed && !map.loaded()) latest.current.onError() }, 12000)
    const click = (event: MapMouseEvent) => {
      if (!latest.current.active || !latest.current.isCurrent()) return
      const [feature] = map.queryRenderedFeatures([[event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8]], { layers: [layers[2]] })
      const key = feature?.properties?.key
      const route = latest.current.globe.routes.find(route => route.key === key)
      selection.current(route ? { key: route.key, count: route.count, distanceKm: latest.current.routeDistances.get(route.key) ?? null,
        x: Math.max(0, Math.min(event.point.x, (host.current?.clientWidth ?? 300) - 280)), y: Math.max(0, Math.min(event.point.y, (host.current?.clientHeight ?? 300) - 160)) } : null)
    }
    map.on('click', click)
    return () => {
      disposed = true; window.clearTimeout(timeout); map.off('idle', idle); map.off('click', click)
      for (const layer of [...layers].reverse()) if (map.getLayer(layer)) map.removeLayer(layer)
      for (const source of sources) if (map.getSource(source)) map.removeSource(source)
      if (map.getStyle() && map.hasImage('globe-hatch')) map.removeImage('globe-hatch')
    }
  }, [map, ready, land, host])
  useEffect(() => {
    if (!map || !land || !map.getSource(sources[1])) return
    const bucket = (expression: unknown): ExpressionSpecification => ['match', expression as ExpressionSpecification, 1, token(BUCKET_TOKENS[1]), 2, token(BUCKET_TOKENS[2]), 3, token(BUCKET_TOKENS[3]), 4, token(BUCKET_TOKENS[4]), token('--map-land')]
    const visits = new Map(props.globe.countries.map(country => [country.code, country.visits])), ghosts = new Set(props.globe.ghostCountries)
    for (const feature of land?.features ?? []) {
      const id = String(feature.id ?? feature.properties?.id)
      map.setFeatureState({ source: sources[0], id }, { bucket: visitBucket(visits.get(id) ?? 0), ghost: ghosts.has(id) })
    }
    map.setPaintProperty(layers[0], 'fill-color', bucket(['feature-state', 'bucket']))
    map.setPaintProperty(layers[0], 'fill-outline-color', token('--map-border'))
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8
    const context = canvas.getContext('2d')
    if (context) {
      context.strokeStyle = token('--mark-ghost'); context.globalAlpha = .15; context.lineWidth = 1
      context.beginPath(); context.moveTo(0, 8); context.lineTo(8, 0); context.stroke()
      const image = context.getImageData(0, 0, 8, 8)
      if (map.hasImage('globe-hatch')) map.updateImage('globe-hatch', image); else map.addImage('globe-hatch', image)
      map.setPaintProperty(layers[1], 'fill-pattern', 'globe-hatch')
    }
    const maker = props.filter.makers?.length === 1 ? token(`--cat-maker-${props.filter.makers[0]}`) : null
    map.setPaintProperty(layers[2], 'line-color', ['case', ['get', 'selected'], maker ?? bucket(['get', 'bucket']), token('--mark-ghost')])
    map.setPaintProperty(layers[3], 'line-color', token('--mark-ghost'))
    map.setPaintProperty(layers[4], 'circle-color', token('--mark-1'))
    map.setPaintProperty(layers[5], 'circle-color', bucket(['get', 'bucket']))
    map.setPaintProperty(layers[6], 'fill-color', token('--text'))
  }, [map, land, props.globe.countries, props.globe.ghostCountries, props.filter.makers, themeRevision])
  useEffect(() => {
    if (!map || !land || !map.getSource(sources[1])) return
    ;(map.getSource(sources[1]) as GeoJSONSource).setData(data.routes)
    ;(map.getSource(sources[2]) as GeoJSONSource).setData(data.airports)
    ;(map.getSource(sources[3]) as GeoJSONSource).setData(data.microstates)
    ;(map.getSource(sources[4]) as GeoJSONSource).setData(data.night)
  }, [map, land, data])
  useEffect(() => {
    if (!map || !ready || !props.active) return
    const center = props.globe.centroid ? [props.globe.centroid.lon, props.globe.centroid.lat] as [number, number] : [0, 0] as [number, number]
    moveCamera(map, center, props.reduced)
    const resize = () => {
      if (!latest.current.isCurrent()) return
      map.setMaxZoom(fitZoom(map, 0) + GLOBE_ZOOM_RANGE); map.jumpTo({ zoom: fitZoom(map, map.getCenter().lat) })
    }
    // The fit depends on latitude, so a fixed minZoom would pin a dragged sphere too large or let it shrink; settle back to the fit instead.
    const settle = () => {
      const fit = fitZoom(map, map.getCenter().lat)
      if (latest.current.isCurrent() && map.getZoom() < fit - .01) map.easeTo({ zoom: fit, duration: latest.current.reduced ? 0 : 200 })
    }
    map.on('resize', resize); map.on('moveend', settle)
    return () => { map.off('resize', resize); map.off('moveend', settle) }
  }, [map, ready, props.active, props.globe.centroid, props.filter, props.reduced])
  useEffect(() => {
    if (!map || !ready || !host.current || !props.active) return
    return attachGlobeGestures(map, host.current, props.fullscreen, window.matchMedia('(pointer: coarse)').matches)
  }, [map, ready, host, props.fullscreen, props.active])
  useEffect(() => {
    if (!map || !land || !map.getSource(sources[1]) || !props.active) return
    let lastFocus: string | null = null
    const update = () => {
      if (!latest.current.isCurrent()) return
      const snapshot = props.bus.getSnapshot()
      map.setPaintProperty(layers[3], 'line-opacity', ['case', ['==', ['get', 'id'], snapshot.hoverGhost ?? -1], .8, .15])
      map.setPaintProperty(layers[2], 'line-width', ['case', ['==', ['get', 'key'], snapshot.hoverRoute ?? snapshot.focusRoute ?? ''], 4, ['min', 3, ['get', 'bucket']]])
      if (snapshot.focusRoute === lastFocus) return
      lastFocus = snapshot.focusRoute
      if (!snapshot.focusRoute) return
      const route = latest.current.all.routes.find(route => route.key === snapshot.focusRoute)
      if (!route) return
      const from = coordinates(latest.current.airports[route.a]), to = coordinates(latest.current.airports[route.b])
      const geometry = routeGeometry({ from: from ? [from.lon, from.lat] : null, to: to ? [to.lon, to.lat] : null })
      if (geometry) moveCamera(map, interpolatePosition(unwrapArcCoordinates(geometry), .5), latest.current.reduced)
    }
    update(); return props.bus.subscribe(update)
  }, [map, land, props.bus, props.active])
  const planes = props.reduced ? props.globe.routes.map(route => ({ key: route.key, origin: route.a, destination: route.b, progress: .5 }))
    : props.replay.planes.map(plane => ({ key: plane.key, origin: plane.item.origin, destination: plane.item.destination, progress: (props.absoluteMs - plane.launchMs) / PLANE_MS }))
  return props.active ? planes.map(plane => {
    const from = point(plane.origin), to = point(plane.destination)
    return from && to ? <FlightPlane key={plane.key} from={from} to={to} progress={plane.progress} /> : null
  }) : null
}
const fitZoom = (map: LibreMap, latitude: number) => globeZoom(map.getContainer().clientWidth, map.getContainer().clientHeight, latitude, map.getVerticalFieldOfView())
function moveCamera(map: LibreMap, center: [number, number], reduced: boolean) {
  const zoom = fitZoom(map, center[1])
  map.setMaxZoom(fitZoom(map, 0) + GLOBE_ZOOM_RANGE)
  if (reduced) map.jumpTo({ center, zoom }); else map.flyTo({ center, zoom, duration: 600, easing: t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2 })
}
export function MaplibreGlobe(props: MaplibreGlobeProps) {
  const host = useRef<HTMLDivElement>(null)
  const [choice, setChoice] = useState<{ filter: OverviewFilter; route: GlobeRouteCard } | null>(null)
  const selected = choice?.filter === props.filter ? choice.route : null
  return <div ref={host} className="maplibre-globe" data-reduced={props.reduced}>
    {/* eslint-disable-next-line @next/next/no-css-tags */}
    <link rel="stylesheet" href="/maps/maplibre-6.13.0/maplibre-gl.css" />
    <MapCanvas projection={{ type: 'globe' }} locale={props.locale} className="globe-map-canvas" onError={props.onError}>
      <GlobeLayers props={props} host={host} select={route => setChoice(route ? { filter: props.filter, route } : null)} />
    </MapCanvas>
    {selected && props.active && props.globe.routes.some(route => route.key === selected.key) && <RouteCard route={selected} locale={props.locale} onClose={() => setChoice(null)} onScope={() => {
      if (props.isCurrent()) props.onScope(selected.key); setChoice(null)
    }} />}
  </div>
}
