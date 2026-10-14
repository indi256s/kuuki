import { expect, it } from 'vitest'
import { visitBucket } from './map-buckets'

it('keeps the fixed visit buckets 0 / 1 / 2–3 / 4–9 / 10+', () => {
  expect([0, 1, 2, 3, 4, 9, 10, 250].map(visitBucket)).toEqual([0, 1, 2, 2, 3, 3, 4, 4])
})
