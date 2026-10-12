import { expect, it } from 'vitest'
import { HEAT_MISSING, heatBucket } from './helpers'

it('buckets a month by share of the base: 0, then quarter edges inclusive on the upper side', () => {
  const at = (value: number) => heatBucket(value, 100)
  expect([0, 0.01, 25, 25.01, 50, 50.01, 75, 75.01, 100, 130].map(at)).toEqual([
    0, 1, 1, 2, 2, 3, 3, 4, 4, 4,
  ])
})

it('keeps known zeros at 0 against a zero base and never turns invalid input into a zero', () => {
  expect(heatBucket(0, 0)).toBe(0)
  expect(heatBucket(0, Number.NaN)).toBe(0)
  for (const [value, max] of [
    [5, 0],
    [Number.NaN, 10],
    [Number.POSITIVE_INFINITY, 10],
    [-1, 10],
    [5, Number.NaN],
    [5, -3],
  ])
    expect(heatBucket(value, max)).toBe(HEAT_MISSING)
})
