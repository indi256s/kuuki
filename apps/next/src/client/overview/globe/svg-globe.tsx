'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { geoDistance, geoInterpolate, geoOrthographic, geoPath, type ExtendedFeatureCollection } from 'd3-geo'
import { coordinates } from '@kuuki/shared/geo'
import type { GlobeData } from '@kuuki/shared/overview/globe'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { formatCount, formatNumber, type Locale } from '../../../lib/format'
import { BUCKET_TOKENS, visitBucket } from '../../../lib/map-buckets'
import { routeGeometry } from '../../maps/geometry'
import { forms, S, t } from '../copy'
import './globe.css'

export type GlobeLand = ExtendedFeatureCollection
export type SvgGlobeProps = {
  globe: GlobeData
  all: GlobeData
  airports: OverviewPayload['refs']['airports']
  /** Desired center in longitude/latitude, not D3's inverse rotation. */
  rotate?: [number, number]
  size: number
  locale: Locale
  land?: GlobeLand
  staticPlanes?: boolean
  maker?: NonNullable<OverviewFilter['makers']>[number]
}

function countryCode(feature: GlobeLand['features'][number]): string {
  return String(feature.id ?? feature.properties?.id ?? '')
}

export function isLand(value: unknown): value is GlobeLand {
  if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'FeatureCollection' ||
    !('features' in value) || !Array.isArray(value.features) || value.features.length !== 174) return false
  const codes = new Set<string>()
  const ring = (value: unknown): boolean => Array.isArray(value) && value.length >= 4 && value.every(point =>
    Array.isArray(point) && point.length >= 2 && typeof point[0] === 'number' && typeof point[1] === 'number' &&
    Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90) &&
    value[0][0] === value.at(-1)[0] && value[0][1] === value.at(-1)[1]
  const polygon = (value: unknown): boolean => Array.isArray(value) && value.length > 0 && value.every(ring)
  return value.features.every(feature => {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) return false
    const code = countryCode(feature)
    if (!/^[A-Z]{2}$/.test(code) || codes.has(code)) return false
    codes.add(code)
    const geometry = feature.geometry
    return geometry.type === 'Polygon' ? polygon(geometry.coordinates) : geometry.type === 'MultiPolygon' &&
      Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(polygon)
  })
}

