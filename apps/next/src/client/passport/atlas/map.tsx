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

export type QuickVisit = {
  ownerId: string
  peelable: (code: string) => boolean
  record: RecordVisit
  recording: ReadonlySet<string>
}

const GEOMETRY = '/maps/countries-110m-2.0.2-r2.geojson'
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

export type AtlasPaging = {
  pages: AtlasPage[]
  page: number
  onPage: (index: number) => void
  reframe: number
  onProgress: (position: number) => void
}
const MIN_SIDE_PX = 24
const POINT_LAYERS = [
  { id: ATLAS_LAYERS.dotRest, hit: false, rest: true },
  { id: ATLAS_LAYERS.dot, hit: false, rest: false },
  { id: ATLAS_LAYERS.hitRest, hit: true, rest: true },
  { id: ATLAS_LAYERS.hit, hit: true, rest: false },
] as const
const HIT_RADIUS = 22
const REST_POINT_ZOOM = 3.5
const MINE_MAX_ZOOM = 4.5

type Countries = GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; name: string }>
type Bounds = [[number, number], [number, number]]

const token = (name: string) =>
  resolveColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim())

type Colors = {
  visits: readonly string[]
  pending: string
  land: string
}

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

const rgbOf = (color: string) =>
  (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => Number(value) / 255) as Rgb
const inkOn = (fill: string, inks: [string, string]) =>
  contrast(rgbOf(inks[0]), rgbOf(fill)) >= contrast(rgbOf(inks[1]), rgbOf(fill)) ? inks[0] : inks[1]

const inSet = (codes: string[]): GL.ExpressionSpecification => [
  'in',
  ['get', 'id'],
  ['literal', codes],
]

const idIs = (id: string): GL.ExpressionSpecification => ['==', ['get', 'id'], id]

type LabelInput = { shown: string[]; covered: string[]; hovered: string | null }

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

type LabelProperties = {
  id: string
  label: string
  rank: number
  micro: 0 | 1
  edge: 'left' | 'right' | 'center'
}
type LabelData = GeoJSON.FeatureCollection<GeoJSON.Point, LabelProperties>
const emptyLabels: LabelData = { type: 'FeatureCollection', features: [] }

type Shape = {
  box: [number, number, number, number]
  area: number
  point: [number, number]
}

const outerRings = (geometry: GeoJSON.Geometry): GeoJSON.Position[][] =>
  (geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : []
  )
    .map(([outer]) => outer)
    .filter((ring) => ring?.length > 2)

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

const EDGE_ZOOM = 3
const EDGE_LON = 160
const labelFeature = (
  point: [number, number],
  properties: Omit<LabelProperties, 'edge'>,
): GeoJSON.Feature<GeoJSON.Point, LabelProperties> => ({
  type: 'Feature',
  properties: {
    ...properties,
    edge: point[0] > EDGE_LON ? 'right' : point[0] < -EDGE_LON ? 'left' : 'center',
  },
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
  const pageCodes = paging && !cover ? paging.pages[paging.page]?.codes : undefined
  const focus = useMemo(() => {
    if (!pageCodes) return null
    const own = new Set(pageCodes)
    for (const code of recording ?? []) own.add(code)
    return { codes: [...own], off: shown.filter((code) => !own.has(code)) }
  }, [pageCodes, recording, shown])
  const [pageZoom, setPageZoom] = useState<number | null>(null)
  const sticker = useRef<StickerHandle | null>(null)
  const tap = useRef<(id: string, polygon: boolean) => void>(() => {})
  tap.current = (id, polygon) => {
    const handle = sticker.current
    handle?.finish()
    if (cover && paging && paging.pages.length > 1) {
      handle?.dismiss()
      const index = paging.pages.findIndex((page) => page.id !== 'world' && page.codes.includes(id))
      if (index > 0) paging.onPage(index)
      return
    }
    if (quick && polygon && quick.peelable(id) && handle) {
      handle.lift(id)
      return
    }
    if (handle?.dismiss()) return
    onSelect(id)
  }
  useEffect(() => {
    if (!map || !ready) return
    map.setRenderWorldCopies(false)
    map.keyboard.disableRotation()
  }, [map, ready])
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
  const paints = useMemo(
    () => ({
      ...theme,
      fill: stateColor(entries, pending, theme.colors),
      ink: stateColor(entries, pending, theme.inks),
    }),
    [theme, entries, pending],
  )
  const labelInput = useRef<LabelInput>({ shown, covered, hovered: null })

  const shapes = useMemo(() => {
    const byId = new Map<string, Shape>()
    for (const feature of raw?.features ?? []) {
      const id = feature.properties.id
      const found = isCatalogCountry(id) ? largestRing(outerRings(feature.geometry)) : null
      if (found) byId.set(id, found)
    }
    return byId
  }, [raw])
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
    map.addLayer({
      id: ATLAS_LAYERS.pending,
      type: 'line',
      source: 'atlas-countries',
      layout: { visibility: 'none' },
      paint: { 'line-width': 1.6, 'line-dasharray': [2, 2] },
    })
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
    map.addLayer({
      id: ATLAS_LAYERS.labels,
      type: 'symbol',
      source: 'atlas-labels',
      layout: {
        ...text,
        'text-max-width': 7,
        'text-anchor': ['step', ['zoom'], ['get', 'edge'], EDGE_ZOOM, 'center'],
      } as never,
      paint: textPaint,
    })
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
    map.addSource('atlas-region-labels', { type: 'geojson', data: emptyLabels })
    map.addLayer({
      id: ATLAS_LAYERS.regionLabels,
      type: 'symbol',
      source: 'atlas-region-labels',
      layout: { ...text, 'text-size': 13, 'text-max-width': 9 } as never,
      paint: { 'text-halo-width': 1.75 },
    })
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
    for (const layer of [ATLAS_LAYERS.labels, ATLAS_LAYERS.hoverLabel]) {
      map.setPaintProperty(layer, 'text-color', paints.ink as never)
      map.setPaintProperty(layer, 'text-halo-color', paints.fill as never)
    }
    for (const layer of [ATLAS_LAYERS.microLabels, ATLAS_LAYERS.regionLabels]) {
      map.setPaintProperty(layer, 'text-color', paints.text)
      map.setPaintProperty(layer, 'text-halo-color', paints.halo)
    }
  }, [map, ready, raw, paints, pending, shown])
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
  entries: ReadonlyMap<string, number>
  pending: string[]
  name: (code: string) => string
  onSelectCountry: (code: string) => void
  quickVisit?: QuickVisit | null
  fail: () => void
  paging?: AtlasPaging | null
}) {
  return (
    <div className="passport-atlas-stage">
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
