import { expect, it } from 'vitest'
import { AirportScopeError, decodeAirportScope, encodeAirportScope } from './airportHistory'

it('transports strict inherited facets losslessly and rejects invalid or oversized scopes', () => {
  const filter = {
    countries: ['GE'],
    months: [3],
    airlines: ['TK'],
    period: { years: [2024] },
    depHours: [9],
    routes: ['TBS-BER'],
  }
  expect(decodeAirportScope(encodeAirportScope(filter))).toEqual(filter)
  expect(encodeAirportScope({ airlines: ['TK'], countries: ['GE'] })).toBe(
    encodeAirportScope({ countries: ['GE'], airlines: ['TK'] }),
  )
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  for (const scope of [
    encode({ v: 2, filter: {} }),
    encode({ v: 1, filter: { unknown: ['x'] } }),
    encode({ v: 1, filter: { months: [13] } }),
    '%%%%',
    'a'.repeat(11000),
  ])
    expect(() => decodeAirportScope(scope)).toThrow(AirportScopeError)
  expect(() => encodeAirportScope({ airports: ['x'.repeat(8192)] })).toThrow(AirportScopeError)
})
