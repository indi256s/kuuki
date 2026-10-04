import { describe, expect, it } from 'vitest'
import { BUCKET_LABELS, BUCKET_TOKENS, visitBucket } from './map-buckets'

describe('visitBucket', () => {
  it.each([[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [9, 3], [10, 4], [500, 4]])('%i visits -> bucket %i', (count, bucket) => {
    expect(visitBucket(count)).toBe(bucket)
  })

  it('has a token and a legend label for every non-empty bucket', () => {
    expect(BUCKET_TOKENS).toHaveLength(5)
    expect(BUCKET_LABELS.en).toEqual(['1', '2–3', '4–9', '10+'])
    expect(BUCKET_LABELS.ru).toEqual(['1', '2–3', '4–9', '10+'])
  })
})
