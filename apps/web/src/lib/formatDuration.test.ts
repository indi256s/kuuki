import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  formatDurationParts,
  formatDurationI18n,
  getHaulType,
  getHaulDistribution,
  getDepartureBucket,
  getDominantPattern,
} from './formatDuration'

describe('formatDurationParts', () => {
  it('decomposes minutes into days, hours, and minutes', () => {
    const result = formatDurationParts(1505) // 25h 5m
    expect(result).toEqual({
      days: 1,
      hours: 1,
      minutes: 5,
      totalMinutes: 1505,
    })
  })

  it('handles exact hour values', () => {
    const result = formatDurationParts(180) // 3h 0m
    expect(result).toEqual({
      days: 0,
      hours: 3,
      minutes: 0,
      totalMinutes: 180,
    })
  })

  it('handles exact day values', () => {
    const result = formatDurationParts(1440) // 24h = 1d
    expect(result).toEqual({
      days: 1,
      hours: 0,
      minutes: 0,
      totalMinutes: 1440,
    })
  })

  it('handles zero', () => {
    const result = formatDurationParts(0)
    expect(result).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
    })
  })

  it('handles negative values as zero', () => {
    const result = formatDurationParts(-100)
    expect(result).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
    })
  })

  it('handles very large values', () => {
    const result = formatDurationParts(20167) // 14d 0h 7m (about 336 hours)
    expect(result).toEqual({
      days: 14,
      hours: 0,
      minutes: 7,
      totalMinutes: 20167,
    })
  })
})

describe('formatDuration', () => {
  describe('adaptive style (default)', () => {
    it('formats less than 1 hour as minutes only', () => {
      expect(formatDuration(45)).toBe('45m')
      expect(formatDuration(59)).toBe('59m')
    })

    it('formats exactly 1 hour without minutes', () => {
      expect(formatDuration(60)).toBe('1h')
    })

    it('formats less than 24 hours as hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m')
      expect(formatDuration(202)).toBe('3h 22m')
      expect(formatDuration(720)).toBe('12h')
      expect(formatDuration(1439)).toBe('23h 59m')
    })

    it('formats 24+ hours as days and hours', () => {
      expect(formatDuration(1440)).toBe('1d')
      expect(formatDuration(1500)).toBe('1d 1h')
      expect(formatDuration(20167)).toBe('14d')
    })

    it('handles zero and negative values', () => {
      expect(formatDuration(0)).toBe('0m')
      expect(formatDuration(-50)).toBe('0m')
    })

    it('handles boundary cases', () => {
      // At exactly 60 minutes
      expect(formatDuration(60)).toBe('1h')
      // At exactly 24 hours
      expect(formatDuration(1440)).toBe('1d')
    })
  })

  describe('short style', () => {
    it('shows only the largest unit', () => {
      expect(formatDuration(45, { style: 'short' })).toBe('45m')
      expect(formatDuration(90, { style: 'short' })).toBe('1h')
      expect(formatDuration(1500, { style: 'short' })).toBe('1d')
    })
  })

  describe('full style', () => {
    it('shows all non-zero parts', () => {
      expect(formatDuration(45, { style: 'full' })).toBe('45m')
      expect(formatDuration(90, { style: 'full' })).toBe('1h 30m')
      expect(formatDuration(1500, { style: 'full' })).toBe('1d 1h')
      expect(formatDuration(1505, { style: 'full' })).toBe('1d 1h 5m')
    })

    it('shows at least minutes when all parts are zero', () => {
      expect(formatDuration(0, { style: 'full' })).toBe('0m')
    })
  })
})

describe('formatDurationI18n', () => {
  it('returns correct style for minutes range', () => {
    const result = formatDurationI18n(45)
    expect(result.style).toBe('minutes')
    expect(result.formatted).toBe('45m')
    expect(result.minutes).toBe(45)
    expect(result.hours).toBe(0)
    expect(result.days).toBe(0)
  })

  it('returns correct style for hours range', () => {
    const result = formatDurationI18n(202)
    expect(result.style).toBe('hours')
    expect(result.formatted).toBe('3h 22m')
    expect(result.hours).toBe(3)
  })

  it('returns correct style for days range', () => {
    const result = formatDurationI18n(20167)
    expect(result.style).toBe('days')
    expect(result.formatted).toBe('14d')
    expect(result.days).toBe(14)
  })
})

