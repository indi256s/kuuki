import { expect, it } from 'vitest'
import { arrivalOrdinal } from './arrivals'
import type { JournalFlight, JournalPayload } from './model'

const flight = (id: number, overrides: Partial<JournalFlight> = {}) =>
  ({
    id,
    date: '2024-05-04',
    origin: 'TBS',
    destination: 'SVO',
    arrival_utc: null,
    departure_utc: null,
    lifecycle_state: 'logged',
    destination_country: 'RU',
    ...overrides,
  }) as JournalFlight
const payloadOf = (flights: JournalFlight[]) =>
  ({
    flights,
    firsts: {},
    refs: {
      airports: {
        SVO: { city: 'Moscow', name: 'Sheremetyevo', country: 'RU' },
        VKO: { city: 'Moscow', name: 'Vnukovo', country: 'RU' },
        XYZ: { city: null, name: 'Nowhere Field', country: null },
      },
      airlines: {},
      aircraft: {},
    },
  }) as unknown as JournalPayload

it('counts logged arrivals per city in date order, across the city’s airports', () => {
  const flights = [
    flight(1, { date: '2024-03-01', destination: 'VKO' }),
    flight(2, { date: '2024-05-04' }),
    flight(3, { date: '2023-01-01', lifecycle_state: 'awaiting' }),
    flight(4, { date: '2025-01-01', lifecycle_state: 'upcoming' }),
    flight(5, { date: '2022-07-01', destination: 'XYZ' }),
  ]
  const payload = payloadOf(flights)
  expect(arrivalOrdinal(payload, flights[0])).toEqual({ ordinal: 1, city: 'Moscow' })
  expect(arrivalOrdinal(payload, flights[1])).toEqual({ ordinal: 2, city: 'Moscow' })
  // Only logged flights get, or count towards, an ordinal.
  expect(arrivalOrdinal(payload, flights[2])).toBeNull()
  expect(arrivalOrdinal(payload, flights[3])).toBeNull()
  // No city in the reference data: the airport stands alone under its name.
  expect(arrivalOrdinal(payload, flights[4])).toEqual({ ordinal: 1, city: 'Nowhere Field' })
})

it('orders same-day arrivals by instant, then untimed ones by id, whatever the payload order', () => {
  const late = flight(1, { arrival_utc: '2024-05-04T20:00:00Z' }),
    untimed = flight(2),
    early = flight(3, { arrival_utc: '2024-05-04T08:00:00Z' }),
    untimedLater = flight(4)
  for (const order of [
    [late, untimed, early, untimedLater],
    [untimedLater, early, untimed, late],
  ]) {
    const payload = payloadOf(order)
    expect(
      [early, late, untimed, untimedLater].map((item) => arrivalOrdinal(payload, item)?.ordinal),
    ).toEqual([1, 2, 3, 4])
  }
})
