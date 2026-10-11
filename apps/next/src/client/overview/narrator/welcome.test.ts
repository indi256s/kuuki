import { describe, expect, it } from 'vitest'
import type { FactFlight } from '../../welcome/types'
import {
  BIG_FLIGHTS,
  WELCOME_CORPUS,
  pickWelcomeLine,
  statsLine,
  type WelcomeTrigger,
} from './welcome'

const flown = (date: string, origin: string, destination: string): FactFlight => ({
  date,
  origin,
  destination,
  upcoming: false,
})
const booked = (origin = 'LHR', destination = 'JFK'): FactFlight => ({
  date: '2027-03-01',
  origin,
  destination,
  upcoming: true,
})

const ROUTES = [
  ['FRA', 'LHR'],
  ['FRA', 'JFK'],
  ['FRA', 'TBS'],
  ['FRA', 'IST'],
] as const
function many(n: number, routes: readonly (readonly [string, string])[] = ROUTES): FactFlight[] {
  return Array.from({ length: n }, (_, i) => {
    const [from, to] = routes[i % routes.length] ?? ['FRA', 'LHR']
    return flown(`${2009 + (i % 10)}-05-${String((i % 27) + 1).padStart(2, '0')}`, from, to)
  })
}

const FIXTURES: Record<WelcomeTrigger, FactFlight[]> = {
  upcoming: [booked()],
  single: [flown('2024-02-03', 'TBS', 'IST')],
  big: many(BIG_FLIGHTS),
  small: many(3, [['FRA', 'LHR']]),
}

function seeds(flights: FactFlight[], locale: 'en' | 'ru') {
  return new Set(
    Array.from({ length: 60 }, (_, i) => pickWelcomeLine({ flights, seed: `owner-${i}`, locale })),
  )
}

describe('pickWelcomeLine triggers', () => {
  it('upcoming only: no flown flights, one booked', () => {
    expect(seeds(FIXTURES.upcoming, 'en').size).toBe(3)
    for (const line of seeds(FIXTURES.upcoming, 'en')) expect(line).toContain('1 flight booked')
  })

  it('single: exactly one flown flight, with the en dash route', () => {
    for (const line of seeds(FIXTURES.single, 'en')) expect(line).toContain('TBS–IST')
  })

  it('single wins over upcoming when a booked flight rides along', () => {
    const line = pickWelcomeLine({
      flights: [...FIXTURES.single, booked()],
      seed: 'a',
      locale: 'en',
    })
    expect(line).toContain('TBS–IST')
  })

  it('big: ten flown flights, domestic or not', () => {
    expect(BIG_FLIGHTS).toBe(10)
    const lines = [...seeds(FIXTURES.big, 'en')]
    expect(lines).toHaveLength(3)
    expect(lines.some((line) => line.includes('10 flights since 2009, and Frankfurt'))).toBe(true)
    const domestic = many(BIG_FLIGHTS, [['FRA', 'MUC']])
    expect([...seeds(domestic, 'en')].some((line) => line.includes('underprepared'))).toBe(true)
  })

  it('small: nine flown flights is not big', () => {
    for (const line of seeds(many(BIG_FLIGHTS - 1), 'en')) {
      expect(line).not.toContain('officially underprepared')
      expect(line).not.toContain('holding your seat')
    }
  })

  it('small: few flights', () => {
    expect(seeds(FIXTURES.small, 'en').size).toBe(3)
  })

  it('counts only flown flights', () => {
    const line = pickWelcomeLine({
      flights: [...FIXTURES.small, booked(), booked()],
      seed: 'a',
      locale: 'en',
    })
    expect(line).toContain('3 flights')
  })
})

describe('pickWelcomeLine variants', () => {
  it('is deterministic per seed', () => {
    for (const locale of ['en', 'ru'] as const) {
      const a = pickWelcomeLine({ flights: FIXTURES.big, seed: 'owner-1', locale })
      expect(pickWelcomeLine({ flights: FIXTURES.big, seed: 'owner-1', locale })).toBe(a)
    }
  })

  it('reaches all three variants across seeds, per trigger and locale', () => {
    for (const trigger of Object.keys(FIXTURES) as WelcomeTrigger[]) {
      for (const locale of ['en', 'ru'] as const) {
        expect(seeds(FIXTURES[trigger], locale).size).toBe(3)
      }
    }
  })
})

describe('pickWelcomeLine fallbacks', () => {
  it('works without a known city or year: no placeholder survives', () => {
    const unknown = many(BIG_FLIGHTS).map((flight) => ({
      ...flight,
      origin: 'ZZZ',
      destination: 'ZZY',
    }))
    const undated = unknown.map((flight) => ({ ...flight, date: '' }))
    for (const flights of [unknown, undated, [flown('', 'ZZZ', 'ZZY'), flown('', 'ZZZ', 'ZZY')]]) {
      for (const locale of ['en', 'ru'] as const) {
        for (const line of seeds(flights, locale)) {
          expect(line).not.toContain('{')
          expect(line).not.toContain('Frankfurt')
        }
      }
    }
  })

  it('uses the Russian alias for the city when there is one', () => {
    const moscow = many(BIG_FLIGHTS, [
      ['SVO', 'LHR'],
      ['SVO', 'JFK'],
      ['SVO', 'TBS'],
    ])
    const ru = [...seeds(moscow, 'ru')].join('\n')
    expect(ru).toContain('Москва')
  })
})

