'use client'

import type {
  Map as LibreMap,
  MapMouseEvent,
  GeoJSONSource,
  ExpressionSpecification,
} from 'maplibre-gl'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
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
import { RouteCard, type GlobeRouteCard } from './route-card'
import { PLANE_MS, type TimelineItem } from './replay'
import type { useReplay } from './use-replay'
import type { createUIBus } from '../store/ui-bus'
import { isLand, type GlobeLand } from './atlas'
import { GLOBE_ZOOM_RANGE, globeZoom } from './camera'

export type MaplibreGlobeProps = {
  globe: GlobeData
  all: GlobeData
  airports: OverviewPayload['refs']['airports']
  filter: OverviewFilter
  /** The effective scope: 'all' while no ground data exists, whatever the stored filter says. */
  travelScope: 'all' | 'flights' | 'ground'
  locale: Locale
  fullscreen: boolean
  active: boolean
  reduced: boolean
  bus: ReturnType<typeof createUIBus>
  isCurrent: () => boolean
  onScope: (key: string) => void
  routeDistances: ReadonlyMap<string, number | null>
  replay: ReturnType<typeof useReplay>
  timeline: TimelineItem[]
  onReady: () => void
  onError: () => void
}
const token = (name: string) =>
  resolveColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim())
const empty = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] })
// Approximate Natural Earth 10m admin-0 label points (5.1.0), not capitals/centroids.
// https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_label_points.geojson
const MICROSTATES: Record<string, [number, number]> = {
  MC: [7.398449, 43.746141],
  VA: [12.453364, 41.903327],
  SM: [12.442237, 43.936454],
  LI: [9.5409, 47.138206],
  AD: [1.560756, 42.541327],
  SG: [103.813465, 1.358924],
}
const GROUND_SOURCE = 'globe-ground'
const CITY_SOURCE = 'globe-ground-cities'
const sources = [
  'globe-countries',
  'globe-routes',
  'globe-airports',
  'globe-microstates',
  GROUND_SOURCE,
  CITY_SOURCE,
]
const GROUND_CASING = 'globe-ground-casing'
const GROUND_LINE = 'globe-ground-line'
const RAIL_TIES = 'globe-ground-rail-ties'
const ROAD_DOTS = 'globe-ground-road-dots'
const CITY_SQUARES = 'globe-ground-city-squares'
const TIE_IMAGE = 'globe-rail-tie'
const DOT_IMAGE = 'globe-road-dot'
const CITY_IMAGE = 'globe-city-square'
const IMAGES = ['globe-hatch', TIE_IMAGE, DOT_IMAGE, CITY_IMAGE]
// Below this zoom ground is the plain line; ties and dots only read once a leg is long enough on screen.
const GROUND_DETAIL_MINZOOM = 4
const GROUND_LINE_WIDTH = 1.5
// Planned journeys stay in the same encoding at a lower weight, in every scope.
const plannedOpacity: ExpressionSpecification = ['case', ['get', 'planned'], 0.35, 1]
const layers = [
  'globe-land',
  'globe-ghost-countries',
  'globe-route-lines',
  'globe-upcoming',
  'globe-airport-dots',
  'globe-microstate-dots',
  'globe-route-casing',
  'globe-airport-labels',
  GROUND_CASING,
  GROUND_LINE,
  RAIL_TIES,
  ROAD_DOTS,
  CITY_SQUARES,
]
// Routes used the land ramp, so a route over a country in its own bucket measured 1:1. They now draw in ink over a land-toned halo: one of the two holds 3:1 on every bucket, theme and accent.
// The core stays fine (1.25–2.5px by visit bucket); the halo is solid for its first half-pixel and blurs out over 2px, so it separates the line without outlining it.
const routeWidth: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'bucket'],
  1,
  1.25,
  4,
  2.5,
]
const casingWidth = (width: ExpressionSpecification | number): ExpressionSpecification => [
  '+',
  5,
  width,
]
const round = { 'line-cap': 'round', 'line-join': 'round' } as const

