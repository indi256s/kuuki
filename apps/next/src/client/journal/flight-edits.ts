// Per-field flight writes for the Journal detail sheet (spec "Detail sheet", D5): one PATCH /api/flights/:id carrying only the changed
// field, the client-side consequence preview, Undo and the merge of the server's row into the cached payload.
// Loaded only when a member starts an edit: it carries the airport, airline and aircraft catalogues.
import { familyOf, findAircraft } from '@kuuki/data/aircraft-lookup'
import { findAirport } from '@kuuki/data/airport-lookup'
import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import type { DerivedAck } from '@kuuki/client/derivedState'
import { calculateFlightDistance } from '@kuuki/client/geo'
import type { Airport } from '@kuuki/shared/types'
import { formatDistanceKm, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import { flightErrorMessage, validateFlightValues, type FlightField, type FlightValues } from '../capture/flight-messages'
import { aircraftChoices, airlineChoices, airportChoices } from '../capture/reference-choices'
import { sendWithZone, withZone } from '../capture/flight-writes'
import { airlineName } from '../import/reference'
import type { InlineEditOutcome } from '../ui/inline-edit'
import type { JournalFlight, JournalRefs } from './model'

export { aircraftChoices, airlineChoices, airportChoices }

/** The fields the sheet edits inline. Every one is accepted by the PATCH as-is. */
export type EditableField = 'origin' | 'destination' | 'date' | 'departure_time' | 'arrival_time' | 'airline_iata' | 'flight_number' | 'aircraft_icao'
export const EDITABLE_FIELDS: readonly EditableField[] = ['origin', 'destination', 'date', 'departure_time', 'arrival_time', 'airline_iata', 'flight_number', 'aircraft_icao']

/** The PATCH answer: the own-flight DTO plus the derived-state acknowledgement. */
export type FlightDto = Omit<JournalFlight, 'origin_country' | 'destination_country'> & DerivedAck & { undo_token?: string }

export type FieldWrite = { outcome: InlineEditOutcome; flight?: FlightDto }

/** What Undo needs: the field, the value before the save and the editable values the save left behind. */
export type EditRecord = { flightId: number; field: EditableField; previous: string | null; after: Record<EditableField, string | null>; seq: number; undoToken: string }

export type AirportLookup = (iata: string) => Pick<Airport, 'latitude' | 'longitude' | 'countryCode'> | undefined

const say = (locale: Locale, en: string, ru: string) => locale === 'ru' ? ru : en
const REQUIRED: ReadonlySet<EditableField> = new Set(['origin', 'destination', 'date'])
const CODES: ReadonlySet<EditableField> = new Set(['origin', 'destination', 'airline_iata', 'aircraft_icao'])
const FORM_KEY: Record<EditableField, FlightField> = {
  origin: 'origin', destination: 'destination', date: 'date', departure_time: 'departure', arrival_time: 'arrival',
  airline_iata: 'airline', flight_number: 'number', aircraft_icao: 'aircraft',
}

/** The field's current value as edit text ('' for none). */
export const fieldText = (flight: JournalFlight, field: EditableField): string => flight[field] ?? ''

/** The value to send: trimmed, codes upper-cased, an emptied optional field becomes null. */
export function normalizeDraft(field: EditableField, draft: string): string | null {
  const text = CODES.has(field) ? draft.trim().toUpperCase() : draft.trim()
  return text || REQUIRED.has(field) ? text : null
}

export const editableValues = (flight: Pick<JournalFlight, EditableField>): Record<EditableField, string | null> =>
  Object.fromEntries(EDITABLE_FIELDS.map(field => [field, flight[field] ?? null])) as Record<EditableField, string | null>

/** The localized problem with a draft, checked as the full form checks it, or null when it may be sent. */
export function validateDraft(flight: JournalFlight, field: EditableField, draft: string, locale: Locale): string | null {
  const value = normalizeDraft(field, draft) ?? ''
  const values: FlightValues = {
    date: flight.date, origin: flight.origin, destination: flight.destination, airline: flight.airline_iata ?? '', aircraft: flight.aircraft_icao ?? '',
    number: flight.flight_number ?? '', departure: flight.departure_time ?? '', arrival: flight.arrival_time ?? '',
  }
  values[FORM_KEY[field]] = value
  if (REQUIRED.has(field) && !value) return field === 'date' ? say(locale, 'Enter a date.', 'Введите дату.') : say(locale, 'Choose an airport from the list.', 'Выберите аэропорт из списка.')
  const errors = validateFlightValues(values, locale)
  // The same-airport check lands on the destination; an origin edit owns it too.
  return errors[FORM_KEY[field]] ?? (field === 'origin' ? errors.destination : undefined) ?? null
}

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function countryName(locale: Locale, code: string): string {
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code } catch { return code }
}

