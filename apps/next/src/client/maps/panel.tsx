'use client'

import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'
import { CountryPreview, type CountryVisit, type MapLocale } from './preview'
import { useRouteProjection } from './projection'
import type { MapLayer } from './renderer'
import { hasDrawableEndpoints } from './types'
import './map.css'

export { CountryPreview } from './preview'
export type { MapLayer } from './renderer'

// The interactive island (MapLibre, ~0.5 MB) is fetched only when the map is opened; until it is ready, and
// whenever WebGL, the worker or the geometry fails, the light SVG preview and the lists stay in its place.
const FullRouteMap = lazy(() => import('./renderer').then(mod => ({ default: mod.FullRouteMap })))

type Props = {
  ownerId: string
  locale: MapLocale
  period?: 'all' | `${number}`
  countryVisits?: CountryVisit[] | Record<string, number>
  onSelectCountry?: (code: string) => void
  initiallyOpen?: boolean
  revision: number
  publishedRevision: number
  onRefresh: () => void
  /** Controlled layer; with `onLayerChange` the panel shows the labelled layer switch. */
  layer?: MapLayer
  onLayerChange?: (layer: MapLayer) => void
  /** Extra text for a country list item (e.g. "waiting for confirmation"). */
  describeCountry?: (visit: CountryVisit) => ReactNode
}

const LAYER_LABELS: Record<MapLayer, Record<MapLocale, string>> = {
  countries: { en: 'Countries', ru: 'Страны' },
  routes: { en: 'Routes', ru: 'Маршруты' },
  frequency: { en: 'Frequency', ru: 'Частота' },
}

