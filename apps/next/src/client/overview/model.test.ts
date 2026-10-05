import { describe, expect, it } from 'vitest'
import { busySummary, emptySummary, legacyOnlySummary, singleFlightSummary } from './fixtures'
import { comparisonCaption, countdownLabel, daysUntil, earthCaption, monthStrip, overviewMode, rankingShape, sentenceLead, timeFigure, type RankingRow } from './model'

const comparison = (previousPeriod = '2025', firstYear = false) => ({ previousPeriod, firstYear } as Parameters<typeof comparisonCaption>[2])
const row = (id: string, count: number): RankingRow => ({ id, label: id, count, href: `/journal?airline=${id}` })

describe('comparisonCaption', () => {
  it('shows a signed percentage with a real minus sign', () => {
    expect(comparisonCaption('en', { previous: 10, delta: -5, percent: -50 }, comparison())).toBe('−50% vs 2025')
    expect(comparisonCaption('ru', { previous: 10, delta: 5, percent: 50 }, comparison())).toBe('+50% к 2025')
    expect(comparisonCaption('en', { previous: 4, delta: 0, percent: 0 }, comparison())).toBe('No change vs 2025')
  })
  it('omits the percentage at a zero baseline: first year, or an absolute difference', () => {
    expect(comparisonCaption('en', { previous: 0, delta: 3, percent: null }, comparison('2025', true))).toBe('First year')
    expect(comparisonCaption('ru', { previous: 0, delta: 3, percent: null }, comparison('2025', true))).toBe('Первый год')
    expect(comparisonCaption('en', { previous: 0, delta: 3, percent: null }, comparison('2025', false))).toBe('+3 vs 2025')
    expect(comparisonCaption('en', { previous: 0, delta: 1200, percent: null }, comparison(), n => `${n} km`)).toBe('+1200 km vs 2025')
  })
  it('says nothing when there is no baseline and no change, or no delta at all', () => {
    expect(comparisonCaption('en', { previous: 0, delta: 0, percent: null }, comparison())).toBeNull()
    expect(comparisonCaption('en', null, comparison())).toBeNull()
  })
})

describe('earthCaption', () => {
  it('uses plural forms for laps and a fraction form otherwise', () => {
    expect(earthCaption('en', 40075)).toBe('1 time around the Earth')
    expect(earthCaption('en', 40075 * 3.5)).toBe('3.5 times around the Earth')
    expect(earthCaption('ru', 40075 * 2)).toBe('2 раза вокруг Земли')
    expect(earthCaption('ru', 40075 * 5)).toBe('5 раз вокруг Земли')
    expect(earthCaption('ru', 40075 * 3.5)).toBe('3,5 раза вокруг Земли')
  })
  it('stays silent under a tenth of a lap', () => { expect(earthCaption('en', 1200)).toBeNull(); expect(earthCaption('en', 0)).toBeNull() })
})

describe('timeFigure', () => {
  const base = (flights: number, known: number, minutes: number) => ({ totals: { ...emptySummary().totals, durationMinutes: minutes }, dataAvailability: { flights, durationKnown: known, distanceKnown: flights, missingAircraft: 0 } })
  it('never shows unknown duration as zero', () => {
    expect(timeFigure('en', base(3, 0, 0))).toEqual({ value: '—', unit: null, caption: 'Duration not recorded' })
    expect(timeFigure('ru', base(3, 0, 0)).caption).toBe('Время не указано')
  })
  it('shows hours with a partial-coverage caption', () => {
    expect(timeFigure('en', base(10, 8, 7260))).toEqual({ value: '121', unit: 'h', caption: 'Duration known for 8 of 10 flights' })
    expect(timeFigure('ru', base(10, 8, 7260)).caption).toBe('Время известно для 8 из 10 перелётов')
  })
  it('is a genuine zero only with no flights', () => { expect(timeFigure('en', base(0, 0, 0))).toEqual({ value: '0', unit: 'h', caption: null }) })
  it('shows minutes for a short total', () => { expect(timeFigure('en', base(1, 1, 45)).value).toBe('45 min') })
})

describe('rankingShape', () => {
  it('is empty, a sentence below three entries, and a list from three', () => {
    expect(rankingShape([], 0, 'airlines')).toEqual({ kind: 'empty' })
    expect(rankingShape([row('TK', 12)], 12, 'airlines')).toMatchObject({ kind: 'sentence', all: true })
    expect(rankingShape([row('TK', 5)], 12, 'airlines')).toMatchObject({ kind: 'sentence', all: false })
    expect(rankingShape([row('TK', 12)], 12, 'airports')).toMatchObject({ kind: 'sentence', all: false }) // airports count both endpoints
    expect(rankingShape([row('TK', 5), row('PC', 3)], 12, 'airlines')).toMatchObject({ kind: 'sentence', all: false })
    expect(rankingShape([row('TK', 5), row('PC', 3), row('BA', 1)], 12, 'airlines')).toMatchObject({ kind: 'list', max: 5 })
  })
  it('words the sentence lead per category and language', () => {
    expect(sentenceLead('en', 'airlines', true, 12)).toBe('All 12 flights:')
    expect(sentenceLead('ru', 'airlines', true, 12)).toBe('Все 12 перелётов:')
    expect(sentenceLead('ru', 'aircraft', false, 12)).toBe('Вы летали на')
    expect(sentenceLead('en', 'airports', false, 12)).toBe('Passed through')
  })
})

describe('monthStrip', () => {
  it('scales to the busiest month, keeps a visible minimum and gives every month a text', () => {
    const { bars, busiest } = monthStrip('en', busySummary(10).months)
    expect(bars).toHaveLength(12)
    expect(Math.max(...bars.map(bar => bar.height))).toBe(100)
    expect(bars.find(bar => bar.flights === 1)!.height).toBeGreaterThanOrEqual(6)
    expect(bars.find(bar => bar.flights === 0)!.height).toBe(0)
    expect(bars[3].text).toBe('April 2026: 3 flights')
    expect(busiest).toBe('Busiest month: April 2026, 3 flights.')
  })
  it('has no busiest month when nothing flew', () => { expect(monthStrip('ru', emptySummary('2026').months).busiest).toBeNull() })
})

describe('countdown and mode', () => {
  it('counts calendar days without time-zone shifts', () => {
    expect(daysUntil('2026-03-01', '2026-02-28')).toBe(1)
    expect(daysUntil('2026-12-25', '2026-12-13')).toBe(12)
    expect(countdownLabel('en', 0)).toBe('Today'); expect(countdownLabel('ru', 1)).toBe('Завтра')
    expect(countdownLabel('en', 12)).toBe('In 12 days'); expect(countdownLabel('ru', 21)).toBe('Через 21 день'); expect(countdownLabel('ru', 12)).toBe('Через 12 дней')
    expect(countdownLabel('en', -1)).toBeUndefined()
  })
  it('chooses first run, empty year or data', () => {
    expect(overviewMode(emptySummary('all'))).toBe('first-run')
    expect(overviewMode(emptySummary('2024'))).toBe('empty-year')
    expect(overviewMode(legacyOnlySummary())).toBe('data')
    expect(overviewMode(emptySummary('all', { totals: { ...emptySummary().totals, countries: null, pendingCountries: null } }))).toBe('data')
    expect(overviewMode({ ...legacyOnlySummary(), period: '2019' })).toBe('empty-year')
    expect(overviewMode(singleFlightSummary())).toBe('data')
    expect(overviewMode(busySummary(500, 'all'))).toBe('data')
  })
})
