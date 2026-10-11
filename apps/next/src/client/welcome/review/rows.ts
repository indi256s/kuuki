// What the compact review shows of a draft, and which group it belongs to. Pure; the import review model decides what
// is chosen, readiness and questions, this only sorts rows into the three groups the card shows.
import { findAirport } from '@kuuki/data/airport-lookup'
import { cityOf } from '../../import/reference'
import type { DraftChange } from '../../import/draft-saver'
import type { Draft } from '../../import/import-types'
import { monthDayOf, openCauses, type Endpoint } from '../../import/questions'
import {
  isChosen,
  isDuplicate,
  readiness,
  toValues,
  validateValues,
  withUnsent,
} from '../../import/review-model'
import type { FactFlight } from '../types'

export const DASH = '—'

/** How an unsure row is asked about: a one-tap fix, or (`other`) the import review's own row editor. */
export type Kind = 'airport' | 'date' | 'status' | 'other'

export function kindOf(draft: Draft): Kind {
  const causes = openCauses(draft)
  if (causes.includes('airport')) return 'airport'
  if (causes.includes('year') || readiness(draft).some((reason) => reason !== 'issue'))
    return 'date'
  if (causes.includes('status')) return 'status'
  return 'other'
}

export type Groups = {
  unsure: Draft[]
  right: Draft[]
  saved: Draft[]
  left: Draft[]
}

/** A row with an open airport cannot be saved even when it is selected: the endpoint is empty. */
const blocked = (draft: Draft) => !isChosen(draft) || openCauses(draft).includes('airport')

/** Review rows that are not chosen are unsure; chosen ones look right; saved ones stay counted; dismissed ones are left out. */
export function group(drafts: Draft[], rejected?: ReadonlySet<string>): Groups {
  const sorted = [...drafts].sort((a, b) => a.ordinal - b.ordinal)
  // A row the server refused on Save is unsure again until the member changes it or leaves it out.
  const held = (draft: Draft) => blocked(draft) || rejected?.has(draft.id) === true
  return {
    unsure: sorted.filter((draft) => draft.status === 'review' && held(draft)),
    right: sorted.filter((draft) => draft.status === 'review' && !held(draft)),
    saved: sorted.filter((draft) => draft.status === 'converted'),
    left: sorted.filter((draft) => draft.status === 'dismissed'),
  }
}

/** The draft as the member sees it: the stored row with their unsent change laid over it, "Leave out" included. */
export function shownDraft(draft: Draft, change: DraftChange | null | undefined): Draft {
  const over = withUnsent(draft, change)
  if (change?.dismissed === undefined || draft.status === 'converted') return over
  return { ...over, status: change.dismissed ? 'dismissed' : 'review' }
}

/** Endpoints the source left open between several catalog airports. */
export const openEndpoints = (draft: Draft): Endpoint[] =>
  (['origin', 'destination'] as const).filter(
    (endpoint) => !draft.fields[endpoint] && (draft.fields[`${endpoint}_options`]?.length ?? 0) > 0,
  )

/** The city a question about an open endpoint is about. */
export const openCity = (draft: Draft, endpoint: Endpoint) =>
  cityOf(draft.fields[`${endpoint}_options`]?.[0] ?? '')

export function routeText(draft: Draft): string {
  const label = (endpoint: Endpoint) =>
    draft.fields[endpoint] ||
    (openEndpoints(draft).includes(endpoint) ? openCity(draft, endpoint) : DASH)
  return `${label('origin')} → ${label('destination')}`
}

export function flightText(draft: Draft): string {
  const {
    airline_iata: airline,
    flight_number: number,
    airline_was_placeholder: placeholder,
  } = draft.fields
  // A codeshare lists several numbers: the row shows the first.
  const first = number?.split(/\s*[/,;|]\s*/)[0]?.trim()
  if (!first) return DASH
  return placeholder || !airline ? first : `${airline} ${first}`
}

/** The airport's name for the small line under a chip, without the generic word "Airport". */
export function airportName(code: string): string {
  const airport = findAirport(code)
  const name = (airport?.name ?? '').replace(/\s+(International\s+)?Airport$/i, '').trim()
  // Every chip in a "Which London?" row shares the city, so the name drops it: "London Gatwick" → "Gatwick".
  const city = airport?.city?.trim()
  if (city && name.toLowerCase().startsWith(`${city.toLowerCase()} `)) {
    const rest = name.slice(city.length).replace(/^[\s-]+/, '')
    if (rest) return rest
  }
  return name
}

export function dateText(draft: Draft): string {
  if (draft.fields.date) return draft.fields.date
  const day = monthDayOf(draft)
  return day ? `????-${draft.fields.date_month_day}` : DASH
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

export const isUpcoming = (draft: Draft) => draft.fields.date > todayIso()

export function factOf(draft: Draft): FactFlight {
  const { date, origin, destination } = draft.fields
  return { date, origin, destination, upcoming: date > todayIso() }
}

/** The member typed a date: that settles the year too. The row is also chosen when nothing else holds it back. */
export function answerDate(draft: Draft, date: string): DraftChange {
  const change: DraftChange = { fields: { date }, yearConfirmed: true }
  const after = withUnsent(draft, change)
  const ready =
    openCauses(after).length === 0 &&
    readiness(after).length === 0 &&
    !isDuplicate(after) &&
    Object.keys(validateValues(toValues(after.fields))).length === 0
  return ready && !draft.selected ? { ...change, selected: true } : change
}

/** Whether `value` is a real calendar day (the date field is the only one this card validates itself). */
export const validDate = (draft: Draft, value: string) =>
  validateValues({ ...toValues(draft.fields), date: value }).date === undefined

export function datePlaceholder(draft: Draft): string {
  if (draft.fields.date) return draft.fields.date
  const day = draft.fields.date_month_day
  return day && monthDayOf(draft) ? `YYYY-${day}` : 'YYYY-MM-DD'
}
