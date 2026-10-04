'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import { CountryPreview, type CountryVisit, type MapLocale } from './preview'
import { hasDrawableEndpoints, type RouteProjection } from './types'
import './map.css'

export { CountryPreview } from './preview'

const FullRouteMap = dynamic(() => import('./renderer').then(mod => mod.FullRouteMap), { ssr: false,
  loading: () => <div role="status" className="route-map-placeholder">Loading map…</div> })

type Props = {
  ownerId: string
  locale: MapLocale
  period?: 'all' | `${number}`
  countryVisits?: CountryVisit[] | Record<string, number>
  onSelectCountry?: (code: string) => void
  initiallyOpen?: boolean
  revision?: number
}

export function RouteMapPanel({ ownerId, locale, period = 'all', countryVisits = [], onSelectCountry, initiallyOpen = false, revision }: Props) {
  const [open, setOpen] = useState(initiallyOpen)
  const [projection, setProjection] = useState<RouteProjection | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const visits = useMemo<CountryVisit[]>(() => Array.isArray(countryVisits) ? countryVisits :
    Object.entries(countryVisits).map(([countryCode, count]) => ({ countryCode, count })), [countryVisits])
  const countryIds = visits.map(visit => visit.countryCode)
  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale])
  const key = `${ownerId}:${period}`
  const displayedProjection = projection?.ownerId === ownerId ? projection : null
  const currentProjection = displayedProjection?.period === period ? displayedProjection : null

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const untrack = trackPrivateOperation(controller)
    api.get<RouteProjection>(`/api/flights/route-projection?period=${encodeURIComponent(period)}`, undefined, { signal: controller.signal })
      .then(value => {
        if (value.ownerId !== ownerId || value.period !== period) throw new Error('Map identity or period changed')
        setProjection(value)
      })
      .catch(() => { if (!controller.signal.aborted) setErrorKey(key) })
    return () => { controller.abort(); untrack() }
  }, [open, ownerId, period, revision, key])

  const label = locale === 'ru' ? 'Карта маршрутов' : 'Route map'
  const routes = displayedProjection?.routes ?? []
  const mapVisits = useMemo(() => {
    if (displayedProjection?.period === 'all' || !displayedProjection) return visits
    const counts = new Map<string, number>()
    for (const route of displayedProjection.routes) for (const country of [route.originCountry, route.destinationCountry]) {
      if (country) counts.set(country, (counts.get(country) ?? 0) + route.count)
    }
    const claims = new Set(visits.filter(visit => visit.claimed).map(visit => visit.countryCode))
    return [...counts].map(([countryCode, count]) => ({ countryCode, count, claimed: claims.has(countryCode) }))
  }, [displayedProjection, visits])
  const previewIds = period === 'all' || !currentProjection ? countryIds : mapVisits.map(visit => visit.countryCode)
  return <section aria-label={label} className="route-map-panel">
    {!open ? <>
      <CountryPreview countryIds={previewIds} locale={locale} period={currentProjection ? period : 'all'} />
      {period !== 'all' && !currentProjection ? <p>{locale === 'ru' ? 'На превью показаны страны за всё время.' : 'Preview shows all-time countries.'}</p> : null}
      <button type="button" onClick={() => { setErrorKey(null); setOpen(true) }}>{locale === 'ru' ? 'Открыть карту' : 'Open map'}</button>
    </> : <>
      <div className="route-map-toolbar">
        <h2>{label}</h2>
        <button type="button" onClick={() => { setOpen(false); setSelected(null) }}>{locale === 'ru' ? 'Закрыть карту' : 'Close map'}</button>
      </div>
      {errorKey === key ? <p role="status">{locale === 'ru' ? 'Маршруты недоступны. Список стран остаётся ниже.' : 'Routes are unavailable. Your country list remains below.'}</p> : null}
      {displayedProjection && !currentProjection ? <p role="status">{locale === 'ru'
        ? `Показаны маршруты за ${displayedProjection.period}; загружаем выбранный период.`
        : `Showing ${displayedProjection.period} routes while the selected period loads.`}</p> : null}
      {displayedProjection ? <FullRouteMap routes={routes} visits={mapVisits} locale={locale} viewportKey={`${ownerId}:${displayedProjection.period}`}
        selected={routes.some(route => `${route.origin}-${route.destination}` === selected) ? selected : null}
        onSelect={setSelected} onSelectCountry={onSelectCountry} />
        : errorKey === key ? <CountryPreview countryIds={previewIds} locale={locale} />
          : <div role="status" className="route-map-placeholder">{locale === 'ru' ? 'Загрузка маршрутов…' : 'Loading routes…'}</div>}
      {currentProjection && !routes.length ? <p>{locale === 'ru' ? 'Маршрутов за этот период нет.' : 'No routes in this period.'}</p> : null}
      <ol className="route-map-list" aria-label={locale === 'ru' ? 'Список маршрутов' : 'Route list'}>
        {routes.map(route => {
          const id = `${route.origin}-${route.destination}`
          return <li key={id}><button type="button" aria-pressed={selected === id} onClick={() => setSelected(id)}>
            {route.origin} → {route.destination} · {route.count}
            {hasDrawableEndpoints(route) ? '' : locale === 'ru' ? ' · линия недоступна' : ' · line unavailable'}
          </button></li>
        })}
      </ol>
    </>}
    <ol className="route-map-country-list" aria-label={locale === 'ru' ? 'Посещённые страны' : 'Visited countries'}>
      {period !== 'all' ? <li>{locale === 'ru' ? 'За период на карте показаны только страны из полётов. Список ниже — за всё время.' : 'The period map colors flight countries only. The list below covers all time.'}</li> : null}
      {visits.map(visit => <li key={visit.countryCode}><button type="button" onClick={() => onSelectCountry?.(visit.countryCode)} disabled={!onSelectCountry}>
        {countryNames.of(visit.countryCode.toUpperCase()) ?? visit.countryCode.toUpperCase()} · {visit.count}{visit.claimed ? locale === 'ru' ? ' · отмечено вами' : ' · claimed' : ''}
      </button></li>)}
    </ol>
  </section>
}
