import { expect, it } from 'vitest'
import { makerOf } from './aircraft-makers'

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
