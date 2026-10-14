'use client'

import type * as GL from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { WORLD_BOUNDS } from '../../maps/geometry'
import { Map as MapCanvas, useMap } from '../../maps/mapcn'
import { resolveColor } from '../../maps/resolve-color'
import type { Locale } from '../../../lib/format'
import { isCatalogCountry } from '../model'
import { SMALL_STATE_POINTS } from './small-states'
import './atlas.css'

const GEOMETRY = '/maps/countries-110m-2.0.2-r2.geojson'
/** Pinned to the ids of the layers below so queries and tests name them in one place. */
export const ATLAS_LAYERS = {
  fill: 'atlas-fill',
  outline: 'atlas-outline',
  pending: 'atlas-pending',
  dot: 'atlas-points-dot',
  hit: 'atlas-points-hit',
} as const
/** A 22px radius is a 44px disc: the minimum touch target for a point marker. */
const HIT_RADIUS = 22
const COUNTRY_LABEL_ZOOM = 2
const POINT_LABEL_ZOOM = 3.5

type Countries = GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; name: string }>

// MapLibre needs resolved colors: read the computed token and let the browser resolve color-mix()/var().
const token = (name: string) =>
  resolveColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim())

/** `match` over ISO2 ids; MapLibre rejects an empty label list, so an empty set contributes no branch. */
const stateColor = (
  visited: string[],
  pending: string[],
  colors: { visited: string; pending: string; land: string },
): GL.ExpressionSpecification | string => {
  const branches: (string | string[])[] = []
  if (visited.length) branches.push(visited, colors.visited)
  if (pending.length) branches.push(pending, colors.pending)
  return branches.length
    ? (['match', ['get', 'id'], ...branches, colors.land] as unknown as GL.ExpressionSpecification)
    : colors.land
}

const pendingFilter = (codes: string[]): GL.FilterSpecification => [
  'in',
  ['get', 'id'],
  ['literal', codes],
]

const pointData: GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }> = {
  type: 'FeatureCollection',
  features: Object.entries(SMALL_STATE_POINTS).map(([id, coordinates]) => ({
    type: 'Feature',
    properties: { id },
    geometry: { type: 'Point', coordinates },
  })),
}

/** Longest-ring bounding-box centre: cheap, and good enough for a decluttered name label. */
function centre(geometry: GeoJSON.Geometry): { point: [number, number]; area: number } | null {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  let best: { point: [number, number]; area: number } | null = null
  for (const [ring] of polygons) {
    if (!ring?.length) continue
    const xs = ring.map((p) => p[0]),
      ys = ring.map((p) => p[1])
    const west = Math.min(...xs),
      east = Math.max(...xs),
      south = Math.min(...ys),
      north = Math.max(...ys)
    const area = (east - west) * (north - south)
    if (!best || area > best.area) best = { point: [(west + east) / 2, (south + north) / 2], area }
  }
  return best
}

type LabelSite = {
  id: string
  point: [number, number]
  /** Larger shows first; visited and pending outrank land area. */
  rank: number
  minZoom: number
}
type PlacedLabel = { id: string; x: number; y: number; width: number }
const LABEL_HEIGHT = 16
const labelWidth = (text: string) => Math.min(140, text.length * 6.4 + 8)