/**
 * One line saying what a pending airport or date change will do, computed from the bundled catalogue before anything is sent.
 * The PATCH response is the truth; this is a forecast. Null when the draft is unchanged, invalid or changes nothing else.
 */
export function previewConsequence(flight: JournalFlight, field: EditableField, draft: string, locale: Locale, deps: { lookup?: AirportLookup; today?: string } = {}): string | null {
  const value = normalizeDraft(field, draft)
  if (!value || value === flight[field]) return null
  if (field === 'origin' || field === 'destination') {
    const lookup = deps.lookup ?? findAirport
    const origin = field === 'origin' ? value : flight.origin, destination = field === 'destination' ? value : flight.destination
    if (origin === destination) return null
    const from = lookup(origin), to = lookup(destination)
    if (!from || !to) return null
    const distance = formatDistanceKm(locale, calculateFlightDistance(from.latitude, from.longitude, to.latitude, to.longitude))
    const before = field === 'origin' ? flight.origin_country : flight.destination_country
    const country = (field === 'origin' ? from : to).countryCode
    const countryChanges = !!country && country !== before
    if (locale === 'ru') return `После сохранения: расстояние ${distance}${countryChanges ? `, страна ${countryName(locale, country)}` : ''}, длительность пересчитается.`
    return `Distance becomes ${distance}${countryChanges ? `, country changes to ${countryName(locale, country)}` : ''}, duration will be recalculated.`
  }
  if (field === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const now = deps.today ?? today()
    if (value > now && flight.lifecycle_state !== 'upcoming') {
      return flight.lifecycle_state === 'logged'
        ? say(locale, 'This flight becomes upcoming and loses its confirmation.', 'Перелёт станет предстоящим, подтверждение будет снято.')
        : say(locale, 'This flight becomes upcoming.', 'Перелёт станет предстоящим.')
    }
    if (value <= now && flight.lifecycle_state === 'upcoming') return say(locale, 'This flight will wait for your confirmation.', 'Перелёт будет ждать вашего подтверждения.')
    return null
  }
  return null
}

/** Copy for an outcome nobody can confirm: the compare-and-set update may have landed before the answer was lost. */
export const unknownMessage = (locale: Locale) => say(locale,
  'Could not confirm the change: it may or may not be saved. The list is refreshing. Check it, then save again if needed.',
  'Не удалось подтвердить изменение: оно могло сохраниться, а могло и нет. Список обновляется. Проверьте его и при необходимости сохраните снова.')

export const sessionChangedMessage = (locale: Locale) => say(locale, 'Your session changed. Reopen the Journal before editing.', 'Сессия изменилась. Откройте журнал снова перед редактированием.')

/** 4xx: the server said no and nothing changed. 5xx, a dropped connection or an abort: unknown. */
export function failureOutcome(cause: unknown, locale: Locale): InlineEditOutcome {
  if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
    if (cause.code === 'STATE_CONFLICT') return { status: 'rejected', message: say(locale, 'This flight changed somewhere else. The list is refreshing; check it and try again.', 'Перелёт изменился в другом месте. Список обновляется; проверьте его и повторите.') }
    return { status: 'rejected', message: flightErrorMessage(cause, locale, 'save') }
  }
  return { status: 'unknown', message: unknownMessage(locale) }
}

