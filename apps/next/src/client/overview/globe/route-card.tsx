'use client'

import { X } from '@keyline-icons/react'
import { formatCount, formatNumber, type Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { PopoverAnchor, PopoverContent, PopoverRoot } from '../../ui/popover'
import { forms } from '../copy'

export type GlobeRouteCard = {
  key: string
  count: number
  distanceKm: number | null
  x: number
  y: number
}
export function RouteCard({
  route,
  locale,
  onScope,
  onClose,
}: {
  route: GlobeRouteCard
  locale: Locale
  onScope: () => void
  onClose: () => void
}) {
  const label = route.key.replace('-', '–')
  // The shared popover owns focus entry/return, Escape, outside presses and edge collisions; a 0×0 anchor marks the arc.
  return (
    <PopoverRoot open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>
        <span className="globe-route-anchor" style={{ left: route.x, top: route.y }} />
      </PopoverAnchor>
      <PopoverContent aria-label={label} className="globe-route-card" side="bottom">
        <div className="globe-route-heading">
          <strong>{label}</strong>
          <Button
            className="globe-route-close"
            aria-label={locale === 'ru' ? 'Закрыть маршрут' : 'Close route'}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
        <p>
          {formatCount(locale, route.count, forms.flights)} ·{' '}
          <span
            title={
              locale === 'ru'
                ? 'Среднее расстояние сохранённых перелётов'
                : 'Average recorded flight distance'
            }
          >
            {route.distanceKm === null ? '—' : formatNumber(locale, route.distanceKm)}
          </span>{' '}
          {locale === 'ru' ? 'км' : 'km'}
        </p>
        <Button onClick={onScope}>
          {locale === 'ru' ? 'Только этот маршрут' : 'Only this route'}
        </Button>
      </PopoverContent>
    </PopoverRoot>
  )
}
