'use client'

import { Fragment, useEffect, useRef, type ReactNode, type Ref } from 'react'
import type { Locale } from '../../lib/format'
import { S } from './copy'
import { R } from './route-copy'
import { hintCity, lineOf, placeCity, type Leg, type RouteItem } from './route-model'
import './route.css'

const monthNames: Partial<Record<Locale, Intl.DateTimeFormat>> = {}
const monthName = (locale: Locale, month: number) =>
  (monthNames[locale] ??= new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  })).format(new Date(Date.UTC(2000, month - 1, 15)))

const rangeFormats: Partial<Record<Locale, Intl.DateTimeFormat>> = {}
const stay = (locale: Locale, from: string | null, to: string | null) => {
  const format = (rangeFormats[locale] ??= new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }))
  const at = (value: string) => new Date(`${value}T12:00:00Z`)
  if (from && to)
    return from === to ? format.format(at(from)) : format.formatRange(at(from), at(to))
  return null
}

const line = (leg: Leg | null) => (leg ? lineOf(leg) : undefined)

export function RouteView({
  locale,
  items,
  headingRef,
  renderLeg,
}: {
  locale: Locale
  items: RouteItem[]
  headingRef?: Ref<HTMLHeadingElement>
  renderLeg: (leg: Leg) => ReactNode
}) {
  const root = useRef<HTMLElement>(null)
  const empty = items.length === 0
  useEffect(() => {
    if (!empty) root.current?.setAttribute('data-live', '')
  }, [empty])
  if (empty) return null
  return (
    <section ref={root} className="route" aria-labelledby="import-route-title">
      <h2 id="import-route-title" ref={headingRef} tabIndex={-1} className="sr-only">
        {R.route[locale]}
      </h2>
      <ol className="route-list">
        {items.map((item) => {
          if (item.kind === 'leg') return <Fragment key={item.key}>{renderLeg(item.leg)}</Fragment>
          if (item.kind === 'month' || item.kind === 'undated')
            return (
              <li
                key={item.key}
                className="route-month"
                data-line={item.kind === 'month' ? line(item.through) : undefined}
              >
                <h3>
                  {item.kind === 'undated'
                    ? S.noDate[locale]
                    : `${monthName(locale, item.month)}${item.showYear ? ` ${item.year}` : ''}`}
                </h3>
              </li>
            )
          const name =
            placeCity(item.place, locale) ??
            item.place.code ??
            (item.place.hint ? hintCity(item.place.hint) : '—')
          const dates = stay(locale, item.arrived, item.left)
          return (
            <li
              key={item.key}
              className="route-station"
              data-in={line(item.in)}
              data-out={line(item.out)}
              data-edge={!item.in ? 'start' : !item.out ? 'end' : undefined}
            >
              <p className="route-station-name">{name}</p>
              {dates ? <p className="route-station-dates">{dates}</p> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
