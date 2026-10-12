// Pure review rules shared by the row editor, the manual row and the sticky confirm bar: field validation, what blocks a
// row, which rows are confirmable and how confidence reads. The server stays authoritative; this only keeps the form
// from sending what it will refuse and explains why a row cannot be saved yet.
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { findAirport } from '@kuuki/data/airport-lookup'
import type { RowOutcome } from './confirm-runner'
import type { DraftChange } from './draft-saver'
import type { Draft, DraftFields } from './import-types'

export const FIELDS = [
  'date',
  'origin',
  'destination',
  'airline_iata',
  'flight_number',
  'aircraft_icao',
  'departure_time',
  'arrival_time',
] as const
export type FieldName = (typeof FIELDS)[number]
export type FieldValues = Record<FieldName, string>

/** Below this a row or field is shown as "check this". Same cut as the aircraft suggestions. */
export const LOW_CONFIDENCE = 0.7

export const emptyValues = (): FieldValues => ({
  date: '',
  origin: '',
  destination: '',
  airline_iata: '',
  flight_number: '',
  aircraft_icao: '',
  departure_time: '',
  arrival_time: '',
})

export const hasValues = (values: FieldValues) => FIELDS.some((name) => values[name].trim() !== '')

export const toValues = (fields: Partial<DraftFields>): FieldValues => ({
  ...emptyValues(),
  ...Object.fromEntries(
    FIELDS.map((name) => [name, typeof fields[name] === 'string' ? (fields[name] as string) : '']),
  ),
})

export type FieldError =
  | 'dateRequired'
  | 'dateInvalid'
  | 'iata'
  | 'sameAirport'
  | 'unknownAirport'
  | 'airline'
  | 'flightNumber'
  | 'aircraft'
  | 'unknownAircraft'
  | 'time'

const realDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  )
}

/** One validation path for draft edits and inline manual rows. Mirrors the flight validator the server applies. */
export function validateValues(input: FieldValues): Partial<Record<FieldName, FieldError>> {
  const value = {
    ...input,
    origin: input.origin.trim().toUpperCase(),
    destination: input.destination.trim().toUpperCase(),
    airline_iata: input.airline_iata.trim().toUpperCase(),
    aircraft_icao: input.aircraft_icao.trim().toUpperCase(),
    flight_number: input.flight_number.trim(),
    date: input.date.trim(),
    departure_time: input.departure_time.trim(),
    arrival_time: input.arrival_time.trim(),
  }
  const errors: Partial<Record<FieldName, FieldError>> = {}
  if (!value.date) errors.date = 'dateRequired'
  else if (!realDate(value.date)) errors.date = 'dateInvalid'
  for (const key of ['origin', 'destination'] as const) {
    if (!/^[A-Z]{3}$/.test(value[key])) errors[key] = 'iata'
    else if (!findAirport(value[key])) errors[key] = 'unknownAirport'
  }
  if (!errors.origin && !errors.destination && value.origin === value.destination)
    errors.destination = 'sameAirport'
  if (value.airline_iata && !/^[A-Z0-9]{2}$/.test(value.airline_iata))
    errors.airline_iata = 'airline'
  if (value.flight_number.length > 20) errors.flight_number = 'flightNumber'
  if (value.aircraft_icao) {
    if (!/^[A-Z0-9]{2,4}$/.test(value.aircraft_icao)) errors.aircraft_icao = 'aircraft'
    else if (!findAircraft(value.aircraft_icao)) errors.aircraft_icao = 'unknownAircraft'
  }
  for (const key of ['departure_time', 'arrival_time'] as const) {
    if (value[key] && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value[key]))
      errors[key] = 'time'
  }
  return errors
}

/** Normalised copy of the values (codes upper-cased, text trimmed), the form the server stores. */
export const normaliseValues = (input: FieldValues): FieldValues => ({
  ...input,
  date: input.date.trim(),
  origin: input.origin.trim().toUpperCase(),
  destination: input.destination.trim().toUpperCase(),
  airline_iata: input.airline_iata.trim().toUpperCase(),
  aircraft_icao: input.aircraft_icao.trim().toUpperCase(),
  flight_number: input.flight_number.trim(),
  departure_time: input.departure_time.trim(),
  arrival_time: input.arrival_time.trim(),
})

/** Only the fields that differ from the stored ones; a cleared optional field is `null`. */
export function changedFields(
  current: Partial<DraftFields>,
  next: FieldValues,
): Record<string, string | null> {
  const before = toValues(current)
  const after = normaliseValues(next)
  const changed: Record<string, string | null> = {}
  for (const name of FIELDS)
    if (before[name] !== after[name]) changed[name] = after[name] === '' ? null : after[name]
  return changed
}