describe('Russian plurals', () => {
  it.each([
    [2, '2 перелёта'],
    [5, '5 перелётов'],
    [11, '11 перелётов'],
    [21, '21 перелёт'],
  ])('%i flights in the line', (n, expected) => {
    // 3 variants, so look at all of them through the seeds; each carries the count phrase.
    for (const line of seeds(many(n, [['FRA', 'LHR']]), 'ru')) {
      expect(line).toContain(expected)
    }
  })

  it('count phrase for 1 is the singular word (left out)', () => {
    expect(statsLine({ flights: FIXTURES.single, leftOut: 1, locale: 'ru' })).toContain(
      'Не учтено: 1 перелёт;',
    )
  })

  it.each([
    [2, '2 перелёта'],
    [5, '5 перелётов'],
    [11, '11 перелётов'],
    [21, '21 перелёт'],
  ])('left out %i', (n, expected) => {
    expect(statsLine({ flights: FIXTURES.small, leftOut: n, locale: 'ru' })).toContain(
      `Не учтено: ${expected};`,
    )
  })
})

it('falls through to a shorter variant when a long catalog city would break the 90-character cap', () => {
  const tallinn = many(500, [
    ['TLL', 'HEL'],
    ['TLL', 'RIX'],
  ])
  for (const locale of ['en', 'ru'] as const)
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
      expect(pickWelcomeLine({ flights: tallinn, seed, locale }).length).toBeLessThanOrEqual(90)
})

describe('statsLine', () => {
  const trip = [flown('2020-01-01', 'TBS', 'IST')]
  it('omits the left-out clause at 0, trails it when fewer were left out, and leads with it otherwise', () => {
    const thirteen = many(13, [['TBS', 'IST']])
    expect(statsLine({ flights: trip, leftOut: 0, locale: 'en' })).toMatch(
      /^2 countries, [\d,]+\skm\.$/,
    )
    expect(statsLine({ flights: thirteen, leftOut: 12, locale: 'en' })).toMatch(
      /^2 countries, [\d,]+\skm\. 12 flights left out; add them anytime from your journal\.$/,
    )
    expect(statsLine({ flights: trip, leftOut: 12, locale: 'en' })).toMatch(
      /^12 flights left out; add them anytime from your journal\. 2 countries, /,
    )
    expect(statsLine({ flights: thirteen, leftOut: 1, locale: 'en' })).toContain(
      '1 flight left out; add it anytime',
    )
    expect(statsLine({ flights: [booked()], leftOut: 3, locale: 'en' })).toBe(
      '3 flights left out; add them anytime from your journal. 1 upcoming flight.',
    )
  })

  it('uses the singular for one country', () => {
    expect(
      statsLine({ flights: [flown('2022-01-01', 'FRA', 'MUC')], leftOut: 0, locale: 'en' }),
    ).toMatch(/^1 country, /)
  })

  it('follows the board in Russian', () => {
    const line = statsLine({ flights: many(13, [['TBS', 'IST']]), leftOut: 12, locale: 'ru' })
    expect(line).toMatch(/^2 страны, /)
    expect(line).toContain('Не учтено: 12 перелётов; добавить их можно в любой момент из журнала.')
  })

  it('upcoming only has its own line and ignores booked flights for km', () => {
    expect(statsLine({ flights: [booked()], leftOut: 0, locale: 'en' })).toBe(
      '1 upcoming flight. Add past ones anytime from your journal.',
    )
    expect(statsLine({ flights: [booked(), booked()], leftOut: 0, locale: 'en' })).toMatch(
      /^2 upcoming flights\./,
    )
    expect(statsLine({ flights: [booked(), booked()], leftOut: 0, locale: 'ru' })).toBe(
      'Предстоит: 2 перелёта. Прошлые можно добавить в любой момент из журнала.',
    )
    const mixed = statsLine({ flights: [...trip, booked('SYD', 'AKL')], leftOut: 0, locale: 'en' })
    expect(mixed).toMatch(/^2 countries, /)
  })
})

describe('corpus', () => {
  const worst = {
    en: {
      flights: '412 flights',
      booked: '412 flights',
      since: '2009',
      city: 'Tallinn-ulemiste International',
      route: 'TBS–IST',
    },
    ru: {
      flights: '412 перелётов',
      booked: '412 перелётов',
      since: '2009',
      city: 'Петропавловск-Камчатский',
      route: 'TBS–IST',
    },
  }
  const entries = Object.entries(WELCOME_CORPUS).flatMap(([trigger, lines]) =>
    lines.flatMap((line, i) =>
      (['en', 'ru'] as const).map((locale) => ({
        name: `${trigger}[${i}] ${locale}`,
        locale,
        text: line[locale],
      })),
    ),
  )

  it.each(entries)('$name fits 90 characters with no em dash', ({ locale, text }) => {
    const values = worst[locale] as Record<string, string>
    const filled = text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`)
    expect(filled).not.toContain('{')
    expect(filled).not.toContain('—')
    expect(filled.length).toBeLessThanOrEqual(90)
  })

  it('keeps one variant per trigger that needs neither city nor year', () => {
    for (const lines of Object.values(WELCOME_CORPUS)) {
      expect(lines[2].en).not.toMatch(/\{(city|since)\}/)
      expect(lines[2].ru).not.toMatch(/\{(city|since)\}/)
    }
  })
})
