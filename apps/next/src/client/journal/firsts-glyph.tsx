'use client'

import { Sparkle } from '@keyline-icons/react'
import type { Locale } from '../../lib/format'
import { Tooltip } from '../ui/tooltip'
import type { FlightFirsts, JournalFlight, JournalRefs } from './model'

// The glyph is a hint, never the only carrier: the detail sheet spells the same labels out (tooltips do not open on touch).
// Its styles live in ledger.css (`.journal-firsts`), next to the rows that carry it.

export type FirstsFlight = Pick<JournalFlight, 'aircraft_icao' | 'airline_iata'>

const regionNames = new Map<Locale, Intl.DisplayNames>()
function countryName(locale: Locale, code: string): string {
  let names = regionNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: 'region' })
    regionNames.set(locale, names)
  }
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

const copy = {
  en: {
    country: (name: string) => `First visit to ${name}`,
    aircraft: (name: string) => `First ${name}`,
    airline: (name: string) => `First flight with ${name}`,
    pending: ' (pending confirmation)',
  },
  ru: {
    country: (name: string) => `Впервые в стране: ${name}`,
    aircraft: (name: string) => `Впервые на ${name}`,
    airline: (name: string) => `Впервые с ${name}`,
    pending: ' (ждёт подтверждения)',
  },
} as const

/** The firsts a flight earned, as sentences: countries, then aircraft type, then airline. The flight names the aircraft and airline the booleans refer to. */
export function firstsLabels(
  firsts: FlightFirsts,
  refs: JournalRefs,
  locale: Locale,
  flight: FirstsFlight,
): string[] {
  const t = copy[locale]
  const labels = firsts.countries.map((code) => t.country(countryName(locale, code)))
  if (firsts.aircraft && flight.aircraft_icao)
    labels.push(t.aircraft(refs.aircraft[flight.aircraft_icao]?.name ?? flight.aircraft_icao))
  if (firsts.airline && flight.airline_iata)
    labels.push(t.airline(refs.airlines[flight.airline_iata]?.name ?? flight.airline_iata))
  return firsts.pending ? labels.map((label) => label + t.pending) : labels
}

export type FirstsGlyphProps = {
  firsts: FlightFirsts
  flight: FirstsFlight
  refs: JournalRefs
  locale: Locale
}

export function FirstsGlyph({ firsts, flight, refs, locale }: FirstsGlyphProps) {
  const labels = firstsLabels(firsts, refs, locale, flight)
  if (!labels.length) return null
  return (
    <Tooltip
      content={labels.map((label) => (
        <span key={label} className="journal-firsts-line">
          {label}
        </span>
      ))}
    >
      <span className="journal-firsts" role="img" tabIndex={0} aria-label={labels.join('. ')}>
        <Sparkle size={14} strokeWidth={1.5} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