/** The draft as the member sees it: the stored row with their unsent change laid over it. */
export function withUnsent(draft: Draft, change: DraftChange | null | undefined): Draft {
  if (!change) return draft
  const fields = { ...draft.fields } as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(change.fields ?? {})) {
    if (value === null) delete fields[key]
    else fields[key] = value
  }
  // Mirrors the server: a changed date voids the flown confirmation unless the same patch states it afresh.
  if (change.flownConfirmed === undefined && fields.date !== draft.fields.date)
    delete fields.flown_confirmed
  else if (change.flownConfirmed === true) fields.flown_confirmed = true
  else if (change.flownConfirmed === false) delete fields.flown_confirmed
  return {
    ...draft,
    fields: fields as unknown as DraftFields,
    selected: change.selected ?? draft.selected,
    yearConfirmed: change.yearConfirmed ?? draft.yearConfirmed,
    duplicateAcknowledged: change.duplicateAcknowledged ?? draft.duplicateAcknowledged,
    edited: draft.edited || Boolean(change.fields),
  }
}

/**
 * The snapshot with the server's confirmed saves laid over it. A confirm answer is authoritative even when the read that
 * should follow it fails, so a row the answer saved is shown as saved until a newer snapshot says the same thing.
 */
export function withSaved(drafts: Draft[], outcomes: ReadonlyMap<string, RowOutcome>): Draft[] {
  if (outcomes.size === 0) return drafts
  return drafts.map((draft) => {
    const outcome = outcomes.get(draft.id)
    return outcome?.status === 'saved' && draft.status === 'review'
      ? { ...draft, status: 'converted', convertedFlightId: outcome.flightId }
      : draft
  })
}

/** The member's calendar day (YYYY-MM-DD), the anchor for year suggestions and for what counts as already flown. */
export const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** A Quick Add row dated today or earlier that the member has not yet said they flew. Future dates convert as upcoming. */
export const needsFlown = (draft: Draft, today: string) =>
  draft.fields.flown_required === true &&
  draft.fields.flown_confirmed !== true &&
  /^\d{4}-\d{2}-\d{2}$/.test(draft.fields.date ?? '') &&
  draft.fields.date <= today

export type Readiness = 'date' | 'year' | 'flown' | 'issue'

/** Why a review row cannot be saved as it stands. Empty means it can. `today` is the member's local YYYY-MM-DD. */
export function readiness(draft: Draft, today: string = localToday()): Readiness[] {
  const blocked: Readiness[] = []
  if (!draft.fields.date) blocked.push('date')
  else if (!draft.yearExplicit && !draft.yearConfirmed) blocked.push('year')
  if (needsFlown(draft, today)) blocked.push('flown')
  if (draft.issue) blocked.push('issue')
  return blocked
}

export const isDuplicate = (draft: Draft) => draft.duplicateFlightId !== null

/** Selected as far as saving goes: a duplicate counts only once the member acknowledged it. */
export const isChosenOn = (draft: Draft, today: string) =>
  draft.status === 'review' &&
  draft.selected &&
  readiness(draft, today).length === 0 &&
  (!isDuplicate(draft) || draft.duplicateAcknowledged)
/** `isChosenOn` for today's local date; takes only the draft so it can be passed straight to `filter`. */
export const isChosen = (draft: Draft) => isChosenOn(draft, localToday())

export interface Partitioned {
  active: Draft[]
  duplicates: Draft[]
  saved: Draft[]
  skipped: Draft[]
}

/** Review rows first (in source order), duplicates collapsed at the end, then what is already saved or skipped. */
export function partition(drafts: Draft[]): Partitioned {
  const sorted = [...drafts].sort((a, b) => a.ordinal - b.ordinal)
  return {
    active: sorted.filter((draft) => draft.status === 'review' && !isDuplicate(draft)),
    duplicates: sorted.filter((draft) => draft.status === 'review' && isDuplicate(draft)),
    saved: sorted.filter((draft) => draft.status === 'converted'),
    skipped: sorted.filter((draft) => draft.status === 'dismissed'),
  }
}

export type RowConfidence = 'high' | 'check' | 'unknown'
export const rowConfidence = (draft: Draft): RowConfidence =>
  draft.confidence === null ? 'unknown' : draft.confidence < LOW_CONFIDENCE ? 'check' : 'high'

/** Fields the source was unsure about (only those that hold a value). */
export function lowFields(draft: Draft): FieldName[] {
  const scores = draft.fieldConfidence
  if (!scores) return []
  return FIELDS.filter(
    (name) =>
      typeof scores[name] === 'number' &&
      scores[name] < LOW_CONFIDENCE &&
      toValues(draft.fields)[name] !== '',
  )
}

export const percent = (score: number) => Math.round(score * 100)
