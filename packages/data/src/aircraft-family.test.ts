import { expect, it } from 'vitest'
import { aircraft } from './index'
import { familyOf, findAircraft } from './aircraft-lookup'

it('every type has a curated family', () => {
  for (const item of aircraft) {
    expect(typeof item.family).toBe('string')
    expect(item.family.trim().length).toBeGreaterThan(0)
  }
  expect(new Set(aircraft.map(item => item.family)).size).toBeLessThan(aircraft.length)
})

it.each([
  ['A20N', 'A320'], ['B38M', '737'], ['B77W', '777'], ['E195', 'E-Jet'], ['AT72', 'ATR 42/72'],
])('%s belongs to the %s family', (icao, family) => {
  expect(findAircraft(icao)).toBeDefined()
  expect(findAircraft(icao)?.family).toBe(family)
})

it('uses the reference model only when the package family is unavailable', () => {
  expect(familyOf('A20N', { model: 'Fallback' })).toBe('A320')
  expect(familyOf('ZZZZ', { model: 'Foo 1' })).toBe('Foo 1')
  expect(familyOf('ZZZZ', { model: null })).toBeNull()
  expect(familyOf('ZZZZ')).toBeNull()
})
