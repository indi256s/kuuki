import { expect, it } from 'vitest'
import { moveSection, dropIndex } from './reorder'
import type { SectionId } from '@kuuki/shared/overview/prefs'

const order: SectionId[] = ['rankings', 'records', 'fleet', 'clock']
it('moves forward/back to final indices without mutating the input', () => {
  expect(moveSection(order, 'rankings', 2)).toEqual(['records', 'fleet', 'rankings', 'clock'])
  expect(moveSection(order, 'clock', 1)).toEqual(['rankings', 'clock', 'records', 'fleet'])
  expect(order).toEqual(['rankings', 'records', 'fleet', 'clock'])
})
it('clamps bounds and leaves unknown ids, noops and nonfinite targets unchanged', () => {
  expect(moveSection(order, 'rankings', 99)).toEqual(['records', 'fleet', 'clock', 'rankings'])
  expect(moveSection(order, 'clock', -1)).toEqual(['clock', 'rankings', 'records', 'fleet'])
  expect(moveSection(order, 'crossings', 0)).toBe(order)
  expect(moveSection(order, 'rankings', 0)).toBe(order)
  expect(moveSection(order, 'rankings', NaN)).toBe(order)
  expect(moveSection([], 'clock', 0)).toEqual([])
})
it('inserts before midpoints, at the midpoint after, and handles outer edges/empty rects', () => {
  const rects = [{ id: 'records', top: 100, bottom: 200 }, { id: 'clock', top: 220, bottom: 320 }]
  expect([-1, 149, 150, 269, 270, 900].map(y => dropIndex(y, rects))).toEqual([0, 0, 1, 1, 2, 2])
  expect(dropIndex(0, [])).toBe(0)
})
