import { expect, it } from 'vitest'
import { groundBounds, groundData } from './ground-layers'

it('breaks a ground run at the antimeridian and frames it the short way', () => {
  const run: [number, number][] = [
    [178, -18],
    [-178, -16],
  ]
  const [feature] = groundData([{ id: 'fiji', mode: 'road', planned: false, runs: [run] }]).ground
    .features
  expect(feature.geometry).toEqual({
    type: 'MultiLineString',
    coordinates: [
      [
        [178, -18],
        [180, -17],
      ],
      [
        [-180, -17],
        [-178, -16],
      ],
    ],
  })
  const [[west], [east]] = groundBounds(run) ?? [[0], [0]]
  expect(east - west).toBeCloseTo(4)
})