export function RouteMapPanel({ ownerId, locale, period = 'all', countryVisits = [], onSelectCountry, initiallyOpen = false, revision, publishedRevision, onRefresh, layer = 'countries', onLayerChange, describeCountry }: Props) {
  const [open, setOpen] = useState(initiallyOpen)
  const [selected, setSelected] = useState<string | null>(null)
  const ru = locale === 'ru'
  const visits = useMemo<CountryVisit[]>(() => Array.isArray(countryVisits) ? countryVisits :
    Object.entries(countryVisits).map(([countryCode, count]) => ({ countryCode, count })), [countryVisits])
  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale])
  const { loaded: loadedProjection, current: currentProjection, mismatched, failed, retry } =
    useRouteProjection({ ownerId, period, revision, publishedRevision, enabled: open, onStale: onRefresh })

  // Geometry and list share one undirected pair; period counts come from the server's transit policy.
  const routes = useMemo(() => currentProjection?.pairs.map(pair => ({
    origin: pair.a, destination: pair.b, originCountry: pair.aCountry, destinationCountry: pair.bCountry,
    count: pair.count, lastDate: pair.lastDate, from: pair.from, to: pair.to,
  })) ?? [], [currentProjection])
  const mapVisits = useMemo<CountryVisit[]>(() => {
    if (!currentProjection?.countries) return visits
    const claims = new Map(visits.filter(visit => visit.claimed).map(visit => [visit.countryCode, visit]))
    const countries = currentProjection.countries.map(country => ({ countryCode: country.id, count: country.visits + (claims.get(country.id)?.groundCount ?? 0),
      pending: country.pending && !claims.has(country.id), claimed: claims.has(country.id) }))
    const codes = new Set(countries.map(country => country.countryCode))
    return [...countries, ...[...claims.values()].filter(visit => !codes.has(visit.countryCode)).map(visit => ({ ...visit, count: visit.groundCount ?? 0, pending: false }))]
  }, [currentProjection, visits])
  const yearView = period !== 'all' && !!currentProjection
  const preview = <CountryPreview countryIds={mapVisits.filter(visit => !visit.pending).map(visit => visit.countryCode)} locale={locale}
    period={yearView ? period : 'all'} visits={mapVisits} />
  const showRoutes = layer !== 'countries'

  return <section aria-label={ru ? 'Карта' : 'Map'} className="route-map-panel">
    <div className="route-map-toolbar">
      {onLayerChange ? <SegmentedControl label={ru ? 'Слой карты' : 'Map layer'} value={layer} onChange={onLayerChange}
        options={(['countries', 'routes', 'frequency'] as const).map(value => ({ value, label: LAYER_LABELS[value][locale] }))} /> : <h2>{ru ? 'Карта маршрутов' : 'Route map'}</h2>}
      {open
        ? <Button variant="secondary" onClick={() => { setOpen(false); setSelected(null) }}>{ru ? 'Закрыть карту' : 'Close map'}</Button>
        : <Button variant="secondary" onClick={() => { retry(); setOpen(true) }}>{ru ? 'Открыть карту' : 'Open map'}</Button>}
    </div>
    {period !== 'all' ? <p className="route-map-note">{currentProjection
      ? (ru ? `Карта за ${period}: страны и маршруты завершённых перелётов этого года. Заявленные страны и наземные визиты относятся ко всей коллекции.` : `Map for ${period}: countries and routes of that year's completed flights. Claims and ground visits are part of the all-time collection.`)
      : (ru ? 'Пока карта загружается, на превью показаны страны за всё время.' : 'While the map loads, the preview shows all-time countries.')}</p> : null}
    {!open ? preview : <>
      {failed ? <p role="status">{ru ? 'Маршруты недоступны. Список стран остаётся ниже.' : 'Routes are unavailable. Your country list remains below.'}</p> : null}
      {mismatched || loadedProjection?.derivedState === 'pending' ? <p role="status">{ru ? 'Обновляем карту. Показана последняя коллекция паспорта.' : 'Updating the map. Showing the last Passport collection.'}</p> : null}
      {loadedProjection?.derivedState === 'error' ? <p role="alert">{ru ? 'Не удалось подготовить карту.' : 'The map could not be prepared.'}</p> : null}
      {failed || mismatched || loadedProjection?.derivedState === 'error' ? <Button variant="secondary" onClick={() => { retry(); onRefresh() }}>{ru ? 'Повторить' : 'Try again'}</Button> : null}
      {currentProjection ? <Suspense fallback={preview}>
        <FullRouteMap routes={routes} visits={mapVisits} locale={locale} viewportKey={`${ownerId}:${period}`} layer={layer} placeholder={preview}
          selected={routes.some(route => `${route.origin}-${route.destination}` === selected) ? selected : null}
          onSelect={setSelected} onSelectCountry={onSelectCountry} />
      </Suspense> : <>{preview}{failed || loadedProjection ? null : <p role="status" className="route-map-note">{ru ? 'Загрузка маршрутов…' : 'Loading routes…'}</p>}</>}
      {currentProjection?.truncated ? <p className="route-map-note">{ru ? `Показаны первые ${routes.length} из ${currentProjection.routeCount} маршрутов.` : `Showing the first ${routes.length} of ${currentProjection.routeCount} routes.`}</p> : null}
      {showRoutes && currentProjection && !routes.length ? <p>{ru ? 'Маршрутов за этот период нет.' : 'No routes in this period.'}</p> : null}
      {showRoutes ? <ol className="route-map-list" aria-label={ru ? 'Список маршрутов' : 'Route list'}>
        {routes.map(route => {
          const id = `${route.origin}-${route.destination}`
          return <li key={id}><button type="button" aria-pressed={selected === id} onClick={() => setSelected(id)}>
            {route.origin} ↔ {route.destination} · {route.count}
            {hasDrawableEndpoints(route) ? '' : ru ? ' · линия недоступна' : ' · line unavailable'}
          </button></li>
        })}
      </ol> : null}
    </>}
    <ol className="route-map-country-list" aria-label={ru ? 'Посещённые страны' : 'Visited countries'}>
      {mapVisits.map(visit => <li key={visit.countryCode}><button type="button" onClick={() => onSelectCountry?.(visit.countryCode)} disabled={!onSelectCountry}>
        {countryNames.of(visit.countryCode.toUpperCase()) ?? visit.countryCode.toUpperCase()}{visit.count > 0 ? ` · ${visit.count}` : ''}{visit.claimed ? ru ? ' · в коллекции' : ' · in your collection' : ''}{describeCountry?.(visit)}
      </button></li>)}
    </ol>
  </section>
}
