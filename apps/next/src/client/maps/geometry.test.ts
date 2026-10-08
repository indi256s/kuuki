import { describe, expect, it } from 'vitest'
import { WORLD_BOUNDS, bearing, routeGeometry, wrappedBounds } from './geometry'
import type { ProjectedRoute } from './types'

const route = (from: [number, number], to: [number, number]): ProjectedRoute => ({
  origin: 'AAA', destination: 'BBB', originCountry: null, destinationCountry: null, count: 1, lastDate: '2026-01-01', from, to,
})
const points = (geometry: NonNullable<ReturnType<typeof routeGeometry>>) => geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates

describe('route geometry', () => {
  it('splits a Pacific route at the seam and fits the short wrapped span', () => {
    const sydneyLa = routeGeometry(route([151.18, -33.95], [-118.41, 33.94]))!
    expect(sydneyLa.type).toBe('MultiLineString')
    for (const line of points(sydneyLa)) for (let i = 1; i < line.length; i++) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180)
    const [[west], [east]] = wrappedBounds([sydneyLa])!
    expect(east - west).toBeLessThan(100)
    expect(west).toBeLessThan(-180) // wrapped westwards, not the 270° span across Africa
  })

  it('clamps polar great circles to the Web Mercator limit so they can be fitted', () => {
    const overPole = routeGeometry(route([-100, 60], [79, 60]))! // almost a meridian circle: crosses near the pole
    expect(Math.max(...points(overPole).flat().map(p => p[1]))).toBeGreaterThan(85)
    const [[, south], [, north]] = wrappedBounds([overPole])!
    expect(north).toBeLessThanOrEqual(85)
    expect(south).toBeGreaterThanOrEqual(-85)
  })

  it('fits the whole inhabited world for the first view', () => {
    expect(WORLD_BOUNDS[1][0] - WORLD_BOUNDS[0][0]).toBe(360)
    expect(WORLD_BOUNDS[1][1]).toBeLessThanOrEqual(85)
  })
})

 it('bearing DOH to AKL agrees with independent spherical heading', () => {
  const a: [number, number] = [51.6138, 25.2731], b: [number, number] = [174.785, -37.008]
  const [lon1, lat1] = a.map(n => n * Math.PI / 180), [lon2, lat2] = b.map(n => n * Math.PI / 180)
  const reference = (Math.atan2(Math.sin(lon2 - lon1) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)) * 180 / Math.PI + 360) % 360
  expect(Math.abs(bearing(a, b) - reference)).toBeLessThan(1)
 })
