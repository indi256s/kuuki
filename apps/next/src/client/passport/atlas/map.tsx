'use client'

import type * as GL from 'maplibre-gl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORLD_BOUNDS } from '../../maps/geometry'
import { Map as MapCanvas, useMap } from '../../maps/mapcn'
import { resolveColor } from '../../maps/resolve-color'
import { contrast, type Rgb } from '../../../lib/color'
import type { Locale } from '../../../lib/format'
import { ATLAS_VISIT_TOKENS, visitBucket } from '../../../lib/map-buckets'
import { isCatalogCountry } from '../model'
import { LABEL_FONT, LABEL_FONT_FACES } from './label-font'
import { LABEL_POINTS } from './label-points'
import type { RecordVisit } from './quick-visit'
import { SMALL_STATE_POINTS } from './small-states'
import { isRegionPage, minSidePx, pageBox, type AtlasPage, type Box } from './pages'
import { AtlasPager } from './pager'
import { Sticker, type StickerGeometry, type StickerHandle } from './sticker'
import { FRAME_ANCHORS, TRAVEL_REGION_NAMES } from './travel-regions'
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
  regionLabels: 'atlas-labels-region',
} as const

/** The phone atlas's pages (pager.tsx); absent on desktop, which keeps the zoom and framing buttons. */
export type AtlasPaging = {
  pages: AtlasPage[]
  page: number
  onPage: (index: number) => void
  /** Bumped when the current page is chosen again (its strip tab): the camera returns to the page's frame. */
  reframe: number
  /** The camera's live page position, fractional mid-swipe, so the strip's selection can follow the finger. */
  onProgress: (position: number) => void
}
/** On a page, a polygon country smaller than this on screen gets a marker beside its name, as a microstate does. */
const MIN_SIDE_PX = 24
/** Microstate markers: a visible dot and a 44px transparent hit disc, each split at REST_POINT_ZOOM into unvisited (rest) and marked. */
const POINT_LAYERS = [
  { id: ATLAS_LAYERS.dotRest, hit: false, rest: true },
  { id: ATLAS_LAYERS.dot, hit: false, rest: false },
  { id: ATLAS_LAYERS.hitRest, hit: true, rest: true },
  { id: ATLAS_LAYERS.hit, hit: true, rest: false },
] as const
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

/** A resolved `rgba(r,g,b,a)` (resolve-color.ts) as 0..1 sRGB. */
const rgbOf = (color: string) =>
  (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => Number(value) / 255) as Rgb
/** Of the two inks, the one that reads best on `fill`: the visit ramp runs light to dark in one theme, dark to light in the other. */
const inkOn = (fill: string, inks: [string, string]) =>
  contrast(rgbOf(inks[0]), rgbOf(fill)) >= contrast(rgbOf(inks[1]), rgbOf(fill)) ? inks[0] : inks[1]

const inSet = (codes: string[]): GL.ExpressionSpecification => [
  'in',
  ['get', 'id'],
  ['literal', codes],
]

const idIs = (id: string): GL.ExpressionSpecification => ['==', ['get', 'id'], id]

type LabelInput = { shown: string[]; covered: string[]; hovered: string | null }

/**
 * Always-on labels: the member's own countries, minus those under a sticker or a landed stamp (each prints the name).
 * The hover label names the country under a fine pointer when it has no always-on label.
 */
function applyLabelFilters(map: GL.Map, { shown, covered, hovered }: LabelInput) {
  const open: GL.ExpressionSpecification[] = covered.length ? [['!', inSet(covered)]] : []
  const always: GL.ExpressionSpecification = ['all', inSet(shown), ...open]
  map.setFilter(ATLAS_LAYERS.labels, ['all', ['==', ['get', 'micro'], 0], always])
  map.setFilter(ATLAS_LAYERS.microLabels, ['all', ['==', ['get', 'micro'], 1], always])
  map.setFilter(ATLAS_LAYERS.hoverLabel, ['all', idIs(hovered ?? ''), ['!', inSet(shown)], ...open])
}

type PointData = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }>
const pointFeatures = (points: Iterable<[string, [number, number]]>): PointData => ({
  type: 'FeatureCollection',
  features: [...points].map(([id, coordinates]) => ({
    type: 'Feature',
    properties: { id },
    geometry: { type: 'Point', coordinates },
  })),
})
const pointData = pointFeatures(Object.entries(SMALL_STATE_POINTS))

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

/** Each polygon's outer ring, skipping degenerate ones. */
const outerRings = (geometry: GeoJSON.Geometry): GeoJSON.Position[][] =>
  (geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : []
  )
    .map(([outer]) => outer)
    .filter((ring) => ring?.length > 2)

