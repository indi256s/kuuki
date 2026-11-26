'use client'

import { Fragment, useEffect, useRef, type ReactNode, type Ref } from 'react'
import { monthName, type Locale } from '../../lib/format'
import { S } from './copy'
import { dayFormat } from './day-format'
import { R } from './route-copy'
import { endpointLabel, lineOf, type Leg, type RouteItem } from './route-model'
import './route.css'

const stay = (locale: Locale, from: string | null, to: string | null) => {
  const format = dayFormat(locale)
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
          const name = endpointLabel(item.place, locale, 'city')
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
