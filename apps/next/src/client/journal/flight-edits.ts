// Flight writes for the Journal detail sheet's Edit mode: one PATCH /api/flights/:id carrying every changed field together, the
// client-side consequence preview, Undo and the merge of the server's row into the cached payload.
// Loaded only when a member starts an edit: it carries the airport, airline and aircraft catalogues.
import { familyOf, findAircraft } from '@kuuki/data/aircraft-lookup'
import { findAirport } from '@kuuki/data/airport-lookup'
import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import type { DerivedAck } from '@kuuki/client/derivedState'
import { calculateFlightDistance } from '@kuuki/client/geo'
import type { Airport } from '@kuuki/shared/types'
import { formatDistanceKm, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import {
  flightErrorMessage,
  validateFlightValues,
  type FlightField,
  type FlightValues,
} from '../capture/flight-messages'
import { aircraftChoices, airlineChoices, airportChoices } from '../capture/reference-choices'
import { sendWithZone, withZone } from '../capture/flight-writes'
import { airlineName } from '../import/reference'
import type { JournalFlight, JournalRefs } from './model'

export { aircraftChoices, airlineChoices, airportChoices }

/** The fields the sheet's Edit mode changes. Every one is accepted by the PATCH as-is. */
export type EditableField =
  | 'origin'
  | 'destination'
  | 'date'
  | 'departure_time'
  | 'arrival_time'
  | 'airline_iata'
  | 'flight_number'
  | 'aircraft_icao'
export const EDITABLE_FIELDS: readonly EditableField[] = [
  'origin',
  'destination',
  'date',
  'departure_time',
  'arrival_time',
  'airline_iata',
  'flight_number',
  'aircraft_icao',
]

/** The PATCH answer: the own-flight DTO plus the derived-state acknowledgement. */
export type FlightDto = Omit<JournalFlight, 'origin_country' | 'destination_country'> &
  DerivedAck & { undo_token?: string }

/** Rejected: the server answered no (drafts stay, the form shows why). Unknown: the request may or may not have landed (drafts stay, outcome is not claimed). */
export type EditOutcome =
  | { status: 'saved' }
  | { status: 'rejected'; message: string; messageCopy?: Record<Locale, string> }
  | { status: 'unknown'; message: string; messageCopy?: Record<Locale, string> }
/** A save attempt: `invalid` never left the browser and names each field's problem. */
export type SaveOutcome = EditOutcome | { status: 'invalid'; errors: FieldErrors }
export type FieldErrors = Partial<Record<EditableField, string>>
/** Edit text per field ('' for none). */
export type Drafts = Record<EditableField, string>
/** Normalized values to send, only for the fields that differ from the flight. */
export type Changes = Partial<Record<EditableField, string | null>>

export type FlightWrite = { outcome: EditOutcome; flight?: FlightDto }

/** What Undo needs: the fields one save changed and the editable values it left behind. */
export type EditRecord = {
  flightId: number
  fields: EditableField[]
  after: Record<EditableField, string | null>
  seq: number
  undoToken: string
}

export type AirportLookup = (
  iata: string,
) => Pick<Airport, 'latitude' | 'longitude' | 'countryCode'> | undefined

const say = (locale: Locale, en: string, ru: string) => (locale === 'ru' ? ru : en)
const REQUIRED: ReadonlySet<EditableField> = new Set(['origin', 'destination', 'date'])
const CODES: ReadonlySet<EditableField> = new Set([
  'origin',
  'destination',
  'airline_iata',
  'aircraft_icao',
])
const FORM_KEY: Record<EditableField, FlightField> = {
  origin: 'origin',
  destination: 'destination',
  date: 'date',
  departure_time: 'departure',
  arrival_time: 'arrival',
  airline_iata: 'airline',
  flight_number: 'number',
  aircraft_icao: 'aircraft',
}

/** The flight's current values as edit text ('' for none). */
export const draftsOf = (flight: Pick<JournalFlight, EditableField>): Drafts =>
  Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, flight[field] ?? ''])) as Drafts