export const SvgGlobe = memo(function SvgGlobe({ globe, all, airports, rotate, size, locale, land, staticPlanes = false, maker }: SvgGlobeProps) {
  const mapHost = useRef<HTMLDivElement>(null)
  const [measuredSize, setMeasuredSize] = useState<number | null>(null)
  const renderSize = measuredSize ?? size
  useEffect(() => {
    const element = mapHost.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let retired = false
    const measure = (width: number) => {
      if (!retired && Number.isFinite(width) && width > 18) setMeasuredSize(width)
    }
    const observer = new ResizeObserver(entries => {
      const entry = entries.find(entry => entry.target === element)
      if (entry) measure(entry.contentRect.width)
    })
    const retire = () => { retired = true; observer.disconnect() }
    observer.observe(element)
    measure(element.getBoundingClientRect().width)
    window.addEventListener('kuuki:identity-reset', retire)
    return () => { retired = true; observer.disconnect(); window.removeEventListener('kuuki:identity-reset', retire) }
  }, [])
  const [mountedLand, setMountedLand] = useState<GlobeLand | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const retire = () => controller.abort()
    window.addEventListener('kuuki:identity-reset', retire)
    async function load() {
      try {
        const value: unknown = land ?? await (async () => {
          const response = await fetch('/maps/countries-110m-2.0.2.geojson', { signal: controller.signal })
          return response.ok ? response.json() : null
        })()
        if (!controller.signal.aborted && isLand(value)) setMountedLand(value)
      } catch {
        // The sphere and real routes remain useful when the public atlas is unavailable.
      }
    }
    void load()
    return () => { retire(); window.removeEventListener('kuuki:identity-reset', retire) }
  }, [land])

  const allRoutes = useMemo(() => new Map(all.routes.map(route => [route.key, route])), [all.routes])
  const selectedRoutes = new Map(globe.routes.map(route => [route.key, route]))
  const ghostRoutes = globe.ghostRoutes.flatMap(key => {
    const route = allRoutes.get(key)
    return route ? [route] : []
  })
  const longitude = rotate?.[0] ?? globe.centroid?.lon ?? 0
  // A null centroid uses the stable Greenwich/equator view, without inventing travel coordinates.
  const latitude = rotate?.[1] ?? globe.centroid?.lat ?? 0
  const layers = useMemo(() => {
    const projection = geoOrthographic().rotate([-longitude, -latitude])
      .fitExtent([[9, 9], [renderSize - 9, renderSize - 9]], { type: 'Sphere' })
    const path = geoPath(projection).pointRadius(2.5)
    const point = (iata: string): [number, number] | null => {
      const ref = coordinates(airports[iata])
      return ref ? [ref.lon, ref.lat] : null
    }
    const arcs = (routes: GlobeData['routes']) => routes.flatMap(route => {
      const geometry = routeGeometry({ from: point(route.a), to: point(route.b) })
      const d = geometry && path(geometry)
      return d ? [{ ...route, d }] : []
    })
    const features = (mountedLand?.features ?? []).flatMap(feature => {
      const d = path(feature)
      return d ? [{ code: countryCode(feature), d }] : []
    })
    const dots = globe.airports.flatMap(airport => {
      const position = point(airport.iata)
      const d = position && path({ type: 'Point', coordinates: position })
      return d ? [{ key: airport.iata, d }] : []
    })
    return { sphere: path({ type: 'Sphere' })!, features, dots,
      selected: arcs(globe.routes), background: arcs(globe.ghostRoutes.flatMap(key => {
        const route = allRoutes.get(key)
        return route ? [route] : []
      })) }
  }, [globe, allRoutes, airports, longitude, latitude, mountedLand, renderSize])
  const visits = new Map(globe.countries.map(country => [country.code, country.visits]))
  const ghostCountries = new Set(globe.ghostCountries)

  const staticGlyphs = useMemo(() => {
    if (!staticPlanes) return []
    const projection = geoOrthographic().rotate([-longitude, -latitude]).fitExtent([[9, 9], [renderSize - 9, renderSize - 9]], { type: 'Sphere' })
    return globe.routes.flatMap(route => {
      const from = coordinates(airports[route.a]), to = coordinates(airports[route.b])
      if (!from || !to || !routeGeometry({ from: [from.lon, from.lat], to: [to.lon, to.lat] })) return []
      const interpolate = geoInterpolate([from.lon, from.lat], [to.lon, to.lat]), midpoint = interpolate(.5)
      if (geoDistance([longitude, latitude], midpoint) > Math.PI / 2) return []
      const position = projection(midpoint), next = projection(interpolate(.505))
      if (!position || !next) return []
      return [{ key: route.key, position, angle: Math.atan2(next[0] - position[0], position[1] - next[1]) * 180 / Math.PI }]
    })
  }, [staticPlanes, longitude, latitude, renderSize, globe.routes, airports])

  const labels = locale === 'ru'
    ? { table: 'Данные глобуса', view: 'Показать таблицу', kind: 'Показатель', code: 'Код', selected: 'Выбрано', all: 'Всё время', route: 'Маршрут · перелёты', airport: 'Аэропорт · посещения', country: 'Страна · посещения', background: 'Фон' }
    : { table: 'Globe data', view: 'View as table', kind: 'Measure', code: 'Code', selected: 'Selected', all: 'All time', route: 'Route · flights', airport: 'Airport · visits', country: 'Country · visits', background: 'Background' }
  const rows = [
    ...[...globe.routes, ...ghostRoutes].map(route => [labels.route, `${route.a}–${route.b}`, selectedRoutes.get(route.key)?.count ?? 0, allRoutes.get(route.key)?.count ?? 0] as const),
    ...globe.airports.map(airport => [labels.airport, airport.iata, airport.count, all.airports.find(item => item.iata === airport.iata)?.count ?? 0] as const),
    ...[...globe.countries.map(country => country.code), ...globe.ghostCountries].map(code => [labels.country, code, globe.countries.find(item => item.code === code)?.visits ?? 0, all.countries.find(item => item.code === code)?.visits ?? 0] as const),
  ]
  return <div className="svg-globe">
    <div ref={mapHost} className="svg-globe-map">
      <svg className="globe-svg" viewBox={`0 0 ${renderSize} ${renderSize}`} role="img" aria-label={t(S.map, locale)}>
        <g className="globe-rim"><path d={layers.sphere} fill="var(--surface-inset)" stroke="var(--globe-rim)" strokeWidth={16} /></g>
        <g className="globe-sphere"><path d={layers.sphere} fill="var(--surface-inset)" stroke="var(--hairline)" strokeWidth={1} /></g>
        <g className="globe-land globe-detail">{layers.features.map(feature => <path key={feature.code} d={feature.d} fill="var(--map-land)" stroke="var(--map-border)" strokeWidth={0.5} />)}</g>
        <g className="globe-countries globe-detail">{layers.features.filter(feature => visits.has(feature.code)).map(feature => <path key={feature.code} d={feature.d} fill={`var(${BUCKET_TOKENS[visitBucket(visits.get(feature.code)!)]})`} />)}</g>
        <g className="globe-ghost-countries globe-detail">{layers.features.filter(feature => ghostCountries.has(feature.code)).map(feature => <path key={feature.code} d={feature.d} fill="var(--mark-ghost)" opacity={0.15} />)}</g>
        <g className="globe-ghost-routes globe-detail">{layers.background.map(route => <path key={route.key} d={route.d} fill="none" stroke="var(--mark-ghost)" strokeWidth={Math.min(3, visitBucket(route.count))} opacity={0.15} />)}</g>
        <g className="globe-routes globe-detail">{layers.selected.map(route => <path key={route.key} d={route.d} fill="none" stroke={`var(${maker ? `--cat-maker-${maker}` : BUCKET_TOKENS[visitBucket(route.count)]})`} strokeWidth={Math.min(3, visitBucket(route.count))} />)}</g>
        <g className="globe-airports globe-detail">{layers.dots.map(dot => <path key={dot.key} d={dot.d} fill="var(--mark-1)" />)}</g>
      </svg>
      {staticGlyphs.length > 0 && <svg className="globe-static-planes" viewBox={`0 0 ${renderSize} ${renderSize}`} aria-hidden="true">
        {staticGlyphs.map(plane => <g key={plane.key} transform={`translate(${plane.position[0]} ${plane.position[1]}) rotate(${plane.angle})`}>
          {/* flightcn north-pointing icon, MIT; maps/licenses/flightcn.LICENSE. */}
          <path transform="translate(-9.6 -9.6) scale(.8)" fill={`var(${maker ? `--cat-maker-${maker}` : '--mark-1'})`} d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </g>)}
      </svg>}
    </div>
    <details className="svg-globe-data">
      <summary>{labels.view}</summary>
      <p>{labels.selected}: {formatCount(locale, globe.routes.length, forms.routes)}. {labels.background}: {formatCount(locale, ghostRoutes.length, forms.routes)}.</p>
      <table>
        <caption>{labels.table}</caption>
        <thead><tr><th scope="col">{labels.kind}</th><th scope="col">{labels.code}</th><th scope="col">{labels.selected}</th><th scope="col">{labels.all}</th></tr></thead>
        <tbody>{rows.map(([kind, code, selected, total]) => <tr key={`${kind}:${code}`}><td>{kind}</td><td>{code}</td><td>{formatNumber(locale, selected)}</td><td>{formatNumber(locale, total)}</td></tr>)}</tbody>
      </table>
    </details>
  </div>
})
