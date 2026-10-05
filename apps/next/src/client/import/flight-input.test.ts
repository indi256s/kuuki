import { describe, expect, it } from 'vitest'
import { routeCountries, routeKm, toFlightInput } from './flight-input'
import { emptyValues } from './review-model'

const values = (over = {}) => ({ ...emptyValues(), date: '2026-03-01', origin: 'jfk', destination: 'BOS', ...over })

describe('toFlightInput', () => {
  it('normalises codes, marks the source as manual and leaves empty optionals null', () => {
    const flight = toFlightInput(values({ airline_iata: 'aa' }))
    expect(flight).toMatchObject({ origin: 'JFK', destination: 'BOS', airline_iata: 'AA', flight_number: null, aircraft_icao: null, source: 'manual', enrichment_status: 'pending' })
    expect(flight.distance_km).toBeGreaterThan(300)
    expect(flight.origin_tz).toBe('America/New_York')
  })
  it('marks a row with an aircraft as skipped for enrichment', () => {
    expect(toFlightInput(values({ aircraft_icao: 'b738' })).enrichment_status).toBe('skipped')
  })
})

describe('route helpers', () => {
  it('measures a known route and returns 0 for an unknown airport', () => {
    expect(routeKm('JFK', 'BOS')).toBeGreaterThan(300)
    expect(routeKm('JFK', 'ZZQ')).toBe(0)
  })
  it('lists the countries of both airports', () => {
    expect(routeCountries('JFK', 'LHR')).toEqual(['US', 'GB'])
  })
})

describe('newlyPressed', () => {
  it('keeps only touched countries that became pressed', async () => {
    const { newlyPressed } = await import('./flight-input')
    expect(newlyPressed(new Set(['US']), new Set(['US', 'GB', 'FR']), ['US', 'GB', 'GB'])).toEqual(['GB'])
    expect(newlyPressed(new Set(), new Set(), ['US'])).toEqual([])
  })
})
