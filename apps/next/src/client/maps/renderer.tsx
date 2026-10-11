'use client'

import type * as GL from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Map as MapCanvas, MapGeoJSON, useMap } from './mapcn'
import { WORLD_BOUNDS, routeGeometry, wrappedBounds } from './geometry'
import { LABEL_MIN_ZOOM, LABEL_SIZE, placeLabels, type PlacedLabel } from './labels'
import type { CountryVisit, MapLocale } from './preview'
import type { ProjectedRoute } from './types'
import { resolveColor } from './resolve-color'
import { BUCKET_LABELS, BUCKET_TOKENS, visitBucket } from '../../lib/map-buckets'

/** One encoding per layer: country visit buckets, uniform routes, or routes weighted by flights. */
export type MapLayer = 'countries' | 'routes' | 'frequency'
/** Route line width per flight-count bucket (1, 2–3, 4–9, 10+), the same thresholds as the country ramp. */
export const FREQUENCY_WIDTHS = [1, 2, 3.5, 5] as const

type Countries = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { id: string; name: string; count?: number; claimed?: boolean }
>
const asset = '/maps/countries-110m-2.0.2-r2.geojson'
// MapLibre needs resolved colors: read the computed token and let the browser resolve color-mix()/var().
const token = (name: string) =>
  resolveColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim())

