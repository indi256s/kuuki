import { geoContains } from 'd3-geo'
import { expect, it } from 'vitest'
import { nightPolygon } from './night'

it('cuts the night hemisphere at the antimeridian without changing the shaded hemisphere', () => {
  for (const month of ['01', '06']) for (const hour of ['00', '06', '12', '18']) {
    const geometry = nightPolygon(new Date(`2026-${month}-15T${hour}:00:00Z`))
    for (const polygon of geometry.coordinates) for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
          expect(Math.abs(ring[i][1])).toBeCloseTo(90)
          expect(Math.abs(ring[i - 1][1])).toBeCloseTo(90)
        }
      }
      expect(ring.at(-1)?.[0]).toBeCloseTo(ring[0][0])
      expect(ring.at(-1)?.[1]).toBeCloseTo(ring[0][1])
    }
    const nightLongitude = ((-Number(hour) * 15 + 185) % 360 + 360) % 360 - 180
    expect(geoContains(geometry, [nightLongitude, 0])).toBe(true)
    const dayLongitude = ((nightLongitude + 360) % 360 + 360) % 360 - 180
    expect(geoContains(geometry, [dayLongitude, 0])).toBe(false)
  }
})
