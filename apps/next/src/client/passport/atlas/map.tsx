'use client'

import type * as GL from 'maplibre-gl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORLD_BOUNDS } from '../../maps/geometry'
import { Map as MapCanvas, useMap } from '../../maps/mapcn'
import { resolveColor } from '../../maps/resolve-color'
import type { Locale } from '../../../lib/format'
import { visitBucket } from '../../../lib/map-buckets'
import { isCatalogCountry } from '../model'
import { LABEL_FONT, LABEL_FONT_FACES } from './label-font'
import { LABEL_POINTS } from './label-points'
import type { RecordVisit } from './quick-visit'
import { SMALL_STATE_POINTS } from './small-states'
import { Sticker, type StickerGeometry, type StickerHandle } from './sticker'
import './atlas.css'

/** The owner's quick add on the map; absent for visitors, the preview and any filtered or searched view. */
export type QuickVisit = {
  ownerId: string
  /** Not pressed, pending, hidden or being recorded, checked against the full collection. */
  peelable: (code: string) => boolean
  record: RecordVisit
  /** Torn countries whose write is still in flight: inked before the refreshed collection has them. */
  recording: ReadonlySet<string>
}

const GEOMETRY = '/maps/countries-110m-2.0.2-r2.geojson'
/** Pinned to the ids of the layers below, in stacking order, so queries and tests name them in one place. */
export const ATLAS_LAYERS = {
  fill: 'atlas-fill',
  outline: 'atlas-outline',
  pending: 'atlas-pending',
  hover: 'atlas-hover',
  dotRest: 'atlas-points-dot-rest',
  dot: 'atlas-points-dot',
  hitRest: 'atlas-points-hit-rest',
  hit: 'atlas-points-hit',
  labels: 'atlas-labels',
  microLabels: 'atlas-labels-micro',
  hoverLabel: 'atlas-labels-hover',
} as const
/** A 22px radius is a 44px disc: the minimum touch target for a point marker. */
const HIT_RADIUS = 22
/** Unvisited microstate markers (and their hit areas) wait for this zoom; marked ones always draw. */
const REST_POINT_ZOOM = 3.5
/** The first fit and the My countries button stop here, so a single small country is not framed at street level. */
const MINE_MAX_ZOOM = 4.5

type Countries = GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; name: string }>
type Bounds = [[number, number], [number, number]]

// MapLibre needs resolved colors: read the computed token and let the browser resolve color-mix()/var().
const token = (name: string) =>
  resolveColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim())

const VISIT_TOKENS = [
  '--atlas-visit-1',
  '--atlas-visit-2',
  '--atlas-visit-3',
  '--atlas-visit-4',
] as const

type Colors = {
  /** Visit buckets 1..4 (1, 2–3, 4–9, 10+). */
  visits: readonly string[]
  pending: string
  land: string
}

/**
 * `match` over ISO2 ids; MapLibre rejects an empty label list, so an empty set contributes no branch. A visited
 * country takes its visit bucket's colour; pending only where the code is not visited (labels must be unique).
 */
const stateColor = (
  visited: ReadonlyMap<string, number>,
  pending: string[],
  colors: Colors,
): GL.ExpressionSpecification | string => {
  const buckets: string[][] = colors.visits.map(() => [])
  for (const [code, count] of visited) buckets[Math.max(1, visitBucket(count)) - 1].push(code)
  const branches: (string | string[])[] = []
  buckets.forEach((codes, index) => {
    if (codes.length) branches.push(codes, colors.visits[index])
  })
  const waiting = pending.filter((code) => !visited.has(code))
  if (waiting.length) branches.push(waiting, colors.pending)
  return branches.length
    ? (['match', ['get', 'id'], ...branches, colors.land] as unknown as GL.ExpressionSpecification)
    : colors.land
}

const inSet = (codes: string[]): GL.ExpressionSpecification => [
  'in',
  ['get', 'id'],
  ['literal', codes],
]

const pendingFilter = inSet
const idIs = (id: string): GL.ExpressionSpecification => ['==', ['get', 'id'], id]

type LabelInput = { shown: string[]; lifted: string | null; hovered: string | null }

/**
 * Always-on labels: the member's own countries, minus the lifted sticker (its face already prints the name).
 * The hover label names the country under a fine pointer when it has no always-on label.
 */
