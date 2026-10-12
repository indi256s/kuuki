import { expect, it } from 'vitest'
import { BUCKET_LABELS, visitBucket } from './map-buckets'

it('keeps the fixed visit buckets 0 / 1 / 2–3 / 4–9 / 10+', () => {
  expect([0, 1, 2, 3, 4, 9, 10, 250].map(visitBucket)).toEqual([0, 1, 2, 2, 3, 3, 4, 4])
  expect(BUCKET_LABELS.en).toEqual(['1', '2–3', '4–9', '10+'])
  expect(BUCKET_LABELS.ru).toEqual(['1', '2–3', '4–9', '10+'])
})
