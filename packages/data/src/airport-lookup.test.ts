import { expect, it } from 'vitest'
import airports from './airports.json' with { type: 'json' }
import { findAirport } from './airport-lookup'
import { findAirportLabel } from './airport-labels'

it('preserves every airport record when combining the presentation and flight details', () => {
  expect(airports.map(({ iata }) => findAirport(iata.toLowerCase()))).toEqual(airports)
  expect(airports.map(({ iata }) => findAirportLabel(iata.toLowerCase()))).toEqual(
    airports.map(({ iata, name, city }) => ({ iata, name, city })),
  )
  expect(findAirport('ZZZ')).toBeUndefined()
  expect(findAirportLabel('ZZZ')).toBeUndefined()
})
