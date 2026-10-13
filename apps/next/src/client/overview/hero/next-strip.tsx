'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ChevronRight } from '@keyline-icons/react'
import { calendarDay } from '@kuuki/shared/overview/next'
import { formatCount, formatDateOnly, formatNumber } from '../../../lib/format'
import { Button } from '../../ui/button'
import { forms, S, t } from '../copy'
import { useOverview } from '../store/overview-context'
import { useOpenFlight } from '../store/open-flight'
import './hero.css'

export function NextStrip() {
  const { payload, scope, all, locale, bus, isCurrent, aggregate, ownerKey } = useOverview()
  const openFlight = useOpenFlight()
  const next = scope?.next[0],
    id = next?.flightId
  const current = useRef(isCurrent)
  useEffect(() => {
    current.current = isCurrent
  }, [isCurrent])
  useEffect(() => {
    return () => {
      // Retired owners must not notify consumers; a newer preview owns its own cleanup.
      if (current.current() && bus.getSnapshot().hoverGhost === id) bus.setHoverGhost(null)
    }
  }, [bus, id])
  if (!payload || !scope || !all) return <p role="status">{t(S.loading, locale)}</p>
  if (!next) {
    const awaiting = all.figures.awaiting
    if (!awaiting) return null
    return (
      <div className="ov3-next-strip">
        <Link className="ov3-next-review" href="/journal?queue=awaiting">
          {locale === 'ru' ? 'Проверить' : 'Review'} {formatCount(locale, awaiting, forms.flights)}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    )
  }
  const day = calendarDay(next.date),
    generated = new Date(payload.generatedAt)
  const countdown =
    day !== null &&
    Number.isFinite(generated.getTime()) &&
    Number.isInteger(next.daysAway) &&
    next.daysAway >= 0
      ? next.daysAway === 0
        ? t(S.today, locale)
        : next.daysAway === 1
          ? t(S.tomorrow, locale)
          : formatCount(locale, next.daysAway, forms.inDays)
      : formatDateOnly(locale, next.date)
  const parts =
    day === null
      ? null
      : new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }).formatToParts(new Date(day))
  const date = parts
    ? `${parts.find((part) => part.type === 'weekday')?.value}, ${parts
        .filter((part) => part.type !== 'weekday')
        .map((part) => part.value)
        .join('')
        .trim()
        .replace(/^,\s*/, '')}`
    : next.date
  const preview = () => {
    if (isCurrent()) bus.setHoverGhost(next.flightId)
  }
  const clear = () => {
    if (isCurrent() && bus.getSnapshot().hoverGhost === next.flightId) bus.setHoverGhost(null)
  }
  const pill = countdown.toLocaleUpperCase(locale)
  const details = `${date}${next.flightNumber ? ` · ${next.flightNumber}` : ''}${next.newCountry ? ` · ${locale === 'ru' ? 'новая страна' : 'a new country'}` : ''}`
  const content = (
    <>
      <span className="ov3-next-pill">{pill}</span>
      <span className="ov3-next-route">
        {next.origin}–{next.destination}
      </span>
      <span className="ov3-next-details">{details}</span>
    </>
  )
  const interactive = !aggregate && ownerKey !== 'dev'
  return (
    <div className="ov3-next-strip">
      {interactive ? (
        <Button
          variant="ghost"
          static
          className="ov3-next-flight"
          aria-label={`${locale === 'ru' ? 'Открыть перелёт' : 'Open flight'} · ${pill} · ${next.origin}–${next.destination} · ${details}`}
          onMouseEnter={preview}
          onMouseLeave={clear}
          onFocus={preview}
          onBlur={clear}
          onClick={() => openFlight(next.flightId)}
        >
          {content}
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      ) : (
        <div
          className="ov3-next-flight"
          tabIndex={0}
          onMouseEnter={preview}
          onMouseLeave={clear}
          onFocus={preview}
          onBlur={clear}
        >
          {content}
        </div>
      )}
      {scope.next.length > 1 ? (
        <span className="ov3-next-more">
          +{formatNumber(locale, scope.next.length - 1)}{' '}
          {locale === 'ru' ? 'ещё забронировано' : 'more booked'}
        </span>
      ) : null}
    </div>
  )
}