export function labelFilters({ shown, lifted, hovered }: LabelInput) {
  const open: GL.ExpressionSpecification[] = lifted ? [['!=', ['get', 'id'], lifted]] : []
  const always: GL.ExpressionSpecification = ['all', inSet(shown), ...open]
  return {
    polygons: ['all', ['==', ['get', 'micro'], 0], always] as GL.ExpressionSpecification,
    micro: ['all', ['==', ['get', 'micro'], 1], always] as GL.ExpressionSpecification,
    hover: ['all', idIs(hovered ?? ''), ['!', inSet(shown)], ...open] as GL.ExpressionSpecification,
    outline: idIs(hovered ?? ''),
  }
}

function applyLabelFilters(map: GL.Map, input: LabelInput) {
  const filters = labelFilters(input)
  map.setFilter(ATLAS_LAYERS.labels, filters.polygons)
  map.setFilter(ATLAS_LAYERS.microLabels, filters.micro)
  map.setFilter(ATLAS_LAYERS.hoverLabel, filters.hover)
  map.setFilter(ATLAS_LAYERS.hover, filters.outline)
}

const pointData: GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }> = {
  type: 'FeatureCollection',
  features: Object.entries(SMALL_STATE_POINTS).map(([id, coordinates]) => ({
    type: 'Feature',
    properties: { id },
    geometry: { type: 'Point', coordinates },
  })),
}

type LabelProperties = { id: string; label: string; rank: number; micro: 0 | 1 }
type LabelData = GeoJSON.FeatureCollection<GeoJSON.Point, LabelProperties>
const emptyLabels: LabelData = { type: 'FeatureCollection', features: [] }

type Shape = {
  /** Largest-ring bounding box: west, south, east, north. */
  box: [number, number, number, number]
  area: number
  /** The box centre: where a stamp lands and the name label falls back to. */
  point: [number, number]
}

/** Longest-ring bounding box (by bbox area): the country's main landmass, cheap to compute once per geometry load. */
function largestRing(geometry: GeoJSON.Geometry): Shape | null {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  let best: Shape | null = null
  for (const [ring] of polygons) {
    if (!ring?.length) continue
    const xs = ring.map((p) => p[0]),
      ys = ring.map((p) => p[1])
    const west = Math.min(...xs),
      east = Math.max(...xs),
      south = Math.min(...ys),
      north = Math.max(...ys)
    const area = (east - west) * (north - south)
    if (!best || area > best.area)
      best = {
        box: [west, south, east, north],
        area,
        point: [(west + east) / 2, (south + north) / 2],
      }
  }
  return best
}

/** Union of the countries' largest-ring boxes and microstate points; null when none has a place on the map. */
function memberBounds(codes: string[], shapes: ReadonlyMap<string, Shape>): Bounds | null {
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity
  for (const code of codes) {
    const point = SMALL_STATE_POINTS[code]
    const box = shapes.get(code)?.box ?? (point ? [point[0], point[1], point[0], point[1]] : null)
    if (!box) continue
    west = Math.min(west, box[0])
    south = Math.min(south, box[1])
    east = Math.max(east, box[2])
    north = Math.max(north, box[3])
  }
  return west <= east
    ? [
        [west, south],
        [east, north],
      ]
    : null
}

const labelFeature = (
  point: [number, number],
  properties: LabelProperties,
): GeoJSON.Feature<GeoJSON.Point, LabelProperties> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: point },
})

