import { expect, it } from 'vitest'
import { dropIndex, laneDrop } from './reorder'

it('targets either card in a grid row by horizontal position, retaining vertical targeting between rows', () => {
  const rects = [
    { id: 'rankings', top: 0, bottom: 300, left: 0, right: 600 },
    { id: 'records', top: 0, bottom: 200, left: 616, right: 916 },
    { id: 'aircraft', top: 316, bottom: 600, left: 0, right: 916 },
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

it("drops into the lane under the pointer and the slot among that lane's cards", () => {
  // Left lane holds a (0-300) and c (316-500); right lane holds b (0-100) and d (116-400). The dragged card is excluded.
  const rects = [
    { id: 'a', top: 0, bottom: 300, left: 0, right: 600 },
    { id: 'b', top: 0, bottom: 100, left: 616, right: 1216 },
    { id: 'c', top: 316, bottom: 500, left: 0, right: 600 },
    { id: 'd', top: 116, bottom: 400, left: 616, right: 1216 },
  ]
  const bounds = { left: 0, right: 1216 }
  expect(laneDrop(100, 100, rects, bounds)).toBe(0)
  expect(laneDrop(100, 350, rects, bounds)).toBe(2)
  expect(laneDrop(100, 480, rects, bounds)).toBe(3)
  expect(laneDrop(900, 300, rects, bounds)).toBe(4)
  expect(laneDrop(900, 20, rects, bounds)).toBe(1)
  expect(laneDrop(900, 20, [rects[0]], bounds)).toBe(1)
  expect(laneDrop(100, 20, [rects[1]], bounds)).toBe(0)
  expect(laneDrop(100, 20, [], bounds)).toBeNull()
})