describe('getHaulType', () => {
  it('classifies short-haul flights (< 3 hours)', () => {
    expect(getHaulType(45)).toBe('short')
    expect(getHaulType(90)).toBe('short')
    expect(getHaulType(179)).toBe('short')
  })

  it('classifies medium-haul flights (3-6 hours)', () => {
    expect(getHaulType(180)).toBe('medium') // 3h
    expect(getHaulType(270)).toBe('medium') // 4.5h
    expect(getHaulType(360)).toBe('medium') // 6h
  })

  it('classifies long-haul flights (> 6 hours)', () => {
    expect(getHaulType(361)).toBe('long')
    expect(getHaulType(600)).toBe('long')
    expect(getHaulType(900)).toBe('long') // 15h
  })

  it('handles edge cases', () => {
    expect(getHaulType(0)).toBe('short')
    expect(getHaulType(-10)).toBe('short')
  })
})

describe('getHaulDistribution', () => {
  it('counts flights by haul type', () => {
    const durations = [45, 90, 180, 270, 600, 900]
    const result = getHaulDistribution(durations)

    expect(result).toEqual({
      short: 2,
      medium: 2,
      long: 2,
    })
  })

  it('ignores zero and negative durations', () => {
    const durations = [0, -10, 45, 180]
    const result = getHaulDistribution(durations)

    expect(result).toEqual({
      short: 1,
      medium: 1,
      long: 0,
    })
  })

  it('handles empty array', () => {
    const result = getHaulDistribution([])
    expect(result).toEqual({ short: 0, medium: 0, long: 0 })
  })
})

describe('getDepartureBucket', () => {
  it('classifies red-eye hours (22:00-05:00)', () => {
    expect(getDepartureBucket(22)).toBe('red_eye')
    expect(getDepartureBucket(23)).toBe('red_eye')
    expect(getDepartureBucket(0)).toBe('red_eye')
    expect(getDepartureBucket(3)).toBe('red_eye')
    expect(getDepartureBucket(4)).toBe('red_eye')
  })

  it('classifies early morning hours (05:00-09:00)', () => {
    expect(getDepartureBucket(5)).toBe('early')
    expect(getDepartureBucket(6)).toBe('early')
    expect(getDepartureBucket(8)).toBe('early')
  })

  it('classifies business hours (09:00-17:00)', () => {
    expect(getDepartureBucket(9)).toBe('business')
    expect(getDepartureBucket(12)).toBe('business')
    expect(getDepartureBucket(16)).toBe('business')
  })

  it('classifies evening hours (17:00-22:00)', () => {
    expect(getDepartureBucket(17)).toBe('evening')
    expect(getDepartureBucket(19)).toBe('evening')
    expect(getDepartureBucket(21)).toBe('evening')
  })
})

describe('getDominantPattern', () => {
  it('finds the most common departure pattern', () => {
    const patterns = {
      red_eye: 5,
      early: 10,
      business: 25,
      evening: 15,
    }

    const result = getDominantPattern(patterns)

    expect(result).not.toBeNull()
    expect(result!.bucket).toBe('business')
    expect(result!.count).toBe(25)
    expect(result!.percentage).toBe(45) // 25/55 ≈ 45%
  })

  it('returns null for empty patterns', () => {
    const patterns = {
      red_eye: 0,
      early: 0,
      business: 0,
      evening: 0,
    }

    const result = getDominantPattern(patterns)
    expect(result).toBeNull()
  })

  it('handles ties by returning first match', () => {
    const patterns = {
      red_eye: 10,
      early: 10,
      business: 10,
      evening: 10,
    }

    const result = getDominantPattern(patterns)

    expect(result).not.toBeNull()
    expect(result!.count).toBe(10)
    expect(result!.percentage).toBe(25)
  })

  it('calculates percentage correctly', () => {
    const patterns = {
      red_eye: 1,
      early: 0,
      business: 3,
      evening: 0,
    }

    const result = getDominantPattern(patterns)

    expect(result!.percentage).toBe(75) // 3/4 = 75%
  })
})