function AtlasLayers({
  locale,
  entries: visitedEntries,
  pending,
  name,
  onSelect,
  quick,
  fail,
}: {
  locale: Locale
  entries: ReadonlyMap<string, number>
  pending: string[]
  name: (code: string) => string
  onSelect: (code: string) => void
  quick: QuickVisit | null
  fail: () => void
}) {
  const { map, ready, themeRevision } = useMap()
  const [raw, setRaw] = useState<Countries | null>(null)
  const [lifted, setLifted] = useState<string | null>(null)
  // A torn sticker inks its country at once, as one visit. Only while stickers are on: a filtered view draws what its filters leave.
  const recording = quick?.recording
  const entries = useMemo(() => {
    if (!recording?.size) return visitedEntries
    const next = new Map(visitedEntries)
    for (const code of recording) if (!next.has(code)) next.set(code, 1)
    return next
  }, [visitedEntries, recording])
  const shown = useMemo(() => [...entries.keys(), ...pending], [entries, pending])
  const sticker = useRef<StickerHandle | null>(null)
  const tap = useRef<(id: string, polygon: boolean) => void>(() => {})
  tap.current = (id, polygon) => {
    const handle = sticker.current
    handle?.finish()
    if (quick && polygon && quick.peelable(id) && handle) {
      handle.lift(id)
      return
    }
    // A lifted sticker closes on any other tap; nothing else happens in the same tap.
    if (handle?.dismiss()) return
    onSelect(id)
  }
  // The geometry fetch starts with the island, in parallel with the map's own load.
  useEffect(() => {
    const controller = new AbortController()
    fetch(GEOMETRY, { signal: controller.signal, cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error('country geometry unavailable')
        return (await response.json()) as Countries
      })
      .then(setRaw)
      .catch(() => {
        if (!controller.signal.aborted) fail()
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Visited wins over pending for the same code (match takes the first branch).
  const paints = useMemo(() => {
    const colors = {
      visits: VISIT_TOKENS.map(token),
      pending: token('--accent-tint'),
      land: token('--map-land'),
    }
    return {
      fill: stateColor(entries, pending, colors),
      border: token('--map-border'),
      pendingLine: token('--accent-text'),
      text: token('--text'),
      halo: token('--surface'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, pending, themeRevision])
  const latest = useRef(paints)
  latest.current = paints
  const pendingCodes = useRef(pending)
  pendingCodes.current = pending
  const hovered = useRef<string | null>(null)
  const labelInput = useRef<LabelInput>({ shown, lifted, hovered: null })

  // Each country's main landmass, once per geometry load.
  const shapes = useMemo(() => {
    const byId = new Map<string, Shape>()
    for (const feature of raw?.features ?? []) {
      const id = feature.properties.id
      const found = isCatalogCountry(id) ? largestRing(feature.geometry) : null
      if (found) byId.set(id, found)
    }
    return byId
  }, [raw])
  const labelData = useMemo<LabelData>(
    () =>
      raw
        ? {
            type: 'FeatureCollection',
            features: [
              ...[...shapes].map(([id, shape]) =>
                labelFeature(LABEL_POINTS[id] ?? shape.point, {
                  id,
                  label: name(id),
                  // Lower places first: bigger countries win a collision.
                  rank: -shape.area,
                  micro: 0,
                }),
              ),
              ...Object.entries(SMALL_STATE_POINTS).map(([id, point]) =>
                labelFeature(point, { id, label: name(id), rank: 0, micro: 1 }),
              ),
            ],
          }
        : emptyLabels,
    [raw, shapes, name],
  )

  useEffect(() => {
    if (!map || !ready || !raw) return
    const now = latest.current
    const marked = inSet([...entries.keys(), ...pendingCodes.current])
    const unmarked: GL.ExpressionSpecification = ['!', marked]
    const dot = {
      'circle-radius': 5,
      'circle-color': now.fill as never,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': now.border,
    }
    const hit = {
      'circle-radius': HIT_RADIUS,
      'circle-color': now.fill as never,
      'circle-opacity': 0,
    }
    const text = {
      'text-field': ['get', 'label'],
      'text-font': [LABEL_FONT],
      'text-size': 11,
      'text-padding': 2,
      'symbol-sort-key': ['get', 'rank'],
    }
    const textPaint = {
      'text-color': now.text,
      'text-halo-color': now.halo,
      'text-halo-width': 1.5,
    }
    map.setFontFaces(LABEL_FONT_FACES)
    map.addSource('atlas-countries', { type: 'geojson', data: raw })
    map.addSource('atlas-points', { type: 'geojson', data: pointData })
    map.addSource('atlas-labels', { type: 'geojson', data: emptyLabels })
    map.addLayer({
      id: ATLAS_LAYERS.fill,
      type: 'fill',
      source: 'atlas-countries',
      paint: { 'fill-color': now.fill as never },
    })
    map.addLayer({
      id: ATLAS_LAYERS.outline,
      type: 'line',
      source: 'atlas-countries',
      paint: { 'line-color': now.border, 'line-width': 0.55 },
    })
    // Pending is outlined and dashed, so it never relies on its lighter fill alone.
    map.addLayer({
      id: ATLAS_LAYERS.pending,
      type: 'line',
      source: 'atlas-countries',
      filter: pendingFilter(pendingCodes.current),
      layout: { visibility: pendingCodes.current.length ? 'visible' : 'none' },
      paint: { 'line-color': now.pendingLine, 'line-width': 1.6, 'line-dasharray': [2, 2] },
    })
    // The country under a fine pointer; the filter names it, so touch never sets one.
    map.addLayer({
      id: ATLAS_LAYERS.hover,
      type: 'line',
      source: 'atlas-countries',
      filter: idIs(''),
      paint: { 'line-color': now.text, 'line-width': 1.25 },
    })
    map.addLayer({
      id: ATLAS_LAYERS.dotRest,
      type: 'circle',
      source: 'atlas-points',
      minzoom: REST_POINT_ZOOM,
      filter: unmarked,
      paint: dot,
    })
    map.addLayer({
      id: ATLAS_LAYERS.dot,
      type: 'circle',
      source: 'atlas-points',
      filter: marked,
      paint: dot,
    })
    map.addLayer({
      id: ATLAS_LAYERS.hitRest,
      type: 'circle',
      source: 'atlas-points',
      minzoom: REST_POINT_ZOOM,
      filter: unmarked,
      paint: hit,
    })
    map.addLayer({
      id: ATLAS_LAYERS.hit,
      type: 'circle',
      source: 'atlas-points',
      filter: marked,
      paint: hit,
    })
    // Names are native symbols: MapLibre places them in the same frame as the canvas, so a drag cannot desync them.
    map.addLayer({
      id: ATLAS_LAYERS.labels,
      type: 'symbol',
      source: 'atlas-labels',
      layout: { ...text, 'text-max-width': 7 } as never,
      paint: textPaint,
    })
    // A dot is never covered: the name sits beside it.
    map.addLayer({
      id: ATLAS_LAYERS.microLabels,
      type: 'symbol',
      source: 'atlas-labels',
      layout: {
        ...text,
        'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
        'text-radial-offset': 0.9,
      } as never,
      paint: textPaint,
    })
    map.addLayer({
      id: ATLAS_LAYERS.hoverLabel,
      type: 'symbol',
      source: 'atlas-labels',
      layout: {
        ...text,
        'text-max-width': 7,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-anchor': ['case', ['==', ['get', 'micro'], 1], 'top', 'center'],
        'text-offset': [
          'case',
          ['==', ['get', 'micro'], 1],
          ['literal', [0, 0.9]],
          ['literal', [0, 0]],
        ],
      } as never,
      paint: textPaint,
    })
    // A marker beats the polygon under it; where 44px targets overlap (European microstates at world zoom), the
    // marker nearest the pointer wins rather than whichever the renderer lists first.
    const pick = (event: GL.MapMouseEvent): { id: unknown; polygon: boolean } => {
      let best: { id: unknown; distance: number } | null = null
      for (const feature of map.queryRenderedFeatures(event.point, {
        layers: [ATLAS_LAYERS.hit, ATLAS_LAYERS.hitRest],
      })) {
        const id = feature.properties?.id
        const point = typeof id === 'string' ? SMALL_STATE_POINTS[id] : undefined
        if (!point) continue
        const { x, y } = map.project(point)
        const distance = Math.hypot(x - event.point.x, y - event.point.y)
        if (!best || distance < best.distance) best = { id, distance }
      }
      if (best) return { id: best.id, polygon: false }
      return {
        id: map.queryRenderedFeatures(event.point, { layers: [ATLAS_LAYERS.fill] })[0]?.properties
          ?.id,
        polygon: true,
      }
    }
    const click = (event: GL.MapMouseEvent) => {
      const { id, polygon } = pick(event)
      if (typeof id === 'string' && isCatalogCountry(id)) tap.current(id, polygon)
      else sticker.current?.dismiss()
    }
    // Hover is a fine-pointer answer: one query per move at most, none while the camera moves or a button is held,
    // and the filters change only when the country under the pointer does.
    const point = window.matchMedia?.('(hover: hover) and (pointer: fine)')
    const hoverTo = (id: string | null) => {
      if (id === hovered.current) return
      hovered.current = id
      labelInput.current = { ...labelInput.current, hovered: id }
      map.getCanvas().style.cursor = id ? 'pointer' : ''
      applyLabelFilters(map, labelInput.current)
    }
    const hover = (event: GL.MapMouseEvent) => {
      if (!point?.matches || map.isMoving() || event.originalEvent?.buttons) return
      const { id } = pick(event)
      hoverTo(typeof id === 'string' && isCatalogCountry(id) ? id : null)
    }
    // A drag hides the hover answer at once: the pointer is moving the map, not pointing at a country.
    const leave = () => hoverTo(null)
    map.on('click', click)
    map.on('mousemove', hover)
    map.on('mouseout', leave)
    map.on('dragstart', leave)
    return () => {
      map.off('click', click)
      map.off('mousemove', hover)
      map.off('mouseout', leave)
      map.off('dragstart', leave)
      hovered.current = null
      for (const id of Object.values(ATLAS_LAYERS).reverse())
        if (map.getLayer(id)) map.removeLayer(id)
      for (const id of ['atlas-labels', 'atlas-points', 'atlas-countries'])
        if (map.getSource(id)) map.removeSource(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, raw])

  useEffect(() => {
    if (!map || !ready || !map.getLayer(ATLAS_LAYERS.fill)) return
    const marked = inSet(shown)
    map.setPaintProperty(ATLAS_LAYERS.fill, 'fill-color', paints.fill as never)
    map.setPaintProperty(ATLAS_LAYERS.outline, 'line-color', paints.border)
    map.setPaintProperty(ATLAS_LAYERS.pending, 'line-color', paints.pendingLine)
    map.setFilter(ATLAS_LAYERS.pending, pendingFilter(pending))
    map.setLayoutProperty(ATLAS_LAYERS.pending, 'visibility', pending.length ? 'visible' : 'none')
    map.setPaintProperty(ATLAS_LAYERS.hover, 'line-color', paints.text)
    for (const layer of [ATLAS_LAYERS.dotRest, ATLAS_LAYERS.dot]) {
      map.setPaintProperty(layer, 'circle-color', paints.fill as never)
      map.setPaintProperty(layer, 'circle-stroke-color', paints.border)
    }
    map.setPaintProperty(ATLAS_LAYERS.hit, 'circle-color', paints.fill as never)
    map.setPaintProperty(ATLAS_LAYERS.hitRest, 'circle-color', paints.fill as never)
    map.setFilter(ATLAS_LAYERS.dot, marked)
    map.setFilter(ATLAS_LAYERS.hit, marked)
    map.setFilter(ATLAS_LAYERS.dotRest, ['!', marked])
    map.setFilter(ATLAS_LAYERS.hitRest, ['!', marked])
    for (const layer of [ATLAS_LAYERS.labels, ATLAS_LAYERS.microLabels, ATLAS_LAYERS.hoverLabel]) {
      map.setPaintProperty(layer, 'text-color', paints.text)
      map.setPaintProperty(layer, 'text-halo-color', paints.halo)
    }
  }, [map, ready, raw, paints, pending, shown])

  useEffect(() => {
    if (!map || !ready || !map.getLayer(ATLAS_LAYERS.labels)) return
    labelInput.current = { shown, lifted, hovered: hovered.current }
    applyLabelFilters(map, labelInput.current)
  }, [map, ready, raw, shown, lifted])

  useEffect(() => {
    if (!map || !ready) return
    ;(map.getSource('atlas-labels') as GL.GeoJSONSource | undefined)?.setData(labelData)
  }, [map, ready, raw, labelData])

  const geometries = useMemo(() => {
    const byId = new Map<string, StickerGeometry>()
    for (const feature of raw?.features ?? []) {
      const { geometry } = feature
      const polygons =
        geometry.type === 'Polygon'
          ? [geometry.coordinates]
          : geometry.type === 'MultiPolygon'
            ? geometry.coordinates
            : []
      const found = shapes.get(feature.properties.id)
      if (!found || !polygons.length) continue
      byId.set(feature.properties.id, {
        rings: polygons.map(([outer]) => outer).filter((ring) => ring?.length > 2),
        centre: found.point,
      })
    }
    return byId
  }, [raw, shapes])
  const geometryOf = useCallback((code: string) => geometries.get(code) ?? null, [geometries])
  const mine = useMemo(() => memberBounds(shown, shapes), [shown, shapes])
  return (
    <>
      {quick && raw ? (
        <Sticker
          control={sticker}
          locale={locale}
          ownerId={quick.ownerId}
          name={name}
          geometryOf={geometryOf}
          record={quick.record}
          onActive={setLifted}
        />
      ) : null}
      <Controls locale={locale} mine={mine} loaded={!!raw} />
    </>
  )
}

const STRINGS = {
  en: { in: 'Zoom in', out: 'Zoom out', world: 'Whole world', mine: 'My countries' },
  ru: { in: 'Приблизить', out: 'Отдалить', world: 'Весь мир', mine: 'Мои страны' },
} as const

const fitWorld = (map: GL.Map) => map.fitBounds(WORLD_BOUNDS, { padding: 16, duration: 0 })
const fitMine = (map: GL.Map, mine: Bounds) => {
  const container = map.getContainer()
  map.fitBounds(mine, {
    padding: Math.max(16, Math.min(container.clientWidth, container.clientHeight) / 10),
    maxZoom: MINE_MAX_ZOOM,
    duration: 0,
  })
}

/**
 * Buttons are the keyboard path for zoom and framing; motion is a jump, so reduced motion needs no branch. The map
 * opens once on the member's countries (the whole world without any), then keeps the member's view: filters, scope
 * and recordings never refit. One button toggles between the two framings.
 */
function Controls({
  locale,
  mine,
  loaded,
}: {
  locale: Locale
  mine: Bounds | null
  loaded: boolean
}) {
  const { map, ready } = useMap()
  const [view, setView] = useState<'mine' | 'world'>('mine')
  const fitted = useRef<GL.Map | null>(null)
  useEffect(() => {
    if (!map || !ready) return
    // One world: repeated copies would draw a visited country twice beside the single list entry.
    map.setRenderWorldCopies(false)
    // Shift + arrows would otherwise rotate a flat reference map.
    map.keyboard.disableRotation()
  }, [map, ready])
  useEffect(() => {
    if (!map || !ready || !loaded || fitted.current === map) return
    fitted.current = map
    if (mine) fitMine(map, mine)
    else fitWorld(map)
  }, [map, ready, loaded, mine])
  if (!ready) return null
  const text = STRINGS[locale]
  const toWorld = view === 'mine' || !mine
  return (
    <div className="passport-atlas-controls">
      <button type="button" aria-label={text.in} onClick={() => map?.zoomIn({ duration: 0 })}>
        +
      </button>
      <button type="button" aria-label={text.out} onClick={() => map?.zoomOut({ duration: 0 })}>
        −
      </button>
      <button
        type="button"
        onClick={() => {
          if (!map) return
          if (toWorld || !mine) fitWorld(map)
          else fitMine(map, mine)
          setView(toWorld ? 'world' : 'mine')
        }}
      >
        {toWorld ? text.world : text.mine}
      </button>
    </div>
  )
}

/**
 * The MapLibre island, fetched only when the map view is shown. Scroll contract (shared with client/maps/options.ts):
 * cooperative gestures, so a plain wheel scrolls the page, Ctrl/⌘ + wheel zooms, and touch needs two fingers.
 */
export default function AtlasMap({
  locale,
  entries,
  pending,
  name,
  onSelectCountry,
  quickVisit = null,
  fail,
}: {
  locale: Locale
  /** Visited countries with their visit counts, which pick the fill bucket. */
  entries: ReadonlyMap<string, number>
  pending: string[]
  name: (code: string) => string
  onSelectCountry: (code: string) => void
  quickVisit?: QuickVisit | null
  fail: () => void
}) {
  return (
    <div className="passport-atlas-stage">
      {/* Local CSS is requested only when the heavy map island mounts. */}
      {/* oxlint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/maps/maplibre-6.13.0/maplibre-gl.css" />
      <MapCanvas onError={fail} locale={locale} className="passport-atlas-canvas">
        <AtlasLayers
          locale={locale}
          entries={entries}
          pending={pending}
          name={name}
          onSelect={onSelectCountry}
          quick={quickVisit}
          fail={fail}
        />
      </MapCanvas>
    </div>
  )
}
