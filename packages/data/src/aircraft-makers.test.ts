import { expect, it } from 'vitest'
import aircraft from './aircraft.json'
import { AIRCRAFT_MAKERS, MAKER_SLOTS, makerOf } from './aircraft-makers'

it('every reference aircraft has a slot', () => {
  expect(MAKER_SLOTS).toEqual(['airbus', 'boeing', 'embraer', 'atr', 'other', 'unknown'])
  for (const { icao } of aircraft) {
    expect(Object.hasOwn(AIRCRAFT_MAKERS, icao), icao).toBe(true)
    expect(MAKER_SLOTS.slice(0, -1)).toContain(makerOf(icao))
  }
})

it.each([
  ['BCS3', 'airbus'], ['BCS1', 'airbus'], ['A3ST', 'airbus'],
  ['B712', 'boeing'], ['B38M', 'boeing'], ['BLCF', 'boeing'],
  ['MD11', 'other'], ['E190', 'embraer'], ['E170', 'embraer'],
  ['E195', 'embraer'], ['E290', 'embraer'], ['E295', 'embraer'],
  ['E75L', 'embraer'], ['E75S', 'embraer'], ['E145', 'other'], ['E55P', 'other'],
  ['AT43', 'atr'], ['AT45', 'atr'], ['AT46', 'atr'], ['AT72', 'atr'], ['AT76', 'atr'],
  ['DH8D', 'other'], ['SU95', 'other'], ['CRJ9', 'other'], ['A124', 'other'],
  ['bcs3', 'airbus'], ['e75s', 'embraer'],
  [null, 'unknown'], [undefined, 'unknown'], ['', 'unknown'],
  ['A999', 'unknown'], ['B999', 'unknown'], ['E175', 'unknown'], ['AT99', 'unknown'],
])('current type designation: %s → %s', (icao, expected) => {
  expect(makerOf(icao)).toBe(expected)
})