/**
 * One PATCH carrying only `field`. The answer is applied only while the session that asked is still current and it really is this
 * flight with the sent value; anything else is unknown. A sign-out or owner switch aborts the request through `trackPrivateOperation`.
 */
export async function writeFlightField(flightId: number, field: EditableField, value: string | null, locale: Locale, generation = getAuthGeneration(), undoToken?: string): Promise<FieldWrite> {
  if (generation !== getAuthGeneration()) return { outcome: { status: 'rejected', message: sessionChangedMessage(locale) } }
  const controller = new AbortController()
  const untrack = trackPrivateOperation(controller)
  try {
    const body = undoToken ? { undo_token: undoToken } : { [field]: value, offer_undo: true }
    const dto = await sendWithZone(zone => api.patch<FlightDto>(`/api/flights/${flightId}`, withZone(body, zone), { signal: controller.signal }))
    if (generation !== getAuthGeneration()) return { outcome: { status: 'unknown', message: sessionChangedMessage(locale) } }
    if (!dto || dto.id !== flightId || (!undoToken && (dto[field] ?? null) !== value)) return { outcome: { status: 'unknown', message: unknownMessage(locale) } }
    return { outcome: { status: 'saved' }, flight: dto }
  } catch (cause) {
    if (generation !== getAuthGeneration()) return { outcome: { status: 'unknown', message: sessionChangedMessage(locale) } }
    return { outcome: failureOutcome(cause, locale) }
  } finally { untrack() }
}

/** Undo restores the signed server snapshot only while its complete post-edit state still matches. */
export const undoWrite = (record: EditRecord, locale: Locale, generation = getAuthGeneration()): Promise<FieldWrite> =>
  writeFlightField(record.flightId, record.field, record.previous, locale, generation, record.undoToken)

/** Undo is safe only while the flight still holds exactly what that save left behind, and no later edit of it was recorded. */
export function canUndo(record: EditRecord, current: JournalFlight | undefined, latestSeq: number | undefined): boolean {
  if (!current || current.id !== record.flightId || latestSeq !== record.seq) return false
  const now = editableValues(current)
  return EDITABLE_FIELDS.every(field => now[field] === record.after[field])
}

/**
 * The server's row in the payload's shape. Endpoint countries are not in the DTO: an unchanged airport keeps the payload's country,
 * a changed one takes the catalogue's (the refetch that follows brings the server's).
 */
export function mergeSavedFlight(previous: JournalFlight, dto: FlightDto, lookup: AirportLookup = findAirport): JournalFlight {
  const next = { ...previous } as Record<string, unknown>
  const source = dto as unknown as Record<string, unknown>
  for (const key of Object.keys(previous)) if (key !== 'origin_country' && key !== 'destination_country' && key in source) next[key] = source[key]
  const merged = next as JournalFlight
  merged.origin_country = merged.origin === previous.origin ? previous.origin_country : lookup(merged.origin)?.countryCode || null
  merged.destination_country = merged.destination === previous.destination ? previous.destination_country : lookup(merged.destination)?.countryCode || null
  return merged
}

/** Reference names the payload does not carry yet for a saved flight, from the bundled catalogue. Empty sections are omitted. */
export function refsPatch(flight: JournalFlight, refs: JournalRefs): Partial<JournalRefs> {
  const patch: Partial<JournalRefs> = {}
  for (const code of [flight.origin, flight.destination]) {
    if (refs.airports[code]) continue
    const airport = findAirport(code)
    if (airport) patch.airports = { ...patch.airports, [code]: { city: airport.city || null, name: airport.name, country: airport.countryCode || null } }
  }
  const airline = flight.airline_iata
  if (airline && !refs.airlines[airline]) {
    const name = airlineName(airline)
    if (name) patch.airlines = { [airline]: { name } }
  }
  const icao = flight.aircraft_icao
  if (icao && !refs.aircraft[icao]) {
    const ref = findAircraft(icao)
    if (ref) patch.aircraft = { [icao]: { name: ref.name ?? null, family: familyOf(icao), manufacturer: ref.manufacturer ?? null, type: ref.type ?? null } }
  }
  return patch
}