function AtlasLayers({
  entries,
  pending,
  name,
  onSelect,
  fail,
}: {
  entries: string[]
  pending: string[]
  name: (code: string) => string
  onSelect: (code: string) => void
  fail: () => void
}) {
  const { map, ready, themeRevision } = useMap()
  const [raw, setRaw] = useState<Countries | null>(null)
  const select = useRef(onSelect)
  select.current = onSelect
  useEffect(() => {
    if (!ready) return
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
  }, [ready])

  // Visited wins over pending for the same code (match takes the first branch).
  const paints = useMemo(() => {
    const colors = {
      visited: token('--accent'),
      pending: token('--accent-tint'),
      land: token('--map-land'),
    }
    return {
      fill: stateColor(entries, pending, colors),
      dot: stateColor(entries, pending, colors),
      border: token('--map-border'),
      pendingLine: token('--accent-text'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, pending, themeRevision])
  const latest = useRef(paints)
  latest.current = paints
  const pendingCodes = useRef(pending)
  pendingCodes.current = pending

  useEffect(() => {
    if (!map || !ready || !raw) return
    const now = latest.current
    map.addSource('atlas-countries', { type: 'geojson', data: raw })
    map.addSource('atlas-points', { type: 'geojson', data: pointData })
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
    map.addLayer({
      id: ATLAS_LAYERS.dot,
      type: 'circle',
      source: 'atlas-points',
      paint: {
        'circle-radius': 5,
        'circle-color': now.dot as never,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': now.border,
      },
    })
    map.addLayer({
      id: ATLAS_LAYERS.hit,
      type: 'circle',
      source: 'atlas-points',
      paint: { 'circle-radius': HIT_RADIUS, 'circle-color': now.dot as never, 'circle-opacity': 0 },
    })
    // A marker beats the polygon under it; where 44px targets overlap (European microstates at world zoom), the
    // marker nearest the pointer wins rather than whichever the renderer lists first.
    const pick = (event: GL.MapMouseEvent) => {
      let best: { id: unknown; distance: number } | null = null
      for (const feature of map.queryRenderedFeatures(event.point, {
        layers: [ATLAS_LAYERS.hit],
      })) {
        const id = feature.properties?.id
        const point = typeof id === 'string' ? SMALL_STATE_POINTS[id] : undefined
        if (!point) continue
        const { x, y } = map.project(point)
        const distance = Math.hypot(x - event.point.x, y - event.point.y)
        if (!best || distance < best.distance) best = { id, distance }
      }
      return (
        best?.id ??
        map.queryRenderedFeatures(event.point, { layers: [ATLAS_LAYERS.fill] })[0]?.properties?.id
      )
    }
    const click = (event: GL.MapMouseEvent) => {
      const id = pick(event)
      if (typeof id === 'string' && isCatalogCountry(id)) select.current(id)
    }
    const hover = (event: GL.MapMouseEvent) => {
      const id = pick(event)
      map.getCanvas().style.cursor = typeof id === 'string' && isCatalogCountry(id) ? 'pointer' : ''
    }
    map.on('click', click)
    map.on('mousemove', hover)
    return () => {
      map.off('click', click)
      map.off('mousemove', hover)
      for (const id of Object.values(ATLAS_LAYERS).reverse())
        if (map.getLayer(id)) map.removeLayer(id)
      for (const id of ['atlas-points', 'atlas-countries'])
        if (map.getSource(id)) map.removeSource(id)
    }
  }, [map, ready, raw])

  useEffect(() => {
    if (!map || !ready || !map.getLayer(ATLAS_LAYERS.fill)) return
    map.setPaintProperty(ATLAS_LAYERS.fill, 'fill-color', paints.fill as never)
    map.setPaintProperty(ATLAS_LAYERS.outline, 'line-color', paints.border)
    map.setPaintProperty(ATLAS_LAYERS.pending, 'line-color', paints.pendingLine)
    map.setFilter(ATLAS_LAYERS.pending, pendingFilter(pending))
    map.setLayoutProperty(ATLAS_LAYERS.pending, 'visibility', pending.length ? 'visible' : 'none')
    map.setPaintProperty(ATLAS_LAYERS.dot, 'circle-color', paints.dot as never)
    map.setPaintProperty(ATLAS_LAYERS.dot, 'circle-stroke-color', paints.border)
  }, [map, ready, raw, paints, pending])

  const sites = useMemo<LabelSite[]>(() => {
    const visited = new Set(entries),
      awaiting = new Set(pending)
    const standing = (id: string) => (visited.has(id) ? 2 : awaiting.has(id) ? 1 : 0)
    const polygons = (raw?.features ?? []).flatMap((feature) => {
      const id = feature.properties.id
      const found = isCatalogCountry(id) ? centre(feature.geometry) : null
      return found
        ? [
            {
              id,
              point: found.point,
              rank: standing(id) * 1e6 + found.area,
              minZoom: COUNTRY_LABEL_ZOOM,
            },
          ]
        : []
    })
    const points = Object.entries(SMALL_STATE_POINTS).map(([id, point]) => ({
      id,
      point,
      rank: standing(id) * 1e6,
      minZoom: POINT_LABEL_ZOOM,
    }))
    return [...polygons, ...points]
  }, [raw, entries, pending])
  return <Labels sites={sites} name={name} />
}

/** Name labels as an HTML overlay (the blank style has no glyphs), gated by zoom and collision. */
function Labels({ sites, name }: { sites: LabelSite[]; name: (code: string) => string }) {
  const { map, ready } = useMap()
  const [labels, setLabels] = useState<PlacedLabel[]>([])
  const nodes = useRef(new Map<string, HTMLSpanElement>())
  const placed = useRef<PlacedLabel[]>([])
  useEffect(() => {
    if (!map || !ready) return
    const ordered = [...sites].sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const zoom = map.getZoom()
        const container = map.getContainer()
        const boxes: [number, number, number, number][] = []
        const next: PlacedLabel[] = []
        for (const site of ordered) {
          if (next.length >= 60) break
          if (zoom < site.minZoom) continue
          const { x, y } = map.project(site.point)
          const width = labelWidth(name(site.id))
          const left = x - width / 2,
            top = y + 8
          const box: [number, number, number, number] = [
            left,
            top,
            left + width,
            top + LABEL_HEIGHT,
          ]
          if (
            box[0] < 0 ||
            box[1] < 0 ||
            box[2] > container.clientWidth ||
            box[3] > container.clientHeight
          )
            continue
          if (
            boxes.some(
              (other) =>
                box[0] < other[2] + 2 &&
                other[0] < box[2] + 2 &&
                box[1] < other[3] + 2 &&
                other[1] < box[3] + 2,
            )
          )
            continue
          boxes.push(box)
          next.push({ id: site.id, x: left, y: top, width })
        }
        const changed =
          next.length !== placed.current.length ||
          next.some((label, index) => label.id !== placed.current[index].id)
        placed.current = next
        if (changed) setLabels(next)
        else
          for (const label of next) {
            const node = nodes.current.get(label.id)
            if (node) node.style.transform = `translate(${label.x}px, ${label.y}px)`
          }
      })
    }
    update()
    map.on('move', update)
    return () => {
      cancelAnimationFrame(frame)
      map.off('move', update)
    }
  }, [map, ready, sites, name])
  return labels.length ? (
    <div className="passport-atlas-labels" aria-hidden="true">
      {labels.map((label) => (
        <span
          key={label.id}
          ref={(node) => {
            if (node) {
              nodes.current.set(label.id, node)
              const position = placed.current.find((item) => item.id === label.id) ?? label
              node.style.transform = `translate(${position.x}px, ${position.y}px)`
            } else nodes.current.delete(label.id)
          }}
          style={{
            transform: `translate(${label.x}px, ${label.y}px)`,
            width: label.width,
            height: LABEL_HEIGHT,
            lineHeight: `${LABEL_HEIGHT}px`,
          }}
        >
          {name(label.id)}
        </span>
      ))}
    </div>
  ) : null
}

