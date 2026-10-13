import { expect, it } from 'vitest'
import aircraft from './aircraft.json' with { type: 'json' }
import { MAKER_NAMES, makerOf } from './aircraft-makers'

it.each([
  ['E145', 'embraer'],
  ['E120', 'embraer'],
  ['CRJ9', 'bombardier'],
  ['DH8D', 'de-havilland'],
  ['SU95', 'sukhoi'],
  ['T154', 'tupolev'],
  ['IL96', 'ilyushin'],
  ['YK42', 'yakovlev'],
  ['AN24', 'antonov'],
  ['MD83', 'mcdonnell-douglas'],
  ['F100', 'fokker'],
  ['SF34', 'saab'],
  ['RJ85', 'bae-systems'],
  ['C208', 'cessna'],
  ['BCS3', 'airbus'],
  [' crj9 ', 'bombardier'],
  ['ZZZZ', 'unknown'],
  [null, 'unknown'],
])('classifies %s by its reference manufacturer as %s', (code, maker) => {
  expect(makerOf(code)).toBe(maker)
})

// Overview has no Other families to fold any more: a manufacturer added to the reference needs its own slot (and colour).
it('names every reference manufacturer', () => {
  const named = new Set<string>(Object.values(MAKER_NAMES))
  expect(aircraft.map((row) => row.manufacturer).filter((name) => !named.has(name))).toEqual([])
})