/** Longest-ring bounding box (by bbox area): the country's main landmass, cheap to compute once per geometry load. */
function largestRing(rings: GeoJSON.Position[][]): Shape | null {
  let best: Shape | null = null
  for (const ring of rings) {
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
  paging,
}: {
  locale: Locale
  entries: ReadonlyMap<string, number>
  pending: string[]
  name: (code: string) => string
  onSelect: (code: string) => void
  quick: QuickVisit | null
  fail: () => void
  paging: AtlasPaging | null
}) {
  const { map, ready, themeRevision } = useMap()
  const [raw, setRaw] = useState<Countries | null>(null)
  const [covered, setCovered] = useState<string[]>([])
  // A torn sticker inks its country at once, as one visit. Only while stickers are on: a filtered view draws what its filters leave.
  const recording = quick?.recording
  const entries = useMemo(() => {
    if (!recording?.size) return visitedEntries
    const next = new Map(visitedEntries)
    for (const code of recording) if (!next.has(code)) next.set(code, 1)
    return next
  }, [visitedEntries, recording])
  const shown = useMemo(() => [...entries.keys(), ...pending], [entries, pending])
  const cover = paging?.pages[paging.page]?.id === 'world'
  const paged = !!paging
  /**
   * On a page other than the cover, the page's countries are the subject: the member's other countries recede to one
   * muted fill and lose their names, so a year page shows that year and not the whole passport. A country being
   * recorded right now stays in focus wherever it belongs.
   */
  const pageCodes = paging && !cover ? paging.pages[paging.page]?.codes : undefined
  const focus = useMemo(() => {
    if (!pageCodes) return null
    const own = new Set(pageCodes)
    for (const code of recording ?? []) own.add(code)
    return { codes: [...own], off: shown.filter((code) => !own.has(code)) }
  }, [pageCodes, recording, shown])
  /** The settled page's zoom (pager.tsx): what decides which countries are too small to see. */
  const [pageZoom, setPageZoom] = useState<number | null>(null)
  const sticker = useRef<StickerHandle | null>(null)
  const tap = useRef<(id: string, polygon: boolean) => void>(() => {})
  tap.current = (id, polygon) => {
    const handle = sticker.current
    handle?.finish()
    // The world cover reads only: a tap on a marked country turns to its region's page.
    if (cover && paging) {
      handle?.dismiss()
      const index = paging.pages.findIndex((page) => page.id !== 'world' && page.codes.includes(id))
      if (index > 0) paging.onPage(index)
      return
    }
    if (quick && polygon && quick.peelable(id) && handle) {
      handle.lift(id)
      return
    }
    // A lifted sticker closes on any other tap; nothing else happens in the same tap.
    if (handle?.dismiss()) return
    onSelect(id)
  }
  useEffect(() => {
    if (!map || !ready) return
    // One world: repeated copies would draw a visited country twice beside the single list entry.
    map.setRenderWorldCopies(false)
    // Shift + arrows would otherwise rotate a flat reference map.
    map.keyboard.disableRotation()
  }, [map, ready])
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

  // Tokens resolve once per theme (each is a computed-style read and a canvas probe), not on every tear.
  const theme = useMemo(() => {
    const colors = {
      visits: ATLAS_VISIT_TOKENS.map(token),
      pending: token('--accent-tint'),
      land: token('--map-land'),
    }
    const text = token('--text')
    const halo = token('--surface')
    const inks: [string, string] = [text, halo]
    return {
      colors,
      // A country's own name is printed on its fill: the ink that reads on it.
      inks: {
        visits: colors.visits.map((visit) => inkOn(visit, inks)),
        pending: inkOn(colors.pending, inks),
        land: inkOn(colors.land, inks),
      },
      muted: resolveColor(`color-mix(in oklab, ${colors.visits[0]} 30%, ${colors.land})`),
      border: token('--map-border'),
      pendingLine: token('--accent-text'),
      text,
      halo,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeRevision])
  // Visited wins over pending for the same code (match takes the first branch).
  const paints = useMemo(
    () => ({
      ...theme,
      fill: stateColor(entries, pending, theme.colors),
      ink: stateColor(entries, pending, theme.inks),
    }),
    [theme, entries, pending],
  )
  const labelInput = useRef<LabelInput>({ shown, covered, hovered: null })

  // Each country's main landmass, once per geometry load.
  const shapes = useMemo(() => {
    const byId = new Map<string, Shape>()
    for (const feature of raw?.features ?? []) {
      const id = feature.properties.id
      const found = isCatalogCountry(id) ? largestRing(outerRings(feature.geometry)) : null
      if (found) byId.set(id, found)
    }
    return byId
  }, [raw])
  // On a page, a marked country too small to see or tap at its zoom draws as a marker, its name beside it.
  const small = useMemo(() => {
    const tiny = new Map<string, [number, number]>()
    if (!paged || pageZoom === null) return tiny
    for (const code of focus?.codes ?? shown) {
      const shape = shapes.get(code)
      if (shape && minSidePx(shape.box, pageZoom) < MIN_SIDE_PX)
        tiny.set(code, LABEL_POINTS[code] ?? shape.point)
    }
    return tiny
  }, [paged, pageZoom, shown, focus, shapes])
  /**
   * Where a name sits. On pages a huge country frames on its populated part, so its name moves there when the usual
   * point lies outside it (Russia's is in Siberia, off the Europe page).
   */
  const labelPoint = useCallback(
    (id: string, fallback: [number, number]): [number, number] => {
      const point = LABEL_POINTS[id] ?? fallback
      const anchor = paged ? FRAME_ANCHORS[id] : undefined
      if (!anchor) return point
      const inside =
        point[0] >= anchor[0] &&
        point[0] <= anchor[2] &&
        point[1] >= anchor[1] &&
        point[1] <= anchor[3]
      return inside ? point : [(anchor[0] + anchor[2]) / 2, (anchor[1] + anchor[3]) / 2]
    },
    [paged],
  )
  /** Every marker's point, so a tap picks the nearest one. */
  const markers = useRef<ReadonlyMap<string, [number, number]>>(new Map())
  const labelData = useMemo<LabelData>(
    () =>
      raw
        ? {
            type: 'FeatureCollection',
            features: [
              ...[...shapes].map(([id, shape]) =>
                labelFeature(small.get(id) ?? labelPoint(id, shape.point), {
                  id,
                  label: name(id),
                  // Lower places first: bigger countries win a collision.
                  rank: -shape.area,
                  micro: small.has(id) ? 1 : 0,
                }),
              ),
              ...Object.entries(SMALL_STATE_POINTS).map(([id, point]) =>
                labelFeature(point, { id, label: name(id), rank: 0, micro: 1 }),
              ),
            ],
          }
        : emptyLabels,
    [raw, shapes, name, small, labelPoint],
  )

  // Layers start with their fixed properties; the effect below sets colours and filters in the same commit.
  useEffect(() => {
    if (!map || !ready || !raw) return
    const text = {
      'text-field': ['get', 'label'],
      'text-font': [LABEL_FONT],
      'text-size': 11,
      'text-padding': 2,
      'symbol-sort-key': ['get', 'rank'],
    }
    const textPaint = { 'text-halo-width': 1.5 }
    map.setFontFaces(LABEL_FONT_FACES)
    // `id` doubles as the feature id, so hover is feature state: a paint change, not a source reload.
    map.addSource('atlas-countries', { type: 'geojson', data: raw, promoteId: 'id' })
    map.addSource('atlas-points', { type: 'geojson', data: pointData })
    map.addSource('atlas-labels', { type: 'geojson', data: emptyLabels })
    map.addLayer({ id: ATLAS_LAYERS.fill, type: 'fill', source: 'atlas-countries' })
    map.addLayer({
      id: ATLAS_LAYERS.outline,
      type: 'line',
      source: 'atlas-countries',
      paint: { 'line-width': 0.55 },
    })
    // Pending is outlined and dashed, so it never relies on its lighter fill alone.
    map.addLayer({
      id: ATLAS_LAYERS.pending,
      type: 'line',
      source: 'atlas-countries',
      layout: { visibility: 'none' },
      paint: { 'line-width': 1.6, 'line-dasharray': [2, 2] },
    })
    // The country under a fine pointer; only a hover sets the state, so touch never shows one.
    map.addLayer({
      id: ATLAS_LAYERS.hover,
      type: 'line',
      source: 'atlas-countries',
      paint: {
        'line-width': 1.25,
        'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
      },
    })
    for (const layer of POINT_LAYERS)
      map.addLayer({
        id: layer.id,
        type: 'circle',
        source: 'atlas-points',
        ...(layer.rest ? { minzoom: REST_POINT_ZOOM } : {}),
        paint: layer.hit
          ? { 'circle-radius': HIT_RADIUS, 'circle-opacity': 0 }
          : { 'circle-radius': 5, 'circle-stroke-width': 1.5 },
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
    // The world cover names regions, not countries (pager.tsx); empty on every other page and on desktop.
    map.addSource('atlas-region-labels', { type: 'geojson', data: emptyLabels })
    map.addLayer({
      id: ATLAS_LAYERS.regionLabels,
      type: 'symbol',
      source: 'atlas-region-labels',
      layout: { ...text, 'text-size': 13, 'text-max-width': 9 } as never,
      paint: { 'text-halo-width': 1.75 },
    })
    // A marker beats the polygon under it; where 44px targets overlap (European microstates at world zoom), the
    // marker nearest the pointer wins rather than whichever the renderer lists first.
    const pick = (event: GL.MapMouseEvent): { id: unknown; polygon: boolean } => {
      let best: { id: unknown; distance: number } | null = null
      for (const feature of map.queryRenderedFeatures(event.point, {
        layers: [ATLAS_LAYERS.hit, ATLAS_LAYERS.hitRest],
      })) {
        const id = feature.properties?.id
        const point = typeof id === 'string' ? markers.current.get(id) : undefined
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
      const before = labelInput.current.hovered
      if (id === before) return
      labelInput.current = { ...labelInput.current, hovered: id }
      map.getCanvas().style.cursor = id ? 'pointer' : ''
      if (before) map.setFeatureState({ source: 'atlas-countries', id: before }, { hover: false })
      if (id) map.setFeatureState({ source: 'atlas-countries', id }, { hover: true })
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
      labelInput.current = { ...labelInput.current, hovered: null }
      for (const id of Object.values(ATLAS_LAYERS).reverse())
        if (map.getLayer(id)) map.removeLayer(id)
      for (const id of ['atlas-region-labels', 'atlas-labels', 'atlas-points', 'atlas-countries'])
        if (map.getSource(id)) map.removeSource(id)
    }
  }, [map, ready, raw])

  // Colours that change only with the theme or the collection.
  useEffect(() => {
    if (!map || !ready || !map.getLayer(ATLAS_LAYERS.fill)) return
    const marked = inSet(shown)
    map.setPaintProperty(ATLAS_LAYERS.outline, 'line-color', paints.border)
    map.setPaintProperty(ATLAS_LAYERS.pending, 'line-color', paints.pendingLine)
    map.setFilter(ATLAS_LAYERS.pending, inSet(pending))
    map.setLayoutProperty(ATLAS_LAYERS.pending, 'visibility', pending.length ? 'visible' : 'none')
    map.setPaintProperty(ATLAS_LAYERS.hover, 'line-color', paints.text)
    for (const layer of POINT_LAYERS) {
      map.setFilter(layer.id, layer.rest ? ['!', marked] : marked)
      if (!layer.hit) map.setPaintProperty(layer.id, 'circle-stroke-color', paints.border)
    }
    // Names inside their country take its fill; microstate names sit beside a marker and region names span many.
    for (const layer of [ATLAS_LAYERS.labels, ATLAS_LAYERS.hoverLabel]) {
      map.setPaintProperty(layer, 'text-color', paints.ink as never)
      map.setPaintProperty(layer, 'text-halo-color', paints.fill as never)
    }
    for (const layer of [ATLAS_LAYERS.microLabels, ATLAS_LAYERS.regionLabels]) {
      map.setPaintProperty(layer, 'text-color', paints.text)
      map.setPaintProperty(layer, 'text-halo-color', paints.halo)
    }
  }, [map, ready, raw, paints, pending, shown])
  // The fills, which a page turn also changes: off-page countries recede.
  useEffect(() => {
    if (!map || !ready || !map.getLayer(ATLAS_LAYERS.fill)) return
    const fill = focus?.off.length
      ? ['case', inSet(focus.off), paints.muted, paints.fill]
      : paints.fill
    map.setPaintProperty(ATLAS_LAYERS.fill, 'fill-color', fill as never)
    for (const layer of POINT_LAYERS)
      if (!layer.hit) map.setPaintProperty(layer.id, 'circle-color', fill as never)
  }, [map, ready, raw, paints, focus])

  useEffect(() => {
    if (!map || !ready || !map.getLayer(ATLAS_LAYERS.labels)) return
    // The cover is too far out for country names; its regions carry the labels. A page names its own countries.
    labelInput.current = {
      ...labelInput.current,
      shown: cover ? [] : (focus?.codes ?? shown),
      covered,
    }
    applyLabelFilters(map, labelInput.current)
  }, [map, ready, raw, shown, covered, cover, focus])

  useEffect(() => {
    if (!map || !ready) return
    markers.current = new Map([...Object.entries(SMALL_STATE_POINTS), ...small])
    ;(map.getSource('atlas-points') as GL.GeoJSONSource | undefined)?.setData(
      pointFeatures(markers.current),
    )
  }, [map, ready, raw, small])

  useEffect(() => {
    if (!map || !ready) return
    ;(map.getSource('atlas-labels') as GL.GeoJSONSource | undefined)?.setData(labelData)
  }, [map, ready, raw, labelData])

  const geometries = useMemo(() => {
    const byId = new Map<string, StickerGeometry>()
    for (const feature of raw?.features ?? []) {
      const found = shapes.get(feature.properties.id)
      if (found)
        byId.set(feature.properties.id, {
          rings: outerRings(feature.geometry),
          centre: found.point,
        })
    }
    return byId
  }, [raw, shapes])
  const geometryOf = useCallback((code: string) => geometries.get(code) ?? null, [geometries])
  const mine = useMemo(() => memberBounds(shown, shapes), [shown, shapes])
  const frameOf = useCallback(
    (code: string): Box | null => {
      const point = SMALL_STATE_POINTS[code]
      return (
        FRAME_ANCHORS[code] ??
        shapes.get(code)?.box ??
        (point ? [point[0], point[1], point[0], point[1]] : null)
      )
    },
    [shapes],
  )
  const pages = paging?.pages
  const regionLabels = useMemo<LabelData>(() => {
    if (!cover || !pages) return emptyLabels
    // Year pages overlap on the world, so the cover names regions only when the pages are regions.
    const features = pages.filter(isRegionPage).flatMap((page) => {
      const box = pageBox(page, frameOf)
      if (!box) return []
      return [
        labelFeature([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], {
          id: page.id,
          label: `${TRAVEL_REGION_NAMES[locale][page.id]} ${page.codes.length}`,
          rank: -page.codes.length,
          micro: 0,
        }),
      ]
    })
    return { type: 'FeatureCollection', features }
  }, [cover, pages, frameOf, locale])
  useEffect(() => {
    if (!map || !ready) return
    ;(map.getSource('atlas-region-labels') as GL.GeoJSONSource | undefined)?.setData(regionLabels)
  }, [map, ready, raw, regionLabels])
  const interrupt = useCallback(() => {
    sticker.current?.finish()
    sticker.current?.dismiss()
  }, [])
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
          onCovered={setCovered}
        />
      ) : null}
      {paging ? (
        raw ? (
          <AtlasPager
            locale={locale}
            pages={paging.pages}
            page={paging.page}
            onPage={paging.onPage}
            reframe={paging.reframe}
            onProgress={paging.onProgress}
            frameOf={frameOf}
            interrupt={interrupt}
            onPageZoom={setPageZoom}
          />
        ) : null
      ) : (
        <Controls locale={locale} mine={mine} loaded={!!raw} />
      )}
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
  const [atWorld, setAtWorld] = useState(false)
  const fitted = useRef<GL.Map | null>(null)
  useEffect(() => {
    if (!map || !ready || !loaded || fitted.current === map) return
    fitted.current = map
    if (mine) fitMine(map, mine)
    else fitWorld(map)
  }, [map, ready, loaded, mine])
  if (!ready) return null
  const text = STRINGS[locale]
  const toWorld = !atWorld || !mine
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
          if (toWorld) fitWorld(map)
          else fitMine(map, mine)
          setAtWorld(toWorld)
        }}
      >
        {toWorld ? text.world : text.mine}
      </button>
    </div>
  )
}

/**
 * The MapLibre island, fetched only when the map view is shown. Scroll contract (shared with client/maps/options.ts):
 * cooperative gestures, so a plain wheel scrolls the page, Ctrl/⌘ + wheel zooms, and touch needs two fingers. Paged
 * (phones), pager.tsx replaces that contract: one finger sideways turns pages, vertically scrolls, two fingers pinch.
 */
export default function AtlasMap({
  locale,
  entries,
  pending,
  name,
  onSelectCountry,
  quickVisit = null,
  fail,
  paging = null,
}: {
  locale: Locale
  /** Visited countries with their visit counts, which pick the fill bucket. */
  entries: ReadonlyMap<string, number>
  pending: string[]
  name: (code: string) => string
  onSelectCountry: (code: string) => void
  quickVisit?: QuickVisit | null
  fail: () => void
  /** Phones: swipeable travel-region pages instead of the zoom and framing buttons. */
  paging?: AtlasPaging | null
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
          paging={paging}
        />
      </MapCanvas>
    </div>
  )
}
