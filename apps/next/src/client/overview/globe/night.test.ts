import { geoContains } from 'd3-geo'
import { expect, it } from 'vitest'
import { nightPolygon } from './night'
it('June solstice keeps the north pole in daylight, December puts it in night', () => {
  expect(geoContains(nightPolygon(new Date('2026-06-21T12:00:00Z')), [0, 89.99])).toBe(false)
  expect(geoContains(nightPolygon(new Date('2026-12-21T12:00:00Z')), [0, 89.99])).toBe(true)
})
it('UTC time moves the night hemisphere to the antisolar longitude', () => {
  const noon = nightPolygon(new Date('2026-03-21T12:00:00Z'))
  expect(geoContains(noon, [180, 0])).toBe(true)
  expect(geoContains(noon, [0, 0])).toBe(false)
  expect(geoContains(nightPolygon(new Date('2026-03-21T00:00:00Z')), [0, 0])).toBe(true)
})
