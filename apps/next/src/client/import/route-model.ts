import { findAirport } from '@kuuki/data/airport-lookup'
import { airportAliases } from '@kuuki/shared'
import type { Locale } from '../../lib/format'
import type { DraftChange } from './draft-saver'
import type { Draft } from './import-types'
import type { Endpoint } from './questions'
import { isDuplicate } from './review-model'

export type Decision = 'flew' | 'land' | 'skip'
export type LegLine = Decision | 'saved' | 'open'

export interface Place {
  code: string | null
  hint: string | null
  key: string | null
  country: string | null
  options: string[]
}

export interface Leg {
  id: string
  draft: Draft
  origin: Place
  destination: Place
  date: string | null
  decision: Decision | null
  saved: boolean
}

export type RouteItem =
  | {
      kind: 'month'
      key: string
      year: number
      month: number
      showYear: boolean
      through: Leg | null
    }
  | { kind: 'undated'; key: string }
  | {
      kind: 'station'
      key: string
      place: Place
      arrived: string | null
      left: string | null
      in: Leg | null
      out: Leg | null
    }
  | { kind: 'leg'; key: string; leg: Leg }

export interface LandVisit {
  id: string
  countryCode: string
  visitYear: number | null
}

const HINT_COUNTRY = /,\s*([A-Za-z]{2})\s*$/

const fold = (value: string) =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('en')

export function hintCity(hint: string): string {
  return hint.replace(HINT_COUNTRY, '').trim()
}

export function placeOf(draft: Draft, endpoint: Endpoint): Place {
  const code = draft.fields[endpoint]?.trim().toUpperCase() || null
  const hint = draft.fields[`${endpoint}_hint`]?.trim() || null
  const options = draft.fields[`${endpoint}_options`] ?? []
  const airport = code ? findAirport(code) : undefined
  const country = airport
    ? airport.countryCode || null
    : hint
      ? (HINT_COUNTRY.exec(hint)?.[1]?.toUpperCase() ?? null)
      : null
  const city = airport?.city ?? (hint ? hintCity(hint) : null)
  const key = city ? `${country ?? ''}:${fold(city)}` : code ? `code:${code}` : null
  return { code, hint, key, country, options }
}

export function placeCity(place: Place, locale: Locale): string | null {
  if (place.code) {
    const alias = locale === 'ru' ? airportAliases[place.code] : undefined
    return (
      alias?.city ?? findAirport(place.code)?.city ?? (place.hint ? hintCity(place.hint) : null)
    )
  }
  return place.hint ? hintCity(place.hint) : null
}

export const settledDate = (draft: Draft): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(draft.fields.date ?? '') && (draft.yearExplicit || draft.yearConfirmed)
    ? draft.fields.date
    : null

export function decisionOf(
  draft: Draft,
  land: ReadonlySet<string>,
  implicit = false,
): Decision | null {
  if (draft.status === 'dismissed') return land.has(draft.id) ? 'land' : 'skip'
  if (draft.status !== 'review') return null
  if (isDuplicate(draft)) return draft.selected && draft.duplicateAcknowledged ? 'flew' : null
  return draft.selected || implicit ? 'flew' : null
}

export function decisionChange(draft: Draft, next: Decision): DraftChange | null {
  if (next === 'flew') {
    const change: DraftChange = { selected: true }
    if (draft.status === 'dismissed') change.dismissed = false
    if (isDuplicate(draft)) change.duplicateAcknowledged = true
    return change
  }
  return draft.status === 'dismissed' ? null : { dismissed: true }
}

export function legOf(draft: Draft, land: ReadonlySet<string>, implicit = false): Leg {
  return {
    id: draft.id,
    draft,
    origin: placeOf(draft, 'origin'),
    destination: placeOf(draft, 'destination'),
    date: settledDate(draft),
    decision: decisionOf(draft, land, implicit),
    saved: draft.status === 'converted',
  }
}

export const lineOf = (leg: Leg): LegLine => (leg.saved ? 'saved' : (leg.decision ?? 'open'))

export const samePlace = (a: Place, b: Place) => a.key !== null && a.key === b.key

const byDate = (a: Leg, b: Leg) =>
  a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.draft.ordinal - b.draft.ordinal

export function orderLegs(legs: readonly Leg[]): Leg[] {
  return [
    ...legs.filter((leg) => leg.date).sort(byDate),
    ...legs.filter((leg) => !leg.date).sort((a, b) => a.draft.ordinal - b.draft.ordinal),
  ]
}

export function buildRoute(legs: readonly Leg[]): RouteItem[] {
  const items: RouteItem[] = []
  let station = 0
  let lastYear: number | null = null
  const stop = (
    place: Place,
    arrived: string | null,
    left: string | null,
    into: Leg | null,
    out: Leg | null,
  ) =>
    items.push({
      kind: 'station',
      key: `station:${station++}`,
      place,
      arrived,
      left,
      in: into,
      out,
    })
  const run = (sequence: Leg[], months: boolean) => {
    let previous: Leg | null = null
    let lastMonth: string | null = null
    for (const leg of sequence) {
      const continuous = previous !== null && samePlace(previous.destination, leg.origin)
      if (previous && !continuous) stop(previous.destination, previous.date, null, previous, null)
      const month = months && leg.date ? leg.date.slice(0, 7) : null
      if (month && month !== lastMonth) {
        const year = Number(month.slice(0, 4))
        items.push({
          kind: 'month',
          key: `month:${month}`,
          year,
          month: Number(month.slice(5, 7)),
          showYear: year !== lastYear,
          through: continuous ? previous : null,
        })
        lastMonth = month
        lastYear = year
      }
      if (continuous && previous)
        stop(
          previous.destination.code ? previous.destination : leg.origin,
          previous.date,
          leg.date,
          previous,
          leg,
        )
      else stop(leg.origin, null, leg.date, null, leg)
      items.push({ kind: 'leg', key: `leg:${leg.id}`, leg })
      previous = leg
    }
    if (previous) stop(previous.destination, previous.date, null, previous, null)
  }
  const ordered = orderLegs(legs)
  const dated = ordered.filter((leg) => leg.date)
  const undated = ordered.filter((leg) => !leg.date)
  run(dated, true)
  if (undated.length) {
    items.push({ kind: 'undated', key: 'undated' })
    run(undated, false)
  }
  return items
}

export function landVisits(legs: readonly Leg[]): LandVisit[] {
  return legs.flatMap((leg) => {
    const country = leg.destination.country
    if (leg.decision !== 'land' || leg.saved || !country) return []
    if (leg.origin.country === country) return []
    return [
      {
        id: leg.id,
        countryCode: country,
        visitYear: leg.date ? Number(leg.date.slice(0, 4)) : null,
      },
    ]
  })
}

export interface Reach {
  code: string
  lit: boolean
}

export function stampReach(legs: readonly Leg[]): Reach[] {
  const order: string[] = []
  const lit = new Set<string>()
  for (const leg of orderLegs(legs)) {
    for (const code of [leg.origin.country, leg.destination.country])
      if (code && !order.includes(code)) order.push(code)
    const line = lineOf(leg)
    if (line === 'flew' || line === 'saved')
      for (const code of [leg.origin.country, leg.destination.country]) if (code) lit.add(code)
    if (line === 'land' && leg.destination.country) lit.add(leg.destination.country)
  }
  return order.map((code) => ({ code, lit: lit.has(code) }))
}
