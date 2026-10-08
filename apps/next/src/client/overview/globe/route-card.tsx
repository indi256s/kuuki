'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { formatCount, formatNumber, type Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { forms } from '../copy'

export type GlobeRouteCard = {
  key: string; count: number; distanceKm: number | null; x: number; y: number
  /** Set while a reference is kept: both sides' counts, so a reference-only route is still described. */
  comparison?: { heldCount: number; currentCount: number }
}
export function RouteCard({ route, locale, onScope, onClose }: {
  route: GlobeRouteCard; locale: Locale; onScope: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus() }
  }, [])
  return <div ref={ref} role="dialog" aria-label={route.key.replace('-', '–')} className="globe-route-card"
    style={{ left: route.x, top: route.y }} onPointerDown={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="globe-route-heading"><strong>{route.key.replace('-', '–')}</strong>
      <Button className="globe-route-close" aria-label={locale === 'ru' ? 'Закрыть маршрут' : 'Close route'} onClick={onClose}><X size={16} aria-hidden="true" /></Button></div>
    {route.comparison ? <p>{locale === 'ru' ? 'Опорный срез' : 'Reference'}: {formatCount(locale, route.comparison.heldCount, forms.flights)}<br />
      {locale === 'ru' ? 'Текущий срез' : 'Current'}: {formatCount(locale, route.comparison.currentCount, forms.flights)}</p> : null}
    <p>{route.comparison ? null : <>{formatCount(locale, route.count, forms.flights)} · </>}<span title={locale === 'ru' ? 'Среднее расстояние сохранённых перелётов' : 'Average recorded flight distance'}>{route.distanceKm === null ? '—' : formatNumber(locale, route.distanceKm)}</span> {locale === 'ru' ? 'км' : 'km'}</p>
    <Button onClick={onScope} disabledReason={route.comparison?.currentCount === 0
      ? locale === 'ru' ? 'Этот маршрут есть только в опорном срезе.' : 'This route is only in the reference.' : undefined}>
      {locale === 'ru' ? 'Выбрать этот маршрут для страницы' : 'Scope page to this route'}</Button>
  </div>
}
