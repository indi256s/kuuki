import { expect, it } from 'vitest'
import { heatBucket, monthStart, monthKey } from './helpers'
it.each([[0, 100, 0], [-1, 100, 0], [25, 100, 1], [25.01, 100, 2], [50, 100, 2], [75, 100, 3], [100, 100, 4], [101, 100, 4], [1, 0, 0], [NaN, 100, 0]])('buckets %s against %s as %s', (value, max, expected) => expect(heatBucket(value, max)).toBe(expected))
it('uses UTC calendar months even for years below 100', () => {
  expect(monthStart('0099-02').toISOString()).toBe('0099-02-01T00:00:00.000Z')
  expect(monthKey(monthStart('2024-02'))).toBe('2024-02')
})
