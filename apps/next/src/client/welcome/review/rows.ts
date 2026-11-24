import { findAirport } from '@kuuki/data/airport-lookup'
import { cityOf } from '../../import/reference'
import type { DraftChange } from '../../import/draft-saver'
import type { Draft } from '../../import/import-types'
import { monthDayOf, openCauses, type Endpoint } from '../../import/questions'
import {
  isChosen,
  isDuplicate,
  LOW_CONFIDENCE,
  localToday,
  lowFields,
  readiness,
  toValues,
  validateValues,
  withUnsent,
} from '../../import/review-model'
import type { FactFlight } from '../types'

export const DASH = '—'

export type Kind = 'airport' | 'date' | 'status' | 'confirm' | 'other'

export function kindOf(draft: Draft): Kind {
  const causes = openCauses(draft)
  if (causes.includes('airport')) return 'airport'
  if (causes.includes('year') || readiness(draft).some((reason) => reason !== 'issue'))
    return 'date'
  if (causes.includes('status')) return 'status'
  if (!draft.selected && !isDuplicate(draft) && readiness(draft).length === 0) return 'confirm'
  return 'other'
}

export type Groups = {
  unsure: Draft[]
  right: Draft[]
  saved: Draft[]
  left: Draft[]
}

const blocked = (draft: Draft) => !isChosen(draft) || openCauses(draft).includes('airport')

export function group(drafts: Draft[], rejected?: ReadonlySet<string>): Groups {
  const sorted = [...drafts].sort((a, b) => a.ordinal - b.ordinal)
  const held = (draft: Draft) => blocked(draft) || rejected?.has(draft.id) === true
  return {
    unsure: sorted.filter((draft) => draft.status === 'review' && held(draft)),
    right: sorted.filter((draft) => draft.status === 'review' && !held(draft)),
    saved: sorted.filter((draft) => draft.status === 'converted'),
    left: sorted.filter((draft) => draft.status === 'dismissed'),
  }
}

export function shownDraft(draft: Draft, change: DraftChange | null | undefined): Draft {
  const over = withUnsent(draft, change)
  if (change?.dismissed === undefined || draft.status === 'converted') return over
  return { ...over, status: change.dismissed ? 'dismissed' : 'review' }
}

export const openEndpoints = (draft: Draft): Endpoint[] =>
  (['origin', 'destination'] as const).filter(
    (endpoint) => !draft.fields[endpoint] && (draft.fields[`${endpoint}_options`]?.length ?? 0) > 0,
  )

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
  const first = number?.split(/\s*[/,;|]\s*/)[0]?.trim()
  if (!first) return DASH
  return placeholder || !airline ? first : `${airline} ${first}`
}

export function airportName(code: string): string {
  const airport = findAirport(code)
  const name = (airport?.name ?? '').replace(/\s+(International\s+)?Airport$/i, '').trim()
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

export const isUpcoming = (draft: Draft) => draft.fields.date > localToday()

export function factOf(draft: Draft): FactFlight {
  const { date, origin, destination } = draft.fields
  return { date, origin, destination, upcoming: date > localToday() }
}

const REQUIRED_HELD = ['origin', 'destination', 'airline_iata']

export function answerDate(draft: Draft, date: string): DraftChange {
  const change: DraftChange = { fields: { date }, yearConfirmed: true }
  const after = withUnsent(draft, change)
  const ready =
    openCauses(after).length === 0 &&
    readiness(after).length === 0 &&
    !isDuplicate(after) &&
    Object.keys(validateValues(toValues(after.fields))).length === 0 &&
    !lowFields(after).some((field) => field !== 'date' && REQUIRED_HELD.includes(field)) &&
    (after.confidence === null || after.confidence >= LOW_CONFIDENCE)
  return ready && !draft.selected ? { ...change, selected: true } : change
}

export const validDate = (draft: Draft, value: string) =>
  validateValues({ ...toValues(draft.fields), date: value }).date === undefined

export function datePlaceholder(draft: Draft): string {
  if (draft.fields.date) return draft.fields.date
  const day = draft.fields.date_month_day
  return day && monthDayOf(draft) ? `YYYY-${day}` : 'YYYY-MM-DD'
}
