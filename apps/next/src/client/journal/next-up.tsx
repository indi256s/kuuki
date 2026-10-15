'use client'

import { useState, useSyncExternalStore } from 'react'
import { formatCount, formatDateOnly, type Locale } from '../../lib/format'
import { flightCode, type JournalFlight, type JournalRefs } from './model'
import { SplitFlap } from '../ui/split-flap'
import './next-up.css'

// Board 22.1/22.6 "Next up": the nearest flight leads with its cities, codes, date, optional departure time and flight number,
// and a split-flap day count, the section's one aviation motif. Later flights sit quietly beside or below it.
// Motion (board "Next up · motion"): the flaps flip in once when the count arrives after hydration (a hard load) and again only
// when the day changes while the page is open; client navigation paints them settled. Today and tomorrow are words that arrive
// with the same flip; reduced motion swaps instantly. Rows stay static (no press scale).

const copy = {
  en: { title: 'Next up', to: 'to', then: 'Then', today: 'Today', tomorrow: 'Tomorrow' },
  ru: { title: 'Скоро', to: 'в', then: 'Потом', today: 'Сегодня', tomorrow: 'Завтра' },
} as const
const dayWord = {
  en: { one: 'day', other: 'days' },
  ru: { one: 'день', few: 'дня', many: 'дней', other: 'дня' },
}
const dayCount = {
  en: { one: '{count} day', other: '{count} days' },
  ru: { one: '{count} день', few: '{count} дня', many: '{count} дней', other: '{count} дня' },
}

export type NextUpProps = {
  /** The nearest 1 to 3 upcoming flights, ascending. Filters do not apply. */
  flights: JournalFlight[]
  refs: JournalRefs
  locale: Locale
  onOpen: (id: number) => void
}

// Today comes from the client only: the server snapshot is null, so the hydrating render shows dates alone and the count follows.
// The subscription wakes at the next local midnight (and when the tab returns), so an open page counts down a real day change.
const subscribe = (notify: () => void) => {
  let timer: ReturnType<typeof setTimeout>
  const arm = () => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    timer = setTimeout(
      () => {
        notify()
        arm()
      },
      midnight.getTime() - now.getTime() + 1000,
    )
  }
  arm()
  document.addEventListener('visibilitychange', notify)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', notify)
  }
}
const localDay = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const serverDay = () => null

const dayNumber = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date) / 86_400_000
}

const shortDates = new Map<string, Intl.DateTimeFormat>()
/** "Sat, Nov 14" ("сб, 14 нояб."), with the year only when it is not this year. */
function shortDate(locale: Locale, day: string, withYear: boolean): string {
  const key = `${locale}:${withYear}`
  let format = shortDates.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: withYear ? 'numeric' : undefined,
      timeZone: 'UTC',
    })
    shortDates.set(key, format)
  }
  return format.format(new Date(`${day}T00:00:00Z`)).replaceAll(' ', ' ')
}

export function NextUp({ flights, refs, locale, onOpen }: NextUpProps) {
  const today = useSyncExternalStore(subscribe, localDay, serverDay)
  // The day of the first render. Null means hydration: the count arrives a frame later, so it flips in instead of popping.
  // A later day than this means the page stayed open across midnight, so a Today/Tomorrow word that replaces the flaps
  // arrives the same way.
  const [firstToday] = useState(today)
  const hydrating = firstToday === null
  if (!flights.length) return null
  const t = copy[locale]
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const city = (code: string) => refs.airports[code]?.city ?? null
  const place = (code: string) => {
    const name = city(code)
    return name ? `${name} (${code})` : code
  }
  const thisYear = today?.slice(0, 4)

  const describe = (flight: JournalFlight) => {
    const days = today === null ? null : Math.round(dayNumber(flight.date) - dayNumber(today))
    const time = flight.departure_time ? flight.departure_time.slice(0, 5) : null
    const number = flightCode(flight) ?? flight.airline_iata
    const name = [
      `${place(flight.origin)} ${t.to} ${place(flight.destination)}`,
      formatDateOnly(locale, flight.date, 'medium'),
      time,
      number,
      days !== null && days >= 0 ? relative.format(days, 'day') : null,
    ]
      .filter(Boolean)
      .join(', ')
    const date = shortDate(locale, flight.date, !!thisYear && flight.date.slice(0, 4) !== thisYear)
    const word = days === 0 ? t.today : days === 1 ? t.tomorrow : null
    return { days: days !== null && days >= 0 ? days : null, time, number, name, date, word }
  }

  const [lead, ...later] = flights
  const first = describe(lead)
  const leadCities = [city(lead.origin), city(lead.destination)]
  return (
    <section className="journal-next" aria-labelledby="journal-next-title">
      <h2 id="journal-next-title">{t.title}</h2>
      {/* A boarding pass: the lead's button stretches over the whole ticket, later flights sit above it, the stub keeps the
          count. The stub is reserved through hydration, so the count arriving does not move the ticket. */}
      <div className="journal-next-card">
        <div className="journal-next-main">
          <button
            type="button"
            className="journal-next-lead"
            aria-label={first.name}
            onClick={() => onOpen(lead.id)}
          >
            <span className="journal-next-cities">
              {leadCities[0] ?? lead.origin} → {leadCities[1] ?? lead.destination}
            </span>
            <span className="journal-next-date">
              {[first.date, first.time].filter(Boolean).join(' · ')}
            </span>
            <span className="journal-next-meta">
              <span>
                {lead.origin} → {lead.destination}
              </span>
              {first.number && <span>{first.number}</span>}
            </span>
          </button>
          {later.length > 0 && (
            <div className="journal-next-later">
              <span className="journal-next-then" aria-hidden="true">
                {t.then}
              </span>
              <ul>
                {later.map((flight) => {
                  const info = describe(flight)
                  const when =
                    info.word ??
                    (info.days !== null ? formatCount(locale, info.days, dayCount) : null)
                  return (
                    <li key={flight.id}>
                      <button
                        type="button"
                        className="journal-next-item"
                        aria-label={info.name}
                        onClick={() => onOpen(flight.id)}
                      >
                        <span className="journal-next-item-route">
                          {city(flight.origin) ?? flight.origin} →{' '}
                          {city(flight.destination) ?? flight.destination}
                        </span>
                        <span className="journal-next-item-sub">
                          <span className="journal-next-item-date">{info.date}</span>
                          {when && <span className="journal-next-item-when">{when}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
        {(today === null || first.days !== null) && (
          // The lead button carries the spoken name and keyboard access; the stub is a pointer shortcut to the same flight.
          <div className="journal-next-stub" aria-hidden="true" onClick={() => onOpen(lead.id)}>
            {first.days !== null &&
              (first.word ? (
                <span
                  key={first.word}
                  className="journal-next-word"
                  data-flip={today !== firstToday || undefined}
                >
                  {first.word}
                </span>
              ) : (
                <span className="journal-next-count">
                  <SplitFlap
                    value={String(first.days)}
                    entering={hydrating}
                    className="journal-next-flaps"
                  />
                  <span className="journal-next-unit">
                    {formatCount(locale, first.days, dayWord)}
                  </span>
                </span>
              ))}
          </div>
        )}
      </div>
    </section>
  )
}
