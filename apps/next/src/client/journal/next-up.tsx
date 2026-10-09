'use client'

import { useSyncExternalStore } from 'react'
import { formatDateOnly, type Locale } from '../../lib/format'
import type { JournalFlight, JournalRefs } from './model'
import './next-up.css'

const copy = {
  en: { title: 'Next up', to: 'to' },
  ru: { title: 'Скоро', to: 'в' },
} as const

export type NextUpProps = {
  /** The nearest 1 to 3 upcoming flights, ascending. Filters do not apply. */
  flights: JournalFlight[]
  refs: JournalRefs
  locale: Locale
  onOpen: (id: number) => void
}

// Today comes from the client only: the server snapshot is null, so the hydrating render shows dates alone and the countdown follows.
const subscribe = () => () => {}
const localDay = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const serverDay = () => null

const dayNumber = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date) / 86_400_000
}

export function NextUp({ flights, refs, locale, onOpen }: NextUpProps) {
  const today = useSyncExternalStore(subscribe, localDay, serverDay)
  if (!flights.length) return null
  const t = copy[locale]
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const place = (code: string) => {
    const city = refs.airports[code]?.city
    return city ? `${city} (${code})` : code
  }
  return <section className="journal-next" aria-labelledby="journal-next-title">
    <h2 id="journal-next-title">{t.title}</h2>
    <ul>
      {flights.map(flight => {
        const date = formatDateOnly(locale, flight.date, 'medium')
        const countdown = today ? relative.format(Math.round(dayNumber(flight.date) - dayNumber(today)), 'day') : null
        const number = flight.flight_number ?? flight.airline_iata
        const name = [`${place(flight.origin)} ${t.to} ${place(flight.destination)}`, date, number, countdown].filter(Boolean).join(', ')
        return <li key={flight.id}>
          <button type="button" className="journal-next-item" aria-label={name} onClick={() => onOpen(flight.id)}>
            <span className="journal-next-date">{date}</span>
            <span className="journal-next-route">{flight.origin}<span aria-hidden="true"> → </span>{flight.destination}</span>
            {number && <span className="journal-next-number">{number}</span>}
            {countdown && <span className="journal-next-countdown">{countdown}</span>}
          </button>
        </li>
      })}
    </ul>
  </section>
}