const STRINGS = {
  en: { in: 'Zoom in', out: 'Zoom out', world: 'Whole world' },
  ru: { in: 'Приблизить', out: 'Отдалить', world: 'Весь мир' },
} as const

/** Buttons are the keyboard path for zoom and reset; motion is a jump, so reduced motion needs no branch. */
function Controls({ locale }: { locale: Locale }) {
  const { map, ready } = useMap()
  useEffect(() => {
    if (!map || !ready) return
    // One world: repeated copies would draw a visited country twice beside the single list entry.
    map.setRenderWorldCopies(false)
    map.fitBounds(WORLD_BOUNDS, { padding: 16, duration: 0 })
  }, [map, ready])
  if (!ready) return null
  const text = STRINGS[locale]
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
        onClick={() => map?.fitBounds(WORLD_BOUNDS, { padding: 16, duration: 0 })}
      >
        {text.world}
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
  fail,
}: {
  locale: Locale
  entries: string[]
  pending: string[]
  name: (code: string) => string
  onSelectCountry: (code: string) => void
  fail: () => void
}) {
  return (
    <div className="passport-atlas-stage">
      {/* Local CSS is requested only when the heavy map island mounts. */}
      {/* oxlint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/maps/maplibre-6.13.0/maplibre-gl.css" />
      <MapCanvas onError={fail} locale={locale} className="passport-atlas-canvas">
        <AtlasLayers
          entries={entries}
          pending={pending}
          name={name}
          onSelect={onSelectCountry}
          fail={fail}
        />
        <Controls locale={locale} />
      </MapCanvas>
    </div>
  )
}
