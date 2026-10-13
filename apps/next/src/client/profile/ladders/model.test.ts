import { describe, expect, it } from 'vitest'
import type { EarnedBadge } from '../achievements'
import { LADDER_NAME, RUNG_NAME, normal, sarcastic, t, toGo } from './copy'
import {
  LADDERS,
  ladderOf,
  ladderValue,
  nextStep,
  toTiles,
  visibleBadges,
  type LadderStats,
} from './model'

let nextId = 0
const badge = (code: string): EarnedBadge =>
  ({
    id: ++nextId,
    badge_id: nextId,
    earned_at: '2026-01-01',
    badge: { code },
  }) as unknown as EarnedBadge

const stats = (over: Partial<LadderStats> = {}): LadderStats => ({
  total_flights: 0,
  total_distance_km: 0,
  total_duration_minutes: 0,
  countries_count: 0,
  airports_count: 0,
  continents_count: 0,
  airlines_count: 0,
  aircraft_count: 0,
  ...over,
})

describe('ladder mapping', () => {
  it('hides legacy, cities and unknown codes and out-of-range rungs', () => {
    for (const code of [
      'first_flight',
      'continent-europe',
      'cities-3',
      'flights-0',
      'flights-6',
      'airlines-4',
      'flights-10',
      'flights-',
      'nope',
    ])
      expect(ladderOf(code)).toBeNull()
    expect(ladderOf('airtime-3')).toEqual({ ladder: 'time-aloft', rung: 3 })
    expect(ladderOf('aircraft-3')).toEqual({ ladder: 'aircraft-types', rung: 3 })
    const all = ['first_flight', 'cities-1', 'flights-2', 'founding-user'].map(badge)
    expect(visibleBadges(all).map((b) => b.badge.code)).toEqual(['flights-2', 'founding-user'])
  })

  it('gives one tile per ladder at the highest rung, without duplicates', () => {
    const tiles = toTiles(
      ['flights-1', 'flights-3', 'flights-2', 'flights-3', 'distance-1', 'cities-5'].map(badge),
    )
    expect(tiles.map((x) => (x.kind === 'ladder' ? [x.ladder, x.rung, x.rungs] : x.kind))).toEqual([
      ['flights', 3, 5],
      ['distance', 1, 5],
    ])
  })

  it('puts founding first and never offers it as a next step', () => {
    const tiles = toTiles(['flights-1', 'founding-user', 'airlines-2'].map(badge))
    expect(tiles.map((x) => x.kind)).toEqual(['founding', 'ladder', 'ladder'])
    expect(tiles[0].item.badge.code).toBe('founding-user')
    for (const ladder of LADDERS) expect(nextStep(ladder.id, 1, null)).toBeNull()
  })
})

describe('nextStep', () => {
  it('reports hours rounded up, kilometres rounded up and plain counts', () => {
    // 21600 min target for rung 3; 20000 min flown = 1600 min = 26.67 h
    expect(nextStep('time-aloft', 2, stats({ total_duration_minutes: 20_000 }))).toEqual({
      rung: 3,
      remaining: 27,
    })
    expect(nextStep('distance', 3, stats({ total_distance_km: 99_999.2 }))).toEqual({
      rung: 4,
      remaining: 400_001,
    })
    expect(nextStep('flights', 3, stats({ total_flights: 60 }))).toEqual({ rung: 4, remaining: 40 })
    expect(ladderValue('time-aloft', stats({ total_duration_minutes: 90 }))).toBe(1.5)
  })

  it('is null at the top rung, without stats, and when the stat is already past the next rung', () => {
    expect(nextStep('flights', 5, stats({ total_flights: 9 }))).toBeNull()
    expect(nextStep('airlines', 3, stats())).toBeNull()
    expect(nextStep('flights', 2, null)).toBeNull()
    expect(nextStep('flights', 2, stats({ total_flights: 50 }))).toBeNull()
    expect(nextStep('flights', 2, stats({ total_flights: 80 }))).toBeNull()
  })
})

describe('copy coverage', () => {
  it('names and sarcastic lines exist for every rung in both locales', () => {
    for (const ladder of LADDERS) {
      expect(t(LADDER_NAME[ladder.id], 'en')).not.toBe('')
      expect(RUNG_NAME[ladder.id]).toHaveLength(ladder.thresholds.length)
      for (let rung = 1; rung <= ladder.thresholds.length; rung++)
        for (const locale of ['en', 'ru'] as const) {
          expect(t(RUNG_NAME[ladder.id][rung - 1], locale).trim()).not.toBe('')
          const line = sarcastic(ladder.id, rung, 15, locale)
          expect(line.trim()).not.toBe('')
          expect(line).not.toContain('{n}')
          expect(normal(ladder.id, ladder.unit === 'hours' ? 360 : 1, locale)).not.toContain('{n}')
        }
    }
    expect(sarcastic('airlines', 2, 17, 'ru')).toBe(
      'Авиакомпаний: 17. Статусов: 0. Выбирали по цене — получили цену.',
    )
    expect(normal('time-aloft', 360, 'ru')).toBe('15 суток в воздухе.')
    expect(normal('time-aloft', 30, 'en')).toBe('30 hours in the air.')
  })

  it('keeps Russian to-go labels within one 140px line at 12px', () => {
    const largest = { 'time-aloft': 128_160, distance: 990_000 } as Record<string, number>
    for (const ladder of LADDERS) {
      const max = ladder.thresholds.at(-1) as number
      const remaining = largest[ladder.id] ?? (ladder.unit === 'count' ? max - 1 : max)
      expect(toGo(ladder.id, remaining, 'ru').length).toBeLessThanOrEqual(26)
    }
  })
})