/** The value to send: trimmed, codes upper-cased, an emptied optional field becomes null. */
export function normalizeDraft(field: EditableField, draft: string): string | null {
  const text = CODES.has(field) ? draft.trim().toUpperCase() : draft.trim()
  return text || REQUIRED.has(field) ? text : null
}

export const editableValues = (
  flight: Pick<JournalFlight, EditableField>,
): Record<EditableField, string | null> =>
  Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, flight[field] ?? null])) as Record<
    EditableField,
    string | null
  >

/** The fields whose normalized draft differs from the flight, with the value to send. Empty when nothing changed. */
export function changesOf(flight: Pick<JournalFlight, EditableField>, drafts: Drafts): Changes {
  const changes: Changes = {}
  for (const field of EDITABLE_FIELDS) {
    const value = normalizeDraft(field, drafts[field])
    if (value !== (flight[field] ?? null)) changes[field] = value
  }
  return changes
}

/**
 * The localized problem with each changed draft, checked together as the full form checks them. Unchanged fields are not sent, so a
 * legacy value the catalogue no longer knows never blocks another edit. Empty when the changes may be sent.
 */
export function validateDrafts(
  flight: Pick<JournalFlight, EditableField>,
  drafts: Drafts,
  locale: Locale,
): FieldErrors {
  const value = (field: EditableField) => normalizeDraft(field, drafts[field]) ?? ''
  const values: FlightValues = {
    date: value('date'),
    origin: value('origin'),
    destination: value('destination'),
    airline: value('airline_iata'),
    aircraft: value('aircraft_icao'),
    number: value('flight_number'),
    departure: value('departure_time'),
    arrival: value('arrival_time'),
  }
  const formErrors = validateFlightValues(values, locale)
  const changed = changesOf(flight, drafts)
  const errors: FieldErrors = {}
  for (const field of EDITABLE_FIELDS) {
    const problem = formErrors[FORM_KEY[field]]
    if (problem && field in changed) errors[field] = problem
  }
  // The same-airport check lands on the destination; a changed origin owns it when the destination stayed.
  if (
    formErrors.destination &&
    'origin' in changed &&
    !errors.destination &&
    values.origin === values.destination
  )
    errors.origin = formErrors.destination
  return errors
}

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function countryName(locale: Locale, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * One line saying what a pending airport or date change will do, computed from the bundled catalogue before anything is sent.
 * The PATCH response is the truth; this is a forecast. Null when the draft is unchanged, invalid or changes nothing else.
 */
export function previewConsequence(
  flight: JournalFlight,
  field: EditableField,
  draft: string,
  locale: Locale,
  deps: { lookup?: AirportLookup; today?: string } = {},
): string | null {
  const value = normalizeDraft(field, draft)
  if (!value || value === flight[field]) return null
  if (field === 'origin' || field === 'destination') {
    const lookup = deps.lookup ?? findAirport
    const origin = field === 'origin' ? value : flight.origin,
      destination = field === 'destination' ? value : flight.destination
    if (origin === destination) return null
    const from = lookup(origin),
      to = lookup(destination)
    if (!from || !to) return null
    const distance = formatDistanceKm(
      locale,
      calculateFlightDistance(from.latitude, from.longitude, to.latitude, to.longitude),
    )
    const before = field === 'origin' ? flight.origin_country : flight.destination_country
    const country = (field === 'origin' ? from : to).countryCode
    const countryChanges = !!country && country !== before
    if (locale === 'ru')
      return `После сохранения: расстояние ${distance}${countryChanges ? `, страна ${countryName(locale, country)}` : ''}, длительность пересчитается.`
    return `Distance becomes ${distance}${countryChanges ? `, country changes to ${countryName(locale, country)}` : ''}, duration will be recalculated.`
  }
  if (field === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const now = deps.today ?? today()
    if (value > now && flight.lifecycle_state !== 'upcoming') {
      return flight.lifecycle_state === 'logged'
        ? say(
            locale,
            'This flight becomes upcoming and loses its confirmation.',
            'Перелёт станет предстоящим, подтверждение будет снято.',
          )
        : say(locale, 'This flight becomes upcoming.', 'Перелёт станет предстоящим.')
    }
    if (value <= now && flight.lifecycle_state === 'upcoming')
      return say(
        locale,
        'This flight will wait for your confirmation.',
        'Перелёт будет ждать вашего подтверждения.',
      )
    return null
  }
  return null
}

/** What the pending changes will do, one line each: the route's new distance and country, then a lifecycle move from the date. */
export function previewChanges(
  flight: JournalFlight,
  changes: Changes,
  locale: Locale,
  deps: { lookup?: AirportLookup; today?: string } = {},
): string[] {
  const lines: string[] = []
  const { origin, destination, date } = changes
  // Both ends changed: forecast the destination against the new origin.
  if (destination)
    lines.push(
      previewConsequence(
        origin ? { ...flight, origin } : flight,
        'destination',
        destination,
        locale,
        deps,
      ) ?? '',
    )
  else if (origin) lines.push(previewConsequence(flight, 'origin', origin, locale, deps) ?? '')
  if (date) lines.push(previewConsequence(flight, 'date', date, locale, deps) ?? '')
  return lines.filter(Boolean)
}

/** Copy for an outcome nobody can confirm: the compare-and-set update may have landed before the answer was lost. */
export const unknownMessage = (locale: Locale) =>
  say(
    locale,
    'Could not confirm the change: it may or may not be saved. The list is refreshing. Check it, then save again if needed.',
    'Не удалось подтвердить изменение: оно могло сохраниться, а могло и нет. Список обновляется. Проверьте его и при необходимости сохраните снова.',
  )

export const sessionChangedMessage = (locale: Locale) =>
  say(
    locale,
    'Your session changed. Reopen the Journal before editing.',
    'Сессия изменилась. Откройте журнал снова перед редактированием.',
  )

/** 4xx: the server said no and nothing changed. 5xx, a dropped connection or an abort: unknown. */
export function failureOutcome(
  cause: unknown,
  locale: Locale,
): Exclude<EditOutcome, { status: 'saved' }> {
  if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
    if (cause.code === 'STATE_CONFLICT')
      return {
        status: 'rejected',
        message: say(
          locale,
          'This flight changed somewhere else. The list is refreshing; check it and try again.',
          'Перелёт изменился в другом месте. Список обновляется; проверьте его и повторите.',
        ),
      }
    return { status: 'rejected', message: flightErrorMessage(cause, locale, 'save') }
  }
  return { status: 'unknown', message: unknownMessage(locale) }
}