function CountriesLayer({
  visits,
  onSelect,
  fail,
  layer,
}: {
  visits: CountryVisit[]
  onSelect?: (id: string) => void
  fail: () => void
  layer: MapLayer
}) {
  const { map, ready, themeRevision } = useMap()
  const [raw, setRaw] = useState<Countries | null>(null)
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    fetch(asset, { signal: controller.signal, cache: 'force-cache' })
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
  const data = useMemo(() => {
    if (!raw) return null
    const counts = new Map(visits.map((v) => [v.countryCode.toUpperCase(), v]))
    return {
      type: 'FeatureCollection' as const,
      features: raw.features.map((f) => {
        const value = counts.get(f.properties.id)
        return {
          ...f,
          properties: {
            ...f.properties,
            bucket: visitBucket(value?.pending ? 0 : (value?.count ?? 0)),
            claimed: !!value?.claimed,
          },
        }
      }),
    }
  }, [raw, visits])
  const paints = useMemo(() => {
    const colors = BUCKET_TOKENS.map(token)
    // Route layers keep the land neutral so the lines carry the only accent.
    const fill =
      layer === 'countries'
        ? [
            'match',
            ['get', 'bucket'],
            0,
            colors[0],
            1,
            colors[1],
            2,
            colors[2],
            3,
            colors[3],
            colors[4],
          ]
        : colors[0]
    return {
      fill: { 'fill-color': fill } as Record<string, unknown>,
      line: { 'line-color': token('--map-border'), 'line-width': 0.55 } as Record<string, unknown>,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeRevision, layer])
  useEffect(() => {
    if (!map || !ready || !data || !map.getSource('countries-source')) return
    map.addLayer({
      id: 'countries-claims',
      type: 'line',
      source: 'countries-source',
      filter: ['==', ['get', 'claimed'], true],
      paint: { 'line-color': token('--accent-text'), 'line-width': 1.6, 'line-dasharray': [2, 2] },
    })
    return () => {
      if (map.getLayer('countries-claims')) map.removeLayer('countries-claims')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, !!data])
  useEffect(() => {
    if (!map?.getLayer('countries-claims')) return
    map.setPaintProperty('countries-claims', 'line-color', token('--accent-text'))
    map.setLayoutProperty(
      'countries-claims',
      'visibility',
      layer === 'countries' ? 'visible' : 'none',
    )
  }, [map, themeRevision, layer, data])
  return data ? (
    <MapGeoJSON
      id="countries"
      data={data}
      fillPaint={paints.fill}
      linePaint={paints.line}
      onClick={(p, event) => {
        if (
          map?.getLayer('routes-hit') &&
          map.getLayoutProperty('routes-hit', 'visibility') !== 'none' &&
          map.queryRenderedFeatures(event.point, { layers: ['routes-hit'] }).length
        )
          return
        if (typeof p.id === 'string') onSelect?.(p.id)
      }}
    />
  ) : null
}

const ROUTE_LAYERS = ['routes-line', 'routes-selected', 'routes-hit'] as const
const widthExpression: GL.ExpressionSpecification = [
  'match',
  ['get', 'bucket'],
  1,
  FREQUENCY_WIDTHS[0],
  2,
  FREQUENCY_WIDTHS[1],
  3,
  FREQUENCY_WIDTHS[2],
  FREQUENCY_WIDTHS[3],
]

/**
 * Adapted flightcn great-circle routes on mapcn's useMap API, batched: every route is a feature of one GeoJSON
 * source drawn by three line layers (line, selection, hit area), whatever the number of routes.
 */
export function FlightRoutes({
  routes,
  selected,
  onSelect,
  layer,
}: {
  routes: ProjectedRoute[]
  selected: string | null
  onSelect: (id: string | null) => void
  layer: MapLayer
}) {
  const { map, ready, themeRevision } = useMap()
  const callback = useRef(onSelect)
  callback.current = onSelect
  const data = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: routes.flatMap((r) => {
        const geometry = routeGeometry(r)
        return geometry
          ? [
              {
                type: 'Feature' as const,
                properties: { id: `${r.origin}-${r.destination}`, bucket: visitBucket(r.count) },
                geometry,
              },
            ]
          : []
      }),
    }),
    [routes],
  )
  useEffect(() => {
    if (!map || !ready) return
    map.addSource('routes-source', { type: 'geojson', data: data as never })
    map.addLayer({
      id: 'routes-line',
      type: 'line',
      source: 'routes-source',
      paint: { 'line-color': token('--map-route'), 'line-width': 1.5, 'line-opacity': 0.8 },
    })
    map.addLayer({
      id: 'routes-selected',
      type: 'line',
      source: 'routes-source',
      filter: ['==', ['get', 'id'], ''],
      paint: { 'line-color': token('--accent-text'), 'line-width': 3 },
    })
    map.addLayer({
      id: 'routes-hit',
      type: 'line',
      source: 'routes-source',
      paint: { 'line-color': token('--map-route'), 'line-width': 20, 'line-opacity': 0 },
    })
    const click = (e: GL.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') callback.current(id)
    }
    const enter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const leave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', 'routes-hit', click)
    map.on('mouseenter', 'routes-hit', enter)
    map.on('mouseleave', 'routes-hit', leave)
    return () => {
      map.off('click', 'routes-hit', click)
      map.off('mouseenter', 'routes-hit', enter)
      map.off('mouseleave', 'routes-hit', leave)
      for (const id of [...ROUTE_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource('routes-source')) map.removeSource('routes-source')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready])
  useEffect(() => {
    if (map && ready)
      (map.getSource('routes-source') as GL.GeoJSONSource | undefined)?.setData(data as never)
  }, [map, ready, data])
  useEffect(() => {
    if (map?.getLayer('routes-selected'))
      map.setFilter('routes-selected', ['==', ['get', 'id'], selected ?? ''])
  }, [map, ready, selected])
  useEffect(() => {
    if (!map?.getLayer('routes-line')) return
    for (const id of ROUTE_LAYERS)
      map.setLayoutProperty(id, 'visibility', layer === 'countries' ? 'none' : 'visible')
    map.setPaintProperty('routes-line', 'line-width', layer === 'frequency' ? widthExpression : 1.5)
    map.setPaintProperty('routes-line', 'line-color', token('--map-route'))
    map.setPaintProperty('routes-hit', 'line-color', token('--map-route'))
    map.setPaintProperty('routes-selected', 'line-color', token('--accent-text'))
  }, [map, ready, themeRevision, layer])
  return null
}

type Airport = { id: string; coordinates: [number, number]; flights: number }
export function airportsOf(routes: ProjectedRoute[]): Airport[] {
  const airports = new Map<string, Airport>()
  for (const route of routes) {
    for (const [id, point] of [
      [route.origin, route.from],
      [route.destination, route.to],
    ] as const) {
      if (!point || !point.every(Number.isFinite)) continue
      const current = airports.get(id) ?? { id, coordinates: point, flights: 0 }
      current.flights += route.count
      airports.set(id, current)
    }
  }
  return [...airports.values()]
}

/** Airport dots in one batched source; IATA labels are an HTML overlay gated by zoom and collision (labels.ts). */
export function AirportLayer({ routes, layer }: { routes: ProjectedRoute[]; layer: MapLayer }) {
  const { map, ready, themeRevision } = useMap()
  const airports = useMemo(() => airportsOf(routes), [routes])
  const data = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: airports.map((a) => ({
        type: 'Feature' as const,
        properties: { id: a.id },
        geometry: { type: 'Point' as const, coordinates: a.coordinates },
      })),
    }),
    [airports],
  )
  const [labels, setLabels] = useState<PlacedLabel[]>([])
  const labelNodes = useRef(new Map<string, HTMLSpanElement>())
  const placed = useRef<PlacedLabel[]>([])
  useEffect(() => {
    if (!map || !ready) return
    map.addSource('airports-source', { type: 'geojson', data: data as never })
    map.addLayer({
      id: 'airports-dot',
      type: 'circle',
      source: 'airports-source',
      paint: {
        'circle-radius': 3,
        'circle-color': token('--map-route'),
        'circle-stroke-width': 1,
        'circle-stroke-color': token('--surface'),
      },
    })
    return () => {
      if (map.getLayer('airports-dot')) map.removeLayer('airports-dot')
      if (map.getSource('airports-source')) map.removeSource('airports-source')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready])
  useEffect(() => {
    if (map && ready)
      (map.getSource('airports-source') as GL.GeoJSONSource | undefined)?.setData(data as never)
  }, [map, ready, data])
  useEffect(() => {
    if (!map?.getLayer('airports-dot')) return
    map.setLayoutProperty('airports-dot', 'visibility', layer === 'countries' ? 'none' : 'visible')
    map.setPaintProperty('airports-dot', 'circle-color', token('--map-route'))
    map.setPaintProperty('airports-dot', 'circle-stroke-color', token('--surface'))
  }, [map, ready, themeRevision, layer])
  useEffect(() => {
    if (!map || !ready || layer === 'countries') {
      placed.current = []
      setLabels([])
      return
    }
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const container = map.getContainer()
        const zoom = map.getZoom()
        const next =
          zoom < LABEL_MIN_ZOOM
            ? []
            : placeLabels(
                airports.map((a) => {
                  const p = map.project(a.coordinates)
                  return { id: a.id, x: p.x, y: p.y, priority: a.flights }
                }),
                zoom,
                { width: container.clientWidth, height: container.clientHeight },
              )
        const changed =
          next.length !== placed.current.length ||
          next.some((label, index) => label.id !== placed.current[index].id)
        placed.current = next
        if (changed) setLabels(next)
        else
          for (const label of next) {
            const node = labelNodes.current.get(label.id)
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
  }, [map, ready, airports, layer])
  return labels.length ? (
    <div className="route-map-labels" aria-hidden="true">
      {labels.map((label) => (
        <span
          key={label.id}
          ref={(node) => {
            if (node) {
              labelNodes.current.set(label.id, node)
              const position = placed.current.find((item) => item.id === label.id) ?? label
              node.style.transform = `translate(${position.x}px, ${position.y}px)`
            } else labelNodes.current.delete(label.id)
          }}
          style={{
            transform: `translate(${label.x}px, ${label.y}px)`,
            width: LABEL_SIZE.width,
            height: LABEL_SIZE.height,
            lineHeight: `${LABEL_SIZE.height}px`,
          }}
        >
          {label.id}
        </span>
      ))}
    </div>
  ) : null
}

function Controls({
  routes,
  layer,
  locale,
  viewportKey,
}: {
  routes: ProjectedRoute[]
  layer: MapLayer
  locale: MapLocale
  viewportKey: string
}) {
  const { map, ready } = useMap()
  const bounds = useMemo(
    () =>
      wrappedBounds(
        routes.flatMap((route) => {
          const g = routeGeometry(route)
          return g ? [g] : []
        }),
      ),
    [routes],
  )
  const fitted = useRef<string | null>(null)
  const motion = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450)
  // First view per owner/period: the whole world for countries, the routes for route layers. Later data keeps the viewport.
  useEffect(() => {
    if (!map || !ready || fitted.current === viewportKey) return
    fitted.current = viewportKey
    map.fitBounds(layer !== 'countries' && bounds ? bounds : WORLD_BOUNDS, {
      padding: 16,
      maxZoom: 5,
      duration: 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, viewportKey, bounds])
  if (!ready) return null
  const ru = locale === 'ru'
  return (
    <div className="route-map-controls">
      {layer !== 'countries' && bounds ? (
        <button
          type="button"
          onClick={() => map?.fitBounds(bounds, { padding: 32, maxZoom: 5, duration: motion() })}
        >
          {ru ? 'Показать все маршруты' : 'Fit routes'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => map?.fitBounds(WORLD_BOUNDS, { padding: 16, duration: motion() })}
      >
        {ru ? 'Весь мир' : 'Whole world'}
      </button>
      <button
        type="button"
        aria-label={ru ? 'Приблизить' : 'Zoom in'}
        onClick={() => map?.zoomIn({ duration: 0 })}
      >
        +
      </button>
      <button
        type="button"
        aria-label={ru ? 'Отдалить' : 'Zoom out'}
        onClick={() => map?.zoomOut({ duration: 0 })}
      >
        −
      </button>
    </div>
  )
}

function ReadySignal({ onReady }: { onReady?: () => void }) {
  const { ready } = useMap()
  useEffect(() => {
    if (ready) onReady?.()
  }, [ready, onReady])
  return null
}

export function FullRouteMap({
  routes,
  visits,
  locale,
  viewportKey,
  selected,
  onSelect,
  onSelectCountry,
  layer = 'countries',
  placeholder,
}: {
  routes: ProjectedRoute[]
  visits: CountryVisit[]
  locale: MapLocale
  selected: string | null
  viewportKey: string
  onSelect: (id: string | null) => void
  onSelectCountry?: (code: string) => void
  layer?: MapLayer
  /** Shown in the map's place until the first frame is ready, and instead of it after a failure. */
  placeholder?: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const fail = () => setFailed(true)
  const ru = locale === 'ru'
  return (
    <div className="route-map-shell">
      {/* Local CSS is requested only when the heavy map island mounts. */}
      {/* oxlint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/maps/maplibre-6.13.0/maplibre-gl.css" />
      {failed ? (
        <>
          <p role="status" className="route-map-note">
            {ru
              ? 'Карта недоступна. Маршруты и страны перечислены ниже.'
              : 'Map unavailable. Routes and countries are listed below.'}
          </p>
          {placeholder}
        </>
      ) : (
        <div className="route-map-stage" data-ready={ready}>
          {ready ? null : <div className="route-map-placeholder-layer">{placeholder}</div>}
          <MapCanvas onError={fail} locale={locale}>
            <ReadySignal onReady={() => setReady(true)} />
            <CountriesLayer visits={visits} onSelect={onSelectCountry} fail={fail} layer={layer} />
            <FlightRoutes routes={routes} selected={selected} onSelect={onSelect} layer={layer} />
            <AirportLayer routes={routes} layer={layer} />
            <Controls routes={routes} layer={layer} locale={locale} viewportKey={viewportKey} />
          </MapCanvas>
        </div>
      )}
      {layer === 'countries' ? (
        <div className="route-map-legend" role="group" aria-label={ru ? 'Визиты' : 'Visits'}>
          <span className="route-map-legend-title">{ru ? 'Визиты' : 'Visits'}</span>
          <ol>
            {BUCKET_LABELS[locale].map((label, index) => (
              <li key={label}>
                <span
                  className="route-map-swatch"
                  style={{ background: `var(${BUCKET_TOKENS[index + 1]})` }}
                  aria-hidden="true"
                />
                {label}
              </li>
            ))}
          </ol>
          <span>{ru ? 'пунктир — без перелётов' : 'dashed — no flights'}</span>
        </div>
      ) : layer === 'frequency' ? (
        <div
          className="route-map-legend"
          role="group"
          aria-label={ru ? 'Перелётов по маршруту' : 'Flights per route'}
        >
          <span className="route-map-legend-title">
            {ru ? 'Перелётов по маршруту' : 'Flights per route'}
          </span>
          <ol>
            {BUCKET_LABELS[locale].map((label, index) => (
              <li key={label}>
                <span
                  className="route-map-line"
                  style={{ height: FREQUENCY_WIDTHS[index] }}
                  aria-hidden="true"
                />
                {label}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="route-map-legend" role="group" aria-label={ru ? 'Маршруты' : 'Routes'}>
          <span className="route-map-legend-title">{ru ? 'Маршруты' : 'Routes'}</span>
          <span>
            <span className="route-map-line" style={{ height: 2 }} aria-hidden="true" />{' '}
            {ru ? 'по дуге большого круга' : 'great-circle path'}
          </span>
        </div>
      )}
    </div>
  )
}
