import { expect, it } from 'vitest'
import { globeZoom } from './camera'

it('covers the viewport corners with the visible sphere across viewport sizes and camera latitudes', () => {
  const fieldOfView = 36.86989764584402
  for (const [width, height] of [
    [280, 280],
    [436, 436],
    [760, 760],
    [860, 380],
    [380, 860],
  ])
    for (const latitude of [-90, -70, 0, 70, 90]) {
      const zoom = globeZoom(width, height, latitude, fieldOfView)
      const centerLatitude = Math.max(-85.051129, Math.min(85.051129, latitude))
      const radius = (512 * 2 ** zoom) / (2 * Math.PI * Math.cos((centerLatitude * Math.PI) / 180))
      const distance = height / (2 * Math.tan((fieldOfView * Math.PI) / 360))
      const apparentRadius = (distance * radius) / Math.sqrt((distance + radius) ** 2 - radius ** 2)
      expect(apparentRadius).toBeCloseTo(Math.hypot(width, height) / 2, 8)
    }
})