/**
 * One PATCH carrying every changed field, so related changes land together or not at all. The answer is applied only while the
 * session that asked is still current and it really is this flight with the sent values; anything else is unknown. A sign-out or
 * owner switch aborts the request through `trackPrivateOperation`.
 */
export async function writeFlightFields(
  flightId: number,
  changes: Changes,
  locale: Locale,
  generation = getAuthGeneration(),
  undoToken?: string,
): Promise<FlightWrite> {
  if (generation !== getAuthGeneration())
    return {
      outcome: {
        status: 'rejected',
        message: sessionChangedMessage(locale),
        messageCopy: { en: sessionChangedMessage('en'), ru: sessionChangedMessage('ru') },
      },
    }
  const controller = new AbortController()
  const untrack = trackPrivateOperation(controller)
  try {
    const body = undoToken ? { undo_token: undoToken } : { ...changes, offer_undo: true }
    const dto = await sendWithZone((zone) =>
      api.patch<FlightDto>(`/api/flights/${flightId}`, withZone(body, zone), {
        signal: controller.signal,
      }),
    )
    if (generation !== getAuthGeneration())
      return {
        outcome: {
          status: 'unknown',
          message: sessionChangedMessage(locale),
          messageCopy: { en: sessionChangedMessage('en'), ru: sessionChangedMessage('ru') },
        },
      }
    const echoed = (Object.keys(changes) as EditableField[]).every(
      (field) => (dto?.[field] ?? null) === changes[field],
    )
    if (!dto || dto.id !== flightId || (!undoToken && !echoed))
      return {
        outcome: {
          status: 'unknown',
          message: unknownMessage(locale),
          messageCopy: { en: unknownMessage('en'), ru: unknownMessage('ru') },
        },
      }
    return { outcome: { status: 'saved' }, flight: dto }
  } catch (cause) {
    if (generation !== getAuthGeneration())
      return {
        outcome: {
          status: 'unknown',
          message: sessionChangedMessage(locale),
          messageCopy: { en: sessionChangedMessage('en'), ru: sessionChangedMessage('ru') },
        },
      }
    return {
      outcome: {
        ...failureOutcome(cause, locale),
        messageCopy: {
          en: failureOutcome(cause, 'en').message,
          ru: failureOutcome(cause, 'ru').message,
        },
      },
    }
  } finally {
    untrack()
  }
}

