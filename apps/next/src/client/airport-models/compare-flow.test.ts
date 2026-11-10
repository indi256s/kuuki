import { describe, expect, it } from 'vitest'
import { compareFlow, compareSettledReducer, initialCompareSettled } from './compare-flow'

const base = { available: true, readyFor: null, failedFor: null }

describe('compare flow', () => {
  it('moves to loading when the code changes after a failure', () => {
    const failed = compareSettledReducer(initialCompareSettled, { type: 'failed', code: 'C' })
    expect(compareFlow({ ...base, desired: 'C', failedFor: failed.failedCode })).toEqual({
      kind: 'failed',
      code: 'C',
    })
    expect(compareFlow({ ...base, desired: 'D', failedFor: failed.failedCode })).toEqual({
      kind: 'loading',
      code: 'D',
    })
  })

  it('retry clears the failure and bumps the attempt', () => {
    const failed = compareSettledReducer(initialCompareSettled, { type: 'failed', code: 'C' })
    expect(compareSettledReducer(failed, { type: 'retry' })).toEqual({
      failedCode: null,
      attempt: 1,
    })
  })

  it('covers off, invalid and ready', () => {
    expect(compareFlow({ ...base, desired: null })).toEqual({ kind: 'off' })
    expect(compareFlow({ ...base, desired: 'X', available: false })).toEqual({
      kind: 'invalid',
      code: 'X',
    })
    expect(compareFlow({ ...base, desired: 'D', readyFor: 'D' })).toEqual({
      kind: 'ready',
      code: 'D',
    })
  })
})
