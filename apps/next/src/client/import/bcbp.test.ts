import { describe, expect, it } from 'vitest'
import { combineLegs, MAX_LEGS, parseBcbp, type BcbpResult, type Leg } from './bcbp'

interface Block {
  from?: string
  to?: string
  carrier?: string
  flight?: string
  day?: string
  conditional?: string
}

// One 37-character leg block, laid out per Resolution 792, followed by its conditional section.
function block({
  from = 'YUL',
  to = 'FRA',
  carrier = 'AC ',
  flight = '0834 ',
  day = '326',
  conditional = '',
}: Block) {
  const size = conditional.length.toString(16).toUpperCase().padStart(2, '0')
  return `ABC123 ${from}${to}${carrier}${flight}${day}J001A0025 1${size}${conditional}`
}
const header = (legs: number) => `M${legs}${'DESMARAIS/LUC'.padEnd(20)}E`
const pass = (...blocks: string[]) => header(blocks.length) + blocks.join('')

describe('parseBcbp', () => {
  it('projects the airports, carrier, flight number and day of a single-leg pass and nothing else', () => {
    const result = parseBcbp('M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100')

    expect(result).toEqual({
      legs: [
        { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834', dayOfYear: 326 },
      ],
      incomplete: false,
    })
    const serialized = JSON.stringify(result)
    for (const secret of ['DESMARAIS', 'ABC123', '001A', '0025'])
      expect(serialized).not.toContain(secret)
  })

  it('reads every leg in source order, skipping each conditional section by its hex size', () => {
    const text = pass(
      block({ conditional: '>3180  W0AC 06E2A3B4C5D6E7F8' }),
      block({
        from: 'FRA',
        to: 'SIN',
        carrier: 'SQ ',
        flight: '0025 ',
        day: '327',
        conditional: '>318',
      }),
      block({ from: 'SIN', to: 'SYD', carrier: 'SQ ', flight: '0221A', day: '328' }),
    )

    expect(parseBcbp(text)).toEqual({
      legs: [
        { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834', dayOfYear: 326 },
        { origin: 'FRA', destination: 'SIN', airline: 'SQ', flightNumber: '25', dayOfYear: 327 },
        { origin: 'SIN', destination: 'SYD', airline: 'SQ', flightNumber: '221A', dayOfYear: 328 },
      ],
      incomplete: false,
    })
  })

  it('ignores a security section after the last leg', () => {
    const text = pass(block({})) + '^460MEUCIQDk9Z0'
    expect(parseBcbp(text)?.legs).toHaveLength(1)
  })

  it('keeps the readable legs and marks the result incomplete when a later leg is cut off', () => {
    const second = block({ from: 'FRA', to: 'SIN', carrier: 'SQ ', flight: '0025 ' })
    const truncated = header(2) + block({}) + second.slice(0, 20)
    const badAirport = header(2) + block({}) + block({ from: 'F1A' })

    for (const text of [truncated, badAirport]) {
      const result = parseBcbp(text)
      expect(result?.legs).toEqual([
        { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834', dayOfYear: 326 },
      ])
      expect(result?.incomplete).toBe(true)
    }
  })

  it('is not a boarding pass when the first leg is unreadable or the header is wrong', () => {
    const good = pass(block({}))
    const notPasses = [
      '',
      'https://example.com/ticket/123',
      good.slice(0, 59),
      'S' + good.slice(1),
      header(0) + block({}),
      header(5) + block({}),
      pass(block({ from: 'yul' })),
      pass(block({ to: 'F R' })),
      good.slice(0, 58) + 'ZZ',
    ]
    for (const text of notPasses) expect(parseBcbp(text)).toBeNull()
  })

  it('leaves out fields it cannot trust instead of sending placeholders', () => {
    const cases: [Block, Leg][] = [
      [
        { carrier: 'ACA' },
        { origin: 'YUL', destination: 'FRA', flightNumber: '834', dayOfYear: 326 },
      ],
      [
        { carrier: '   ' },
        { origin: 'YUL', destination: 'FRA', flightNumber: '834', dayOfYear: 326 },
      ],
      [{ day: '   ' }, { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834' }],
      [{ day: '000' }, { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834' }],
      [{ day: '367' }, { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834' }],
      [{ flight: '00000' }, { origin: 'YUL', destination: 'FRA', airline: 'AC', dayOfYear: 326 }],
      [{ flight: '12345' }, { origin: 'YUL', destination: 'FRA', airline: 'AC', dayOfYear: 326 }],
    ]
    for (const [fields, leg] of cases) {
      expect(parseBcbp(pass(block(fields)))?.legs).toEqual([leg])
    }
  })

  it('strips leading zeros from the flight number and keeps its letter suffix', () => {
    expect(parseBcbp(pass(block({ flight: '0123A' })))?.legs[0].flightNumber).toBe('123A')
    expect(parseBcbp(pass(block({ flight: '0007 ' })))?.legs[0].flightNumber).toBe('7')
  })

  it('accepts a carrier with a digit, such as U2', () => {
    expect(parseBcbp(pass(block({ carrier: 'U2 ' })))?.legs[0].airline).toBe('U2')
  })
})

describe('combineLegs', () => {
  const leg = (n: number): Leg => ({ origin: 'YUL', destination: 'FRA', flightNumber: String(n) })

  it('is null with nothing to combine', () => {
    expect(combineLegs([])).toBeNull()
  })

  it('drops identical legs from repeated renderings of one barcode and keeps source order', () => {
    const first: BcbpResult = { legs: [leg(1), leg(2)], incomplete: false }
    const again: BcbpResult = { legs: [leg(1), leg(2)], incomplete: false }
    const other: BcbpResult = { legs: [leg(3)], incomplete: false }

    expect(combineLegs([first, again, other])).toEqual({
      legs: [leg(1), leg(2), leg(3)],
      incomplete: false,
    })
  })

  it('does not merge legs that differ in any field', () => {
    const a: Leg = {
      origin: 'YUL',
      destination: 'FRA',
      airline: 'AC',
      flightNumber: '834',
      dayOfYear: 326,
    }
    const b: Leg = { ...a, dayOfYear: 327 }
    const c: Leg = { origin: 'YUL', destination: 'FRA' }
    expect(combineLegs([{ legs: [a, b, c], incomplete: false }])?.legs).toEqual([a, b, c])
  })

  it('carries incomplete over from any reading', () => {
    const result = combineLegs([
      { legs: [leg(1)], incomplete: false },
      { legs: [leg(2)], incomplete: true },
    ])
    expect(result?.incomplete).toBe(true)
  })

  it('caps at eight legs and marks the overflow incomplete', () => {
    const legs = Array.from({ length: MAX_LEGS + 2 }, (_, i) => leg(i + 1))
    const result = combineLegs([{ legs, incomplete: false }])

    expect(result?.legs).toEqual(legs.slice(0, MAX_LEGS))
    expect(result?.incomplete).toBe(true)
  })

  it('stays complete at exactly eight legs', () => {
    const legs = Array.from({ length: MAX_LEGS }, (_, i) => leg(i + 1))
    expect(combineLegs([{ legs, incomplete: false }])?.incomplete).toBe(false)
  })
})
