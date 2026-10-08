import { describe, expect, it } from 'vitest'
import airports from '../../packages/data/src/airports.json'
import type { LatLon } from '../../packages/shared/src/geo'
import { zonesOverflown } from '../api/_lib/zones'

function point(iata: string): LatLon {
  const airport = airports.find(a => a.iata === iata)!
  return { lat: airport.latitude, lon: airport.longitude }
}

const instant = new Date('2026-06-01T12:00:00Z')
const count = (a: string, b: string, at = instant) => zonesOverflown(point(a), point(b), at)

describe('zones overflown', () => {
  it('same zone hop is zero', () => {
    expect(count('KUT', 'TBS')).toBe(0)
  })

  it('TBS to IST crosses one offset', () => {
    expect(count('TBS', 'IST')).toBeGreaterThanOrEqual(1)
  })

  it('LHR to JFK crosses the Atlantic zones', () => {
    expect(count('LHR', 'JFK')).toBeGreaterThanOrEqual(4)
  })

  it.each([['NRT', 'SFO'], ['JFK', 'HKG']])('direction does not matter: %s–%s', (a, b) => {
    expect(count(a, b)).toBe(count(b, a))
  })

  it('history follows the flight date', () => {
    expect(count('TBS', 'SVO', new Date('2012-06-01T12:00:00Z'))).toBe(0)
    expect(count('TBS', 'SVO')).toBeGreaterThanOrEqual(1)
  })

  it('golden routes', () => {
    const routes = ['TBS-JFK', 'NRT-SFO', 'JFK-HKG', 'SIN-SYD', 'DXB-LAX']
    expect(Object.fromEntries(routes.map(route => {
      const [a, b] = route.split('-')
      return [route, count(a, b)]
    }))).toMatchInlineSnapshot(`
      {
        "DXB-LAX": 16,
        "JFK-HKG": 17,
        "NRT-SFO": 9,
        "SIN-SYD": 4,
        "TBS-JFK": 15,
      }
    `)
  })

  it('cost stays bounded', () => {
    count('DXB', 'LAX')
    const start = performance.now()
    count('DXB', 'LAX')
    expect(performance.now() - start).toBeLessThan(50)
  })
})
