import { expect, it } from 'vitest'
import { FlightScanner, type ScannedFlight } from '../../workers/import/scanner'
import { providerFlight, providerText } from './import-fixture'

it('emits only complete flights objects across every string/escape/nesting boundary', () => {
  const rows = [providerFlight({ flight_number: 'quote " brace } backslash \\', extra: { nested: ['{', { x: '}' }] } }), providerFlight({ origin: 'TBS' })]
  const text = providerText(rows, { raw_text: 'private source' })
  const scanner = new FlightScanner()
  const emitted: ScannedFlight[] = []
  for (const character of text) emitted.push(...scanner.push(character))
  expect(emitted).toEqual(rows.map((value, ordinal) => ({ ordinal, value })))
  expect(scanner.finish()).toEqual(rows)
})
it('does not confuse a flights string in another field with the top-level array', () => {
  const scanner = new FlightScanner()
  const row = providerFlight()
  expect([...scanner.push(JSON.stringify({ raw_text: '"flights":[{}]', nested: { flights: [{}] }, flights: [row] }))]).toEqual([{ ordinal: 0, value: row }])
})
it.each(['{"flights":[', '{"flights":[{"origin":"JFK"', '{"flights":[{"origin":"JFK"},oops', '{"flights":[{}]}trailing'])('rejects invalid or truncated envelope %s', text => {
  const scanner = new FlightScanner()
  expect(() => { [...scanner.push(text)]; scanner.finish() }).toThrow()
})
it('retains source ordinals when the array has invalid primitive rows', () => {
  const scanner = new FlightScanner()
  expect([...scanner.push('{"flights":[null,{},false,{}]}')].map(row => row.ordinal)).toEqual([1, 3])
})
it('bounds output bytes and nesting', () => {
  expect(() => [...new FlightScanner().push('x'.repeat(1024 * 1024 + 1))]).toThrow()
  expect(() => [...new FlightScanner().push('{"flights":[{"x":' + '['.repeat(65))]).toThrow()
})
it('rejects a repeated opening chunk that breaks the JSON grammar', () => {
  const scanner = new FlightScanner(); const chunk = '{"flights":[' + JSON.stringify(providerFlight())
  expect([...scanner.push(chunk)]).toHaveLength(1)
  expect(() => { [...scanner.push(chunk)]; scanner.finish() }).toThrow()
})
it('rejects duplicate flights keys rather than reconciling the wrong envelope', () => {
  const scanner = new FlightScanner()
  expect(() => { [...scanner.push('{"flights":[{}],"flights":[{}]}')]; scanner.finish() }).toThrow()
})
it('rejects a repeated flights key even when its first value was not an array', () => {
  const scanner = new FlightScanner(); const emitted: ScannedFlight[] = []
  expect(() => {
    for (const row of scanner.push('{"flights":false,"flights":[' + JSON.stringify(providerFlight()) + ']}')) emitted.push(row)
    scanner.finish()
  }).toThrow()
  expect(emitted).toHaveLength(0)
})
it('classifies a root JSON string as an invalid provider response', () => {
  const scanner = new FlightScanner()
  expect(() => { [...scanner.push('"not an envelope"')]; scanner.finish() }).toThrow(expect.objectContaining({ code: 'PROVIDER_INVALID_RESPONSE' }))
})