/** Undo restores the signed server snapshot only while its complete post-edit state still matches. */
export const undoWrite = (
  record: EditRecord,
  locale: Locale,
  generation = getAuthGeneration(),
): Promise<FlightWrite> =>
  writeFlightFields(record.flightId, {}, locale, generation, record.undoToken)

/** Undo is safe only while the flight still holds exactly what that save left behind, and no later edit of it was recorded. */
export function canUndo(
  record: EditRecord,
  current: JournalFlight | undefined,
  latestSeq: number | undefined,
): boolean {
  if (!current || current.id !== record.flightId || latestSeq !== record.seq) return false
  const now = editableValues(current)
  return EDITABLE_FIELDS.every((field) => now[field] === record.after[field])
}

/**
 * The server's row in the payload's shape. Endpoint countries are not in the DTO: an unchanged airport keeps the payload's country,
 * a changed one takes the catalogue's (the refetch that follows brings the server's).
 */
export function mergeSavedFlight(
  previous: JournalFlight,
  dto: FlightDto,
  lookup: AirportLookup = findAirport,
): JournalFlight {
  const next = { ...previous } as Record<string, unknown>
  const source = dto as unknown as Record<string, unknown>
  for (const key of Object.keys(previous))
    if (key !== 'origin_country' && key !== 'destination_country' && key in source)
      next[key] = source[key]
  const merged = next as JournalFlight
  merged.origin_country =
    merged.origin === previous.origin
      ? previous.origin_country
      : lookup(merged.origin)?.countryCode || null
  merged.destination_country =
    merged.destination === previous.destination
      ? previous.destination_country
      : lookup(merged.destination)?.countryCode || null
  return merged
}

/** Reference names the payload does not carry yet for a saved flight, from the bundled catalogue. Empty sections are omitted. */
export function refsPatch(flight: JournalFlight, refs: JournalRefs): Partial<JournalRefs> {
  const patch: Partial<JournalRefs> = {}
  for (const code of [flight.origin, flight.destination]) {
    if (refs.airports[code]) continue
    const airport = findAirport(code)
    if (airport)
      patch.airports = {
        ...patch.airports,
        [code]: {
          city: airport.city || null,
          name: airport.name,
          country: airport.countryCode || null,
        },
      }
  }
  const airline = flight.airline_iata
  if (airline && !refs.airlines[airline]) {
    const name = airlineName(airline)
    if (name) patch.airlines = { [airline]: { name } }
  }
  const icao = flight.aircraft_icao
  if (icao && !refs.aircraft[icao]) {
    const ref = findAircraft(icao)
    if (ref)
      patch.aircraft = {
        [icao]: {
          name: ref.name ?? null,
          family: familyOf(icao),
          manufacturer: ref.manufacturer ?? null,
          type: ref.type ?? null,
        },
      }
  }
  return patch
}
