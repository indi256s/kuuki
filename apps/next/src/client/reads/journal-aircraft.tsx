'use client'

import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import type { DerivedAck } from '@kuuki/client/derivedState'
import { Combobox } from '../ui/combobox'
import type { InlineEditFieldProps, InlineEditOutcome } from '../ui/inline-edit'
import { aircraftChoices } from '../capture/reference-choices'
import { flightErrorMessage } from '../capture/flight-messages'
import { updateFlight } from '../capture/flight-writes'
import type { Locale } from '../../server/locale'

// Loaded only when a member starts an inline aircraft edit: it carries the aircraft catalogue and the flight write module.

const say = (locale: Locale, en: string, ru: string) => locale === 'ru' ? ru : en

export function AircraftField({ locale, value, onChange, inputRef, error, disabled }: InlineEditFieldProps & { locale: Locale }) {
  return <Combobox label={say(locale, 'Aircraft', 'Самолёт')} value={value} onChange={onChange} inputRef={inputRef} choices={aircraftChoices} locale={locale} error={error} disabled={disabled} />
}

export type AircraftWrite = { outcome: InlineEditOutcome; row?: { id: number; aircraft_icao: string } & DerivedAck }

/**
 * One PATCH through the same owner-qualified update authority as the full form, carrying only `aircraft_icao`. The code must be a known aircraft;
 * clearing a type stays in the full form. A 4xx answer is a rejection (nothing changed). A 5xx, a dropped connection or an abort is unknown: the
 * compare-and-set update may have been applied before the response was lost.
 */
export async function saveAircraft(flightId: number, draft: string, locale: Locale, generation = getAuthGeneration()): Promise<AircraftWrite> {
  const code = draft.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,4}$/.test(code) || !findAircraft(code)) return { outcome: { status: 'rejected', message: say(locale, 'Choose an aircraft from the list, or cancel.', 'Выберите самолёт из списка или отмените.') } }
  const unknown = { outcome: { status: 'unknown', message: say(locale, 'Could not confirm the change: the aircraft may or may not be saved. The list is refreshing. Check it, then save again if needed.', 'Не удалось подтвердить изменение: самолёт мог сохраниться, а мог и нет. Список обновляется. Проверьте его и при необходимости сохраните снова.') } } satisfies AircraftWrite
  if (generation !== getAuthGeneration()) return unknown
  try {
    const row = await updateFlight(flightId, { aircraft_icao: code })
    // Sign-out or an owner switch happened meanwhile: this answer belongs to another identity and is never applied.
    return generation === getAuthGeneration() && row.id === flightId && row.aircraft_icao === code
      ? { outcome: { status: 'saved' }, row: { ...row, aircraft_icao: code } } : unknown
  } catch (cause) {
    if (generation !== getAuthGeneration()) return unknown
    if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) return { outcome: { status: 'rejected', message: flightErrorMessage(cause, locale, 'save') } }
    return unknown
  }
}
