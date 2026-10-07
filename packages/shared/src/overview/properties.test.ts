import { expect, it } from 'vitest'
import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { aggregateRows } from './aggregate'
import { computeOverview } from './compute'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'

const template = JSON.parse(readFileSync(new URL('./__fixtures__/n10.json', import.meta.url), 'utf8')) as OverviewPayload
const rowArbitrary = fc.record({ route: fc.integer({ min: 0, max: 2 }), year: fc.integer({ min: 2020, max: 2025 }),
  month: fc.integer({ min: 1, max: 12 }), state: fc.constantFrom('logged', 'awaiting', 'upcoming'),
  minute: fc.integer({ min: 0, max: 1439 }), suppressed: fc.integer({ min: 0, max: 3 }),
  minutes: fc.integer({ min: 1, max: 900 }), estimate: fc.boolean() })
const rowsArbitrary = fc.array(rowArbitrary, { maxLength: 80 }).map(values => values.map((value, i): OverviewRow => ({
  ...template.rows[value.route], id: i + 1, date: `${value.year}-${String(value.month).padStart(2, '0')}-01`,
  state: value.state as OverviewRow['state'], depMinute: value.minute, suppressed: value.suppressed as OverviewRow['suppressed'],
  durationMinutes: value.minutes, durationSource: value.estimate ? 'estimate' : 'times',
})))
const payload = (rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights'): OverviewPayload => ({ ...template, rows, mode })
const options = { numRuns: 200, seed: 20261007 }

it('adding a value to an active facet never decreases flights', () => {
  fc.assert(fc.property(rowsArbitrary, rows => {
    const narrow = computeOverview(payload(rows), { airlines: ['TK'] }).figures.flights
    const broad = computeOverview(payload(rows), { airlines: ['TK', 'BA'] }).figures.flights
    expect(broad).toBeGreaterThanOrEqual(narrow)
  }), options)
})

it('adding a facet never increases flights', () => {
  fc.assert(fc.property(rowsArbitrary, rows => {
    const broad = computeOverview(payload(rows), { airlines: ['TK', 'BA'] }).figures.flights
    const narrow = computeOverview(payload(rows), { airlines: ['TK', 'BA'], aircraft: ['A320'] }).figures.flights
    expect(narrow).toBeLessThanOrEqual(broad)
  }), options)
})

it('single-year flight counts partition the unfiltered total', () => {
  fc.assert(fc.property(rowsArbitrary, rows => {
    const data = payload(rows)
    const years = [...new Set(rows.map(row => Number(row.date.slice(0, 4))))]
    expect(years.reduce((sum, year) => sum + computeOverview(data, { period: { years: [year] } }).figures.flights, 0))
      .toBe(computeOverview(data, {}).figures.flights)
  }), options)
})

it('aggregate rows preserve totals, zones and full rankings', () => {
  fc.assert(fc.property(rowsArbitrary, rows => {
    const original = computeOverview(payload(rows), {}), grouped = computeOverview(payload(aggregateRows(rows), 'aggregate'), {})
    for (const metric of ['flights', 'distanceKm', 'durationMinutes'] as const) expect(grouped.figures[metric]).toBe(original.figures[metric])
    expect(grouped.rankings).toEqual(original.rankings)
    expect(grouped.crossings.status).toBe(original.crossings.status)
    if (grouped.crossings.status === 'ready' && original.crossings.status === 'ready') {
      expect(grouped.crossings.value.zonesOverflown).toBe(original.crossings.value.zonesOverflown)
      expect(grouped.crossings.value.clockShiftHours).toBeCloseTo(original.crossings.value.clockShiftHours)
    }
  }), options)
})

it('shuffling rows changes no output', () => {
  fc.assert(fc.property(rowsArbitrary.chain(rows => fc.tuple(fc.constant(rows), fc.shuffledSubarray(rows, { minLength: rows.length, maxLength: rows.length }))),
    ([rows, shuffled]) => {
      expect(computeOverview(payload(shuffled), {})).toEqual(computeOverview(payload(rows), {}))
    }), options)
})

function finite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return !value || typeof value !== 'object' || Object.values(value).every(finite)
}
it('every output number remains finite across empty and filtered scopes', () => {
  fc.assert(fc.property(rowsArbitrary, fc.constantFrom<OverviewFilter>({}, { countries: ['TR'] }, { countries: ['ZZ'] },
    { period: { from: '2022-11', to: '2023-02' } }), (rows, filter) => {
    expect(finite(computeOverview(payload(rows), filter))).toBe(true)
  }), options)
})
