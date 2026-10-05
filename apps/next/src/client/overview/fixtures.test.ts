// The reusable summaries must describe a possible account, or T18's volume acceptance proves nothing.
import { describe, expect, it } from 'vitest'
import type { OverviewSummary } from '../../../../../packages/shared/src/overview'
import { busySummary, emptySummary, legacyOnlySummary, singleFlightSummary, stressSummary } from './fixtures'

const sum = (rows: Array<{ count: number }>) => rows.reduce((total, row) => total + row.count, 0)

function invariants(summary: OverviewSummary) {
  const { totals, topLists, map, insights, months, dataAvailability, regions } = summary
  expect(months).toHaveLength(12)
  const monthTotal = months.reduce((total, month) => total + month.flights, 0)
  if (summary.period === 'all') expect(monthTotal).toBeLessThanOrEqual(totals.flights)
  else expect(monthTotal).toBe(totals.flights)
  // A flight has one airline, one aircraft and two endpoints.
  expect(sum(topLists.airlines)).toBeLessThanOrEqual(totals.flights)
  expect(topLists.airlines.length).toBeLessThanOrEqual(totals.airlines)
  expect(sum(topLists.aircraft)).toBeLessThanOrEqual(totals.flights - dataAvailability.missingAircraft)
  expect(sum(topLists.manufacturers)).toBe(sum(topLists.aircraft))
  expect(topLists.aircraft.length).toBeLessThanOrEqual(totals.aircraft)
  for (const airport of topLists.airports) expect(airport.count).toBeLessThanOrEqual(totals.flights)
  expect(sum(topLists.airports)).toBeLessThanOrEqual(totals.flights * 2)
  expect(topLists.airports.length).toBeLessThanOrEqual(totals.airports)
  // Archived (legacy) visits add to all-time visits without flights, so the bound holds for a year only.
  if (summary.period !== 'all') expect(sum(map.countries.map(country => ({ count: country.visits })))).toBeLessThanOrEqual(totals.flights * 2)
  if (insights.favoriteAirline) expect(insights.favoriteAirline).toEqual(topLists.airlines[0])
  if (insights.mostFrequentRoute) expect(insights.mostFrequentRoute.count).toBeLessThanOrEqual(totals.flights)
  expect(dataAvailability.flights).toBe(totals.flights)
  expect(dataAvailability.missingAircraft).toBeLessThanOrEqual(totals.flights)
  expect(dataAvailability.durationKnown).toBeLessThanOrEqual(totals.flights)
  // Countries: the period set, with pending ones counted apart; every region figure comes from that set.
  expect(totals.countries).toBe(map.countries.length)
  expect(totals.pendingCountries).toBe(map.countries.filter(country => country.pending).length)
  expect(summary.countryIds).toEqual([...map.countries.map(country => country.id)].sort())
  expect(new Set(map.countries.map(country => country.id)).size).toBe(map.countries.length)
  if (regions) {
    expect(regions.reduce((total, region) => total + region.pressed, 0)).toBe(map.countries.length - (totals.pendingCountries ?? 0))
    expect(regions.reduce((total, region) => total + region.pending, 0)).toBe(totals.pendingCountries)
  }
  const period = new Set(map.countries.map(country => country.id))
  if (insights.newCountries) {
    expect(insights.newCountries.count).toBeLessThanOrEqual(map.countries.length)
    expect(insights.newCountries.count).toBeGreaterThanOrEqual(insights.newCountries.items.length)
    for (const item of insights.newCountries.items) {
      expect(period.has(item.id)).toBe(true)
      expect(item.firstVisit.slice(0, 4)).toBe(summary.period)
      expect(item.pending).toBe(map.countries.find(country => country.id === item.id)?.pending)
    }
  }
  if (summary.comparison && summary.comparison.flights.percent !== null) {
    expect(summary.comparison.flights.delta).toBe(totals.flights - summary.comparison.flights.previous)
    expect(summary.comparison.countries?.delta).toBe((totals.countries ?? 0) - (summary.comparison.countries?.previous ?? 0))
  }
}

describe('reusable Overview fixtures describe possible accounts', () => {
  const cases: Array<[string, OverviewSummary]> = [
    ['n=0 all', emptySummary('all')], ['n=0 year', emptySummary('2026')], ['n=1', singleFlightSummary('2026')],
    ['n=10 year', busySummary(10)], ['n=10 all', busySummary(10, 'all')], ['n=500 year', busySummary(500)], ['n=500 all', busySummary(500, 'all')],
    ['legacy-only', legacyOnlySummary()],
  ]
  it.each(cases)('%s', (_name, summary) => invariants(summary))

  it('the stress fixture is separately named and breaks the new-country subset on purpose', () => {
    const stress = stressSummary()
    expect(stress.insights.newCountries?.items).toHaveLength(12)
    expect(stress.insights.newCountries!.count).toBeGreaterThan(stress.insights.newCountries!.items.length)
    expect(() => invariants(stress)).toThrow()
  })
})