function GlobeLayers({
  props,
  host,
  select,
  selectedRoute,
}: {
  props: MaplibreGlobeProps
  host: RefObject<HTMLDivElement | null>
  select: (route: GlobeRouteCard | null) => void
  selectedRoute: string | null
}) {
  const { map, ready, themeRevision } = useMap()
  const { hoverRoute, focusRoute } = useSyncExternalStore(
    props.bus.subscribe,
    props.bus.getSnapshot,
    props.bus.getServerSnapshot,
  )
  const [land, setLand] = useState<GlobeLand | null>(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  }, [props])
  const selection = useRef(select)
  useEffect(() => {
    selection.current = select
  }, [select])
  const point = (iata: string): [number, number] | null => {
    const ref = coordinates(props.airports[iata])
    return ref ? [ref.lon, ref.lat] : null
  }
  const routeFeatures = useMemo(() => {
    const point = (iata: string): [number, number] | null => {
      const ref = coordinates(props.airports[iata])
      return ref ? [ref.lon, ref.lat] : null
    }
    // Under ground the flight context must not leak in as faint lines.
    const flightContext = props.travelScope !== 'ground'
    const routes = (flightContext ? props.all.routes : []).flatMap((route) => {
      const geometry = routeGeometry({ from: point(route.a), to: point(route.b) })
      return geometry
        ? [
            {
              type: 'Feature' as const,
              id: route.key,
              properties: {
                key: route.key,
                selected: false,
                bucket: visitBucket(route.count),
                upcoming: false,
              },
              geometry: {
                type: 'LineString' as const,
                coordinates: unwrapArcCoordinates(geometry),
              },
            },
          ]
        : []
    })
    const ghosts = (flightContext ? props.all.ghosts : []).flatMap((ghost) => {
      const geometry = routeGeometry({ from: point(ghost.origin), to: point(ghost.destination) })
      return geometry
        ? [
            {
              type: 'Feature' as const,
              id: `upcoming:${ghost.id}`,
              properties: {
                id: ghost.id,
                key: routeKey(ghost.origin, ghost.destination),
                selected: false,
                bucket: 1,
                opacity: 0.15,
                upcoming: true,
              },
              geometry: {
                type: 'LineString' as const,
                coordinates: unwrapArcCoordinates(geometry),
              },
            },
          ]
        : []
    })
    return [...routes, ...ghosts]
  }, [props.all.routes, props.all.ghosts, props.airports, props.travelScope])
  const data = useMemo(() => {
    const point = (iata: string): [number, number] | null => {
      const ref = coordinates(props.airports[iata])
      return ref ? [ref.lon, ref.lat] : null
    }
    const scopedRoutes = new Map(props.globe.routes.map((route) => [route.key, route]))
    const routes = routeFeatures.map((feature) => {
      if (feature.properties.upcoming) return feature
      const scoped = scopedRoutes.get(feature.properties.key)
      return {
        ...feature,
        properties: {
          ...feature.properties,
          selected: !!scoped,
          bucket: scoped ? visitBucket(scoped.count) : feature.properties.bucket,
        },
      }
    })
    const airports = props.globe.airports.flatMap((airport) => {
      const position = point(airport.iata)
      return position
        ? [
            {
              type: 'Feature' as const,
              properties: { iata: airport.iata, priority: -airport.count },
              geometry: { type: 'Point' as const, coordinates: position },
            },
          ]
        : []
    })
    const present = new Set(
      land?.features.map((feature) => String(feature.id ?? feature.properties?.id)),
    )
    const visits = new Map(props.globe.countries.map((country) => [country.code, country.visits]))
    const microstates = [...new Set([...visits.keys(), ...props.globe.ghostCountries])].flatMap(
      (code) => {
        const position = MICROSTATES[code]
        return position && !present.has(code)
          ? [
              {
                type: 'Feature' as const,
                properties: {
                  bucket: visitBucket(visits.get(code) ?? 0),
                  opacity: visits.has(code) ? 1 : 0.15,
                },
                geometry: { type: 'Point' as const, coordinates: position },
              },
            ]
          : []
      },
    )
    const cities = new Map<string, { position: [number, number]; planned: boolean }>()
    const runs = props.globe.ground.flatMap((journey) =>
      journey.runs.flatMap((run) => {
        for (const position of run) {
          const key = position.join(',')
          const seen = cities.get(key)
          cities.set(key, { position, planned: (seen?.planned ?? true) && journey.planned })
        }
        return run.length < 2
          ? []
          : [
              {
                type: 'Feature' as const,
                properties: { mode: journey.mode, planned: journey.planned },
                geometry: { type: 'LineString' as const, coordinates: run },
              },
            ]
      }),
    )
    const cityPoints = [...cities.values()].map(({ position, planned }) => ({
      type: 'Feature' as const,
      properties: { planned },
      geometry: { type: 'Point' as const, coordinates: position },
    }))
    return {
      ground: { type: 'FeatureCollection' as const, features: runs },
      cities: { type: 'FeatureCollection' as const, features: cityPoints },
      routes: { type: 'FeatureCollection' as const, features: routes },
      airports: { type: 'FeatureCollection' as const, features: airports },
      microstates: { type: 'FeatureCollection' as const, features: microstates },
    }
  }, [routeFeatures, props.globe, props.airports, land])
  const groundPoints = useMemo(
    () => props.globe.ground.flatMap((journey) => journey.runs.flat()),
    [props.globe.ground],
  )
  const latestData = useRef(data)
  useEffect(() => {
    latestData.current = data
  }, [data])
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const retire = () => controller.abort()
    window.addEventListener('kuuki:identity-reset', retire)
    void fetch('/maps/countries-110m-2.0.2-r2.geojson', {
      signal: controller.signal,
      cache: 'force-cache',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Atlas unavailable')
        const value: unknown = await response.json()
        if (!isLand(value)) throw new Error('Invalid atlas')
        if (!controller.signal.aborted && latest.current.isCurrent()) setLand(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) latest.current.onError()
      })
    return () => {
      retire()
      window.removeEventListener('kuuki:identity-reset', retire)
    }
  }, [ready])
  useEffect(() => {
    if (!map || !ready || !land) return
    let disposed = false
    try {
      map.setFontFaces({ 'Paper Mono': [{ url: '/fonts/PaperMono.woff2' }] })
      map.addSource('globe-countries', { type: 'geojson', data: land, promoteId: 'id' })
      for (const id of sources.slice(1)) map.addSource(id, { type: 'geojson', data: empty() })
      map.addLayer({
        id: layers[0],
        type: 'fill',
        source: sources[0],
        paint: { 'fill-color': token('--map-land'), 'fill-outline-color': token('--map-border') },
      })
      map.addLayer({
        id: layers[1],
        type: 'fill',
        source: sources[0],
        paint: { 'fill-opacity': ['case', ['boolean', ['feature-state', 'ghost'], false], 1, 0] },
      })
      // Ground sits under the flight layers; it is not interactive (no cursor, hover or click).
      map.addLayer({
        id: GROUND_CASING,
        type: 'line',
        source: GROUND_SOURCE,
        layout: round,
        paint: {
          'line-width': casingWidth(GROUND_LINE_WIDTH),
          'line-blur': 2,
          'line-opacity': plannedOpacity,
        },
      })
      map.addLayer({
        id: GROUND_LINE,
        type: 'line',
        source: GROUND_SOURCE,
        layout: round,
        paint: { 'line-width': GROUND_LINE_WIDTH, 'line-opacity': plannedOpacity },
      })
      // icon-image is set once the image exists (paint effect), so no missing-image warning fires at creation.
      for (const [id, mode] of [
        [RAIL_TIES, 'rail'],
        [ROAD_DOTS, 'road'],
      ] as const)
        map.addLayer({
          id,
          type: 'symbol',
          source: GROUND_SOURCE,
          minzoom: GROUND_DETAIL_MINZOOM,
          filter: ['==', ['get', 'mode'], mode],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 12,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-rotation-alignment': 'map',
          },
          paint: { 'icon-opacity': plannedOpacity },
        })
      map.addLayer({
        id: layers[6],
        type: 'line',
        source: sources[1],
        filter: ['!', ['get', 'upcoming']],
        layout: round,
        paint: { 'line-width': casingWidth(routeWidth), 'line-blur': 2, 'line-opacity': 0 },
      })
      map.addLayer({
        id: layers[2],
        type: 'line',
        source: sources[1],
        filter: ['!', ['get', 'upcoming']],
        layout: round,
        paint: { 'line-width': routeWidth, 'line-opacity': 0.15 },
      })
      map.addLayer({
        id: layers[3],
        type: 'line',
        source: sources[1],
        filter: ['get', 'upcoming'],
        paint: { 'line-width': 1, 'line-dasharray': [3, 3], 'line-opacity': 0.15 },
      })
      map.addLayer({
        id: layers[4],
        type: 'circle',
        source: sources[2],
        // Every route ends on a bead in its own ink, so a line over a fully filled country still reads as arriving somewhere.
        paint: { 'circle-radius': 3, 'circle-stroke-width': 1.5 },
      })
      map.addLayer({
        id: layers[5],
        type: 'circle',
        source: sources[3],
        paint: { 'circle-radius': 3, 'circle-opacity': ['get', 'opacity'] },
      })
      map.addLayer({
        id: CITY_SQUARES,
        type: 'symbol',
        source: CITY_SOURCE,
        layout: { 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-opacity': plannedOpacity },
      })
      map.addLayer({
        id: layers[7],
        type: 'symbol',
        source: sources[2],
        layout: {
          'text-field': ['get', 'iata'],
          'text-font': ['Paper Mono'],
          'text-size': 12,
          'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
          'text-radial-offset': 0.8,
          'text-padding': 3,
          'text-pitch-alignment': 'viewport',
          'text-rotation-alignment': 'viewport',
          'symbol-sort-key': ['get', 'priority'],
        },
        paint: { 'text-halo-width': 1.5 },
      })
      ;(map.getSource(sources[1]) as GeoJSONSource).setData(latestData.current.routes)
      ;(map.getSource(sources[2]) as GeoJSONSource).setData(latestData.current.airports)
      ;(map.getSource(sources[3]) as GeoJSONSource).setData(latestData.current.microstates)
      ;(map.getSource(GROUND_SOURCE) as GeoJSONSource).setData(latestData.current.ground)
      ;(map.getSource(CITY_SOURCE) as GeoJSONSource).setData(latestData.current.cities)
    } catch {
      latest.current.onError()
    }
    // Watchdog for the first render only: `map.loaded()` is false whenever a style or source update is pending, so polling it later fails a working globe.
    const timeout = window.setTimeout(() => {
      if (!disposed) latest.current.onError()
    }, 12000)
    const idle = () => {
      window.clearTimeout(timeout)
      if (!disposed && latest.current.isCurrent()) latest.current.onReady()
    }
    map.once('idle', idle)
    const click = (event: MapMouseEvent) => {
      if (!latest.current.active || !latest.current.isCurrent()) return
      const [feature] = map.queryRenderedFeatures(
        [
          [event.point.x - 8, event.point.y - 8],
          [event.point.x + 8, event.point.y + 8],
        ],
        { layers: [layers[2]] },
      )
      const key = feature?.properties?.key
      const route = latest.current.globe.routes.find((route) => route.key === key)
      selection.current(
        route
          ? {
              key: route.key,
              count: route.count,
              distanceKm: latest.current.routeDistances.get(route.key) ?? null,
              // The popover flips and shifts at the edges itself; the anchor stays on the clicked arc.
              x: event.point.x,
              y: event.point.y,
            }
          : null,
      )
    }
    map.on('click', click)
    return () => {
      disposed = true
      window.clearTimeout(timeout)
      map.off('idle', idle)
      map.off('click', click)
      for (const layer of [...layers].reverse()) if (map.getLayer(layer)) map.removeLayer(layer)
      for (const source of sources) if (map.getSource(source)) map.removeSource(source)
      if (map.getStyle())
        for (const image of IMAGES) if (map.hasImage(image)) map.removeImage(image)
    }
  }, [map, ready, land, host])
  useEffect(() => {
    if (!map || !land || !map.getSource(sources[1])) return
    const bucket = (expression: unknown): ExpressionSpecification => [
      'match',
      expression as ExpressionSpecification,
      1,
      token(BUCKET_TOKENS[1]),
      2,
      token(BUCKET_TOKENS[2]),
      3,
      token(BUCKET_TOKENS[3]),
      4,
      token(BUCKET_TOKENS[4]),
      token('--map-land'),
    ]
    const visits = new Map(props.globe.countries.map((country) => [country.code, country.visits])),
      ghosts = new Set(props.globe.ghostCountries)
    for (const feature of land?.features ?? []) {
      const id = String(feature.id ?? feature.properties?.id)
      map.setFeatureState(
        { source: sources[0], id },
        { bucket: visitBucket(visits.get(id) ?? 0), ghost: ghosts.has(id) },
      )
    }
    map.setPaintProperty(layers[0], 'fill-color', bucket(['feature-state', 'bucket']))
    map.setPaintProperty(layers[0], 'fill-outline-color', token('--map-border'))
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 8
    const context = canvas.getContext('2d')
    if (context) {
      context.strokeStyle = token('--mark-ghost')
      context.globalAlpha = 0.15
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(0, 8)
      context.lineTo(8, 0)
      context.stroke()
      const image = context.getImageData(0, 0, 8, 8)
      if (map.hasImage('globe-hatch')) map.updateImage('globe-hatch', image)
      else map.addImage('globe-hatch', image)
      map.setPaintProperty(layers[1], 'fill-pattern', 'globe-hatch')
    }
    // Ground icons are drawn at 2x (pixelRatio 2): tie 1x6, dot 3 and city square 7 CSS px.
    const ink = token('--globe-route'),
      casing = token('--globe-route-casing')
    const icons: Array<[string, string, number, number, (c: CanvasRenderingContext2D) => void]> = [
      [
        TIE_IMAGE,
        RAIL_TIES,
        2,
        12,
        (c) => {
          c.fillStyle = ink
          c.fillRect(0, 0, 2, 12)
        },
      ],
      [
        DOT_IMAGE,
        ROAD_DOTS,
        6,
        6,
        (c) => {
          c.fillStyle = ink
          c.beginPath()
          c.arc(3, 3, 3, 0, Math.PI * 2)
          c.fill()
        },
      ],
      [
        CITY_IMAGE,
        CITY_SQUARES,
        14,
        14,
        (c) => {
          c.fillStyle = casing
          c.fillRect(0, 0, 14, 14)
          c.fillStyle = ink
          c.fillRect(3, 3, 8, 8)
        },
      ],
    ]
    for (const [id, layer, width, height, draw] of icons) {
      const surface = document.createElement('canvas')
      surface.width = width
      surface.height = height
      const pen = surface.getContext('2d')
      if (!pen) continue
      draw(pen)
      const image = pen.getImageData(0, 0, width, height)
      if (map.hasImage(id)) map.updateImage(id, image)
      else map.addImage(id, image, { pixelRatio: 2 })
      map.setLayoutProperty(layer, 'icon-image', id)
    }
    map.setPaintProperty(GROUND_LINE, 'line-color', ink)
    map.setPaintProperty(GROUND_CASING, 'line-color', casing)
    const maker =
      props.filter.makers?.length === 1 ? token(`--cat-maker-${props.filter.makers[0]}`) : null
    map.setPaintProperty(layers[2], 'line-color', [
      'case',
      ['get', 'selected'],
      maker ?? token('--globe-route'),
      token('--mark-ghost'),
    ])
    map.setPaintProperty(layers[6], 'line-color', token('--globe-route-casing'))
    map.setPaintProperty(layers[3], 'line-color', token('--mark-ghost'))
    map.setPaintProperty(layers[4], 'circle-color', token('--globe-route'))
    map.setPaintProperty(layers[4], 'circle-stroke-color', token('--globe-route-casing'))
    map.setPaintProperty(layers[5], 'circle-color', bucket(['get', 'bucket']))
    map.setPaintProperty(layers[7], 'text-color', token('--text'))
    map.setPaintProperty(layers[7], 'text-halo-color', token('--surface'))
  }, [
    map,
    land,
    props.globe.countries,
    props.globe.ghostCountries,
    props.filter.makers,
    themeRevision,
  ])
  useEffect(() => {
    if (!map || !land || !map.getSource(sources[1])) return
    ;(map.getSource(sources[1]) as GeoJSONSource).setData(data.routes)
    ;(map.getSource(sources[2]) as GeoJSONSource).setData(data.airports)
    ;(map.getSource(sources[3]) as GeoJSONSource).setData(data.microstates)
    ;(map.getSource(GROUND_SOURCE) as GeoJSONSource).setData(data.ground)
    ;(map.getSource(CITY_SOURCE) as GeoJSONSource).setData(data.cities)
  }, [map, land, data])
  useEffect(() => {
    if (!map || !land || !map.getLayer(layers[2])) return
    const revealed = [
      ...new Set(
        props.timeline
          .filter((item) => props.replay.arcs.has(item.key))
          .map((item) => routeKey(item.origin, item.destination)),
      ),
    ]
    const lit: ExpressionSpecification | boolean =
      props.reduced || !props.timeline.length ? true : ['in', ['get', 'key'], ['literal', revealed]]
    // Routes not yet flown in the replay stay visible but secondary (about 2:1); filtered-out context stays a .15 ghost.
    map.setPaintProperty(layers[2], 'line-opacity', [
      'case',
      ['!', ['get', 'selected']],
      0.15,
      lit,
      1,
      0.3,
    ])
    map.setPaintProperty(layers[6], 'line-opacity', [
      'case',
      ['!', ['get', 'selected']],
      0,
      lit,
      1,
      0,
    ])
  }, [map, land, props.timeline, props.replay.arcs, props.reduced])
  useEffect(() => {
    if (!map || !ready || !props.active) return
    const center = props.globe.centroid
      ? ([props.globe.centroid.lon, props.globe.centroid.lat] as [number, number])
      : ([0, 0] as [number, number])
    const bounds = props.travelScope === 'ground' ? pointBounds(groundPoints) : null
    if (bounds) fitGround(map, bounds, props.reduced)
    else moveCamera(map, center, props.reduced)
    const resize = () => {
      if (!latest.current.isCurrent()) return
      if (bounds) fitGround(map, bounds, true)
      else {
        setZoomLimits(map)
        map.jumpTo({ zoom: fitZoom(map, map.getCenter().lat) })
      }
    }
    map.on('resize', resize)
    return () => {
      map.off('resize', resize)
    }
  }, [
    map,
    ready,
    props.active,
    props.globe.centroid,
    props.filter,
    props.reduced,
    props.travelScope,
    groundPoints,
  ])
  useEffect(() => {
    if (!map || !ready || !props.active) return
    attachGlobeGestures(map, props.fullscreen, window.matchMedia('(pointer: coarse)').matches)
  }, [map, ready, props.fullscreen, props.active])
  useEffect(() => {
    if (!map || !land || !map.getSource(sources[1]) || !props.active) return
    let lastFocus: string | null = null
    const update = () => {
      if (!latest.current.isCurrent()) return
      const snapshot = props.bus.getSnapshot()
      map.setPaintProperty(layers[3], 'line-opacity', [
        'case',
        ['==', ['get', 'id'], snapshot.hoverGhost ?? -1],
        0.8,
        0.15,
      ])
      const width: ExpressionSpecification = [
        'case',
        ['==', ['get', 'key'], snapshot.hoverRoute ?? snapshot.focusRoute ?? ''],
        3.5,
        routeWidth,
      ]
      map.setPaintProperty(layers[2], 'line-width', width)
      map.setPaintProperty(layers[6], 'line-width', casingWidth(width))
      if (snapshot.focusRoute === lastFocus) return
      lastFocus = snapshot.focusRoute
      if (!snapshot.focusRoute) return
      const route = latest.current.all.routes.find((route) => route.key === snapshot.focusRoute)
      if (!route) return
      const from = coordinates(latest.current.airports[route.a]),
        to = coordinates(latest.current.airports[route.b])
      const geometry = routeGeometry({
        from: from ? [from.lon, from.lat] : null,
        to: to ? [to.lon, to.lat] : null,
      })
      if (geometry)
        moveCamera(
          map,
          interpolatePosition(unwrapArcCoordinates(geometry), 0.5),
          latest.current.reduced,
        )
    }
    update()
    return props.bus.subscribe(update)
  }, [map, land, props.bus, props.active])
  const highlightedRoute = selectedRoute ?? hoverRoute ?? focusRoute
  const planes =
    props.reduced || props.replay.planes.length === 0
      ? props.globe.routes
          .filter((route) => route.key === highlightedRoute)
          .map((route) => ({
            key: route.key,
            origin: route.a,
            destination: route.b,
            progress: 0.5,
            launchMs: null,
          }))
      : props.replay.planes.map((plane) => ({
          key: plane.key,
          origin: plane.item.origin,
          destination: plane.item.destination,
          progress: (props.replay.absoluteMs - plane.launchMs) / PLANE_MS,
          launchMs: plane.launchMs,
        }))
  return props.active && land
    ? planes.map((plane) => {
        const from = point(plane.origin),
          to = point(plane.destination)
        return from && to ? (
          <ReplayFlightPlane
            key={plane.key}
            from={from}
            to={to}
            plane={plane}
            replay={props.replay}
          />
        ) : null
      })
    : null
}
function ReplayFlightPlane({
  from,
  to,
  plane,
  replay,
}: {
  from: [number, number]
  to: [number, number]
  plane: { progress: number; launchMs: number | null }
  replay: ReturnType<typeof useReplay>
}) {
  const { launchMs } = plane
  const { getFrame, subscribe } = replay
  const getProgress = useCallback(
    () => (launchMs === null ? 0.5 : (getFrame().absoluteMs - launchMs) / PLANE_MS),
    [getFrame, launchMs],
  )
  return (
    <FlightPlane
      from={from}
      to={to}
      progress={plane.progress}
      getProgress={getProgress}
      subscribe={launchMs === null ? undefined : subscribe}
    />
  )
}
const fitZoom = (map: LibreMap, latitude: number, fit: 'cover' | 'contain' = 'contain') =>
  globeZoom(
    map.getContainer().clientWidth,
    map.getContainer().clientHeight,
    latitude,
    map.getVerticalFieldOfView(),
    fit,
  )
