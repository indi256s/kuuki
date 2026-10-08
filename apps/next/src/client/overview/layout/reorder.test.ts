import { expect, it } from 'vitest'
import { dropIndex } from './reorder'

it('targets either card in a grid row by horizontal position, retaining vertical targeting between rows', () => {
  const rects = [
    { id: 'rankings', top: 0, bottom: 300, left: 0, right: 600 },
    { id: 'records', top: 0, bottom: 200, left: 616, right: 916 },
    { id: 'fleet', top: 316, bottom: 600, left: 0, right: 916 },
  ]
  expect(dropIndex(100, rects, 100)).toBe(0)
  expect(dropIndex(100, rects, 700)).toBe(1)
  expect(dropIndex(100, rects, 900)).toBe(2)
  expect(dropIndex(310, rects, 900)).toBe(2)
  expect(dropIndex(550, rects, 100)).toBe(3)
  expect(dropIndex(100, rects)).toBe(0)
  const neighbour = [rects[1]]
  expect(dropIndex(100, neighbour, 700, { left: 0, right: 916 })).toBe(0)
  expect(dropIndex(100, neighbour, 900, { left: 0, right: 916 })).toBe(1)
})
