import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration (adaptive style)', () => {
  it.each([
    // under 1 hour: minutes only
    [45, '45m'],
    [59, '59m'],
    // exactly 1 hour: no minutes
    [60, '1h'],
    // under 24 hours: hours and minutes
    [90, '1h 30m'],
    [202, '3h 22m'],
    [720, '12h'],
    [1439, '23h 59m'],
    // 24+ hours: days and hours
    [1440, '1d'],
    [1500, '1d 1h'],
    [20167, '14d'],
    // zero and negative
    [0, '0m'],
    [-50, '0m'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })
})
