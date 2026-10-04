'use client'

import * as GL from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapCanvas, MapGeoJSON, useMap } from './mapcn'
import { routeGeometry, wrappedBounds } from './geometry'
import type { CountryVisit, MapLocale } from './preview'
import type { ProjectedRoute } from './types'
import { resolveColor } from './resolve-color'
import { BUCKET_LABELS, BUCKET_TOKENS, visitBucket } from '../../lib/map-buckets'

type Countries = GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; name: string; count?: number; claimed?: boolean }>
const asset = '/maps/countries-110m-2.0.2.geojson'
// MapLibre needs resolved colors: read the computed token and let the browser resolve color-mix()/var().
const token = (name: string) => resolveColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim())

function CountriesLayer({ visits, onSelect, fail }: { visits: CountryVisit[]; onSelect?: (id: string) => void; fail: () => void }) {
  const { map, ready, themeRevision } = useMap()
  const [raw, setRaw] = useState<Countries | null>(null)
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    fetch(asset, { signal: controller.signal, cache: 'force-cache' }).then(async response => {
      if (!response.ok) throw new Error('country geometry unavailable')
      return await response.json() as Countries
    }).then(setRaw).catch(() => { if (!controller.signal.aborted) fail() })
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  const data = useMemo(() => {
    if (!raw) return null
    const counts = new Map(visits.map(v => [v.countryCode.toUpperCase(), v]))
    return { type: 'FeatureCollection' as const, features: raw.features.map(f => {
      const value = counts.get(f.properties.id)
      const count = value?.count ?? 0
      return { ...f, properties: { ...f.properties,
        bucket: visitBucket(count),
        claimed: !!value?.claimed } }
    }) }
  }, [raw, visits])
  const paints = useMemo(() => {
    const colors = BUCKET_TOKENS.map(token)
    return { fill: { 'fill-color': ['match', ['get', 'bucket'], 0, colors[0], 1, colors[1], 2, colors[2],
      3, colors[3], colors[4]] } as Record<string, unknown>,
      line: { 'line-color': token('--map-border'), 'line-width': .55 } as Record<string, unknown> }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeRevision])
  useEffect(() => {
    if (!map || !ready || !data || !map.getSource('countries-source')) return
    map.addLayer({ id: 'countries-claims', type: 'line', source: 'countries-source',
      filter: ['==', ['get', 'claimed'], true], paint: { 'line-color': token('--accent-text'),
        'line-width': 1.6, 'line-dasharray': [2, 2] } })
    return () => { if (map.getLayer('countries-claims')) map.removeLayer('countries-claims') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, !!data])
  useEffect(() => { if (map?.getLayer('countries-claims')) map.setPaintProperty('countries-claims', 'line-color', token('--accent-text')) }, [map, themeRevision])
  return data ? <MapGeoJSON id="countries" data={data} fillPaint={paints.fill} linePaint={paints.line}
    onClick={(p, event) => { if (map?.getLayer('routes-hit') && map.queryRenderedFeatures(event.point, { layers: ['routes-hit'] }).length) return
      if (typeof p.id === 'string') onSelect?.(p.id) }} /> : null
}

/** Adapted flightcn great-circle layer usage on mapcn's useMap API. */
function FlightRoutes({ routes, selected, onSelect, locale, viewportKey }: { routes: ProjectedRoute[]; selected: string | null;
  onSelect: (id: string | null) => void; locale: MapLocale; viewportKey: string }) {
  const { map, ready, themeRevision } = useMap()
  const callback = useRef(onSelect); callback.current = onSelect
  const features = useMemo(() => routes.flatMap(r => {
    const geometry = routeGeometry(r)
    return geometry ? [{ type: 'Feature' as const, properties: { id: `${r.origin}-${r.destination}` }, geometry }] : []
  }), [routes])
  const data = useMemo(() => ({ type: 'FeatureCollection' as const, features }), [features])
  const bounds = useMemo(() => wrappedBounds(features.map(f => f.geometry)), [features])
  const fitted = useRef(false)
  useEffect(() => { fitted.current = false }, [viewportKey])
  useEffect(() => {
    if (!map || !ready) return
    map.addSource('routes-source', { type: 'geojson', data: data as never })
    map.addLayer({ id: 'routes-line', type: 'line', source: 'routes-source', paint: {
      'line-color': token('--map-route'), 'line-width': 1.5, 'line-opacity': .8 } })
    map.addLayer({ id: 'routes-selected', type: 'line', source: 'routes-source',
      filter: ['==', ['get', 'id'], ''], paint: { 'line-color': token('--accent-text'), 'line-width': 3 } })
    map.addLayer({ id: 'routes-hit', type: 'line', source: 'routes-source', paint: {
      'line-color': token('--map-route'), 'line-width': 20, 'line-opacity': 0 } })
    const click = (e: GL.MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') callback.current(id) }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', 'routes-hit', click); map.on('mouseenter', 'routes-hit', enter); map.on('mouseleave', 'routes-hit', leave)
    return () => { map.off('click', 'routes-hit', click); map.off('mouseenter', 'routes-hit', enter);
      map.off('mouseleave', 'routes-hit', leave); for (const id of ['routes-hit', 'routes-selected', 'routes-line'])
        if (map.getLayer(id)) map.removeLayer(id); if (map.getSource('routes-source')) map.removeSource('routes-source') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready])
  useEffect(() => { if (map && ready) (map.getSource('routes-source') as GL.GeoJSONSource | undefined)?.setData(data as never) }, [map, ready, data])
  useEffect(() => { if (map?.getLayer('routes-selected')) map.setFilter('routes-selected', ['==', ['get', 'id'], selected ?? '']) }, [map, selected])
  useEffect(() => { if (!map?.getLayer('routes-line')) return
    map.setPaintProperty('routes-line', 'line-color', token('--map-route'))
    map.setPaintProperty('routes-hit', 'line-color', token('--map-route'))
    map.setPaintProperty('routes-selected', 'line-color', token('--accent-text'))
  }, [map, themeRevision])
  useEffect(() => { if (!map || !ready || !bounds || fitted.current) return
    fitted.current = true; map.fitBounds(bounds, { padding: 32, maxZoom: 5, duration: 0 })
  }, [map, ready, bounds])
  function fit() { if (map && bounds) map.fitBounds(bounds, { padding: 32, maxZoom: 5,
    duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 }) }
  return ready ? <div className="route-map-controls">
    <button type="button" onClick={fit}>{locale === 'ru' ? 'Показать все маршруты' : 'Fit routes'}</button>
    <button type="button" aria-label={locale === 'ru' ? 'Приблизить' : 'Zoom in'} onClick={() => map?.zoomIn({ duration: 0 })}>+</button>
    <button type="button" aria-label={locale === 'ru' ? 'Отдалить' : 'Zoom out'} onClick={() => map?.zoomOut({ duration: 0 })}>−</button>
  </div> : null
}

export function FullRouteMap({ routes, visits, locale, viewportKey, selected, onSelect, onSelectCountry }: {
  routes: ProjectedRoute[]; visits: CountryVisit[]; locale: MapLocale; selected: string | null;
  viewportKey: string; onSelect: (id: string | null) => void; onSelectCountry?: (code: string) => void
}) {
  const [failed, setFailed] = useState(false)
  return <div className="route-map-shell">
    {/* Local CSS is requested only when the heavy map island mounts. */}
    {/* eslint-disable-next-line @next/next/no-css-tags */}
    <link rel="stylesheet" href="/maps/maplibre-6.12.0/maplibre-gl.css" />
    {failed ? <div role="status" className="route-map-fallback">{locale === 'ru'
      ? 'Карта недоступна. Маршруты и страны перечислены ниже.'
      : 'Map unavailable. Routes and countries are listed below.'}</div> :
      <MapCanvas onError={() => setFailed(true)}>
        <CountriesLayer visits={visits} onSelect={onSelectCountry} fail={() => setFailed(true)} />
        <FlightRoutes routes={routes} selected={selected} onSelect={onSelect} locale={locale} viewportKey={viewportKey} />
      </MapCanvas>}
    <div className="route-map-legend" role="group" aria-label={locale === 'ru' ? 'Визиты' : 'Visits'}>
      <span className="route-map-legend-title">{locale === 'ru' ? 'Визиты' : 'Visits'}</span>
      <ol>{BUCKET_LABELS[locale].map((label, index) => <li key={label}><span className="route-map-swatch" style={{ background: `var(${BUCKET_TOKENS[index + 1]})` }} aria-hidden="true" />{label}</li>)}</ol>
      <span>{locale === 'ru' ? 'пунктир — отмечено вами' : 'dashed — claimed'}</span>
    </div>
  </div>
}