// Zoom out stops where the whole sphere shows and stays there; zoom in goes a few cities deep past the cover fit.
// On a globe MapLibre applies both limits at the equator and corrects them for the center's latitude itself, so they are fitted at 0°.
function setZoomLimits(map: LibreMap) {
  map.setMaxZoom(fitZoom(map, 0, 'cover') + GLOBE_ZOOM_RANGE)
  map.setMinZoom(fitZoom(map, 0, 'contain'))
}
function moveCamera(map: LibreMap, center: [number, number], reduced: boolean) {
  const zoom = fitZoom(map, center[1])
  setZoomLimits(map)
  if (reduced) map.jumpTo({ center, zoom })
  else
    map.flyTo({
      center,
      zoom,
      duration: 600,
      easing: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
    })
}
type Bounds = [[number, number], [number, number]]
// A single point (or a stack of identical ones) has no extent to fit: the centroid camera frames it instead.
function pointBounds(points: Array<[number, number]>): Bounds | null {
  if (!points.length) return null
  const lons = points.map(([lon]) => lon),
    lats = points.map(([, lat]) => lat)
  const bounds: Bounds = [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
  return bounds[1][0] - bounds[0][0] < 0.01 && bounds[1][1] - bounds[0][1] < 0.01 ? null : bounds
}
function fitGround(map: LibreMap, bounds: Bounds, reduced: boolean) {
  setZoomLimits(map)
  const width = map.getContainer().clientWidth
  map.fitBounds(bounds, {
    padding: width < 480 ? 24 : 32,
    maxZoom: map.getMaxZoom(),
    duration: reduced ? 0 : 600,
    easing: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  })
}
export function MaplibreGlobe(props: MaplibreGlobeProps) {
  const host = useRef<HTMLDivElement>(null)
  const [choice, setChoice] = useState<{ filter: OverviewFilter; route: GlobeRouteCard } | null>(
    null,
  )
  const selected =
    choice?.filter === props.filter &&
    props.globe.routes.some((route) => route.key === choice.route.key)
      ? choice.route
      : null
  return (
    <div ref={host} className="maplibre-globe" data-reduced={props.reduced}>
      {/* oxlint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/maps/maplibre-6.13.0/maplibre-gl.css" />
      <MapCanvas
        projection={{ type: 'globe' }}
        locale={props.locale}
        className="globe-map-canvas"
        onError={props.onError}
      >
        <GlobeLayers
          props={props}
          host={host}
          select={(route) => setChoice(route ? { filter: props.filter, route } : null)}
          selectedRoute={selected?.key ?? null}
        />
      </MapCanvas>
      {selected && props.active && (
        <RouteCard
          route={selected}
          locale={props.locale}
          onClose={() => setChoice(null)}
          onScope={() => {
            if (props.isCurrent()) props.onScope(selected.key)
            setChoice(null)
          }}
        />
      )}
    </div>
  )
}
