import { describe, expect, it } from 'vitest'
import airports from '../../data/src/airports.json'
import { eastwardShare, greatCircleKm, greatCirclePoints, type LatLon } from './geo'
import { utcOffsetMinutes } from './timezones'

function point(iata: string): LatLon {
  const airport = airports.find(a => a.iata === iata)!
  return { lat: airport.latitude, lon: airport.longitude }
}

const TBS = point('TBS'), JFK = point('JFK'), LHR = point('LHR'), KUT = point('KUT'), HKG = point('HKG')

describe('great-circle geometry', () => {
  it('great-circle distances match haversine', () => {
    expect(Math.round(greatCircleKm(TBS, JFK))).toBe(8980)
    expect(Math.round(greatCircleKm(LHR, JFK))).toBe(5540)
    expect(Math.round(greatCircleKm(KUT, TBS))).toBe(212)
    expect(greatCircleKm(TBS, JFK)).toBe(greatCircleKm(JFK, TBS))
    expect(greatCircleKm(TBS, TBS)).toBe(0)
  })

  it('path samples include endpoints and stay within 50 km across the polar route', () => {
    const points = greatCirclePoints(JFK, HKG)
    expect(points).toHaveLength(261)
    expect(points[0].lat).toBeCloseTo(JFK.lat, 10)
    expect(points[0].lon).toBeCloseTo(JFK.lon, 10)
    expect(points.at(-1)!.lat).toBeCloseTo(HKG.lat, 10)
    expect(points.at(-1)!.lon).toBeCloseTo(HKG.lon, 10)
    const peak = Math.max(...points.map(p => p.lat))
    expect(peak).toBeGreaterThanOrEqual(83.9)
    expect(peak).toBeLessThanOrEqual(84.0)
    for (let i = 1; i < points.length; i++) {
      expect(greatCircleKm(points[i - 1], points[i])).toBeLessThanOrEqual(50)
      expect(points[i].lon).toBeGreaterThan(-180)
      expect(points[i].lon).toBeLessThanOrEqual(180)
    }
  })

  it('samples coincident and antipodal points without non-finite coordinates', () => {
    expect(greatCirclePoints(TBS, TBS)).toHaveLength(2)
    const points = greatCirclePoints({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })
    expect(points).toHaveLength(402)
    for (let i = 0; i < points.length; i++) {
      expect(Number.isFinite(points[i].lat)).toBe(true)
      expect(Number.isFinite(points[i].lon)).toBe(true)
      if (i) expect(greatCircleKm(points[i - 1], points[i])).toBeLessThanOrEqual(50)
    }
  })

  it('eastward share is signed, bounded and reverses with the route', () => {
    const west = eastwardShare(LHR, JFK)
    expect(west).toBeLessThan(0)
    expect(west).toBeGreaterThanOrEqual(-1)
    expect(eastwardShare(JFK, LHR)).toBeCloseTo(-west, 9)
    expect(eastwardShare(TBS, TBS)).toBe(0)
  })
})

describe('UTC offsets', () => {
  it.each([
    ['Europe/London', '2026-07-01T12:00Z', 60],
    ['Europe/London', '2026-01-01T12:00Z', 0],
    ['Asia/Kathmandu', '2026-06-01T12:00Z', 345],
    ['Europe/Moscow', '2012-06-01T12:00Z', 240],
    ['Europe/Moscow', '2026-06-01T12:00Z', 180],
    ['Not/AZone', '2026-06-01T12:00Z', null],
  ])('offsets are DST-aware: %s at %s', (zone, instant, expected) => {
    expect(utcOffsetMinutes(zone, new Date(instant))).toBe(expected)
  })
})
