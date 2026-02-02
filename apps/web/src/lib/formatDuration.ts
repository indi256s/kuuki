/**
 * Adaptive duration formatting utility for Time Geek tier
 *
 * Formats duration in the most human-readable unit:
 * - < 60 minutes → "45m"
 * - < 24 hours → "3h 22m"
 * - ≥ 24 hours → "14d 7h"
 */

export interface DurationParts {
  days: number
  hours: number
  minutes: number
  totalMinutes: number
}

/**
 * Decompose minutes into days, hours, and remaining minutes
 */
export function formatDurationParts(totalMinutes: number): DurationParts {
  if (totalMinutes < 0) totalMinutes = 0

  const days = Math.floor(totalMinutes / (24 * 60))
  const remainingAfterDays = totalMinutes % (24 * 60)
  const hours = Math.floor(remainingAfterDays / 60)
  const minutes = Math.round(remainingAfterDays % 60)

  return { days, hours, minutes, totalMinutes }
}

export type DurationStyle = 'adaptive' | 'full' | 'short'

export interface FormatDurationOptions {
  /** Display style - adaptive (default) adjusts units, full always shows all, short is minimal */
  style?: DurationStyle
  /** Whether to include zero values in full style */
  includeZeros?: boolean
}

/**
 * Format a duration in minutes to a human-readable string
 *
 * @param minutes - Duration in minutes
 * @param options - Formatting options
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(45)      // "45m"
 * formatDuration(202)     // "3h 22m"
 * formatDuration(20167)   // "14d 7h"
 */
export function formatDuration(
  minutes: number,
  options: FormatDurationOptions = {}
): string {
  const { style = 'adaptive' } = options

  if (minutes <= 0) return '0m'

  const parts = formatDurationParts(minutes)

  if (style === 'short') {
    // Ultra-compact: just the largest unit
    if (parts.days > 0) return `${parts.days}d`
    if (parts.hours > 0) return `${parts.hours}h`
    return `${parts.minutes}m`
  }

  if (style === 'full') {
    // Always show all non-zero parts
    const segments: string[] = []
    if (parts.days > 0) segments.push(`${parts.days}d`)
    if (parts.hours > 0) segments.push(`${parts.hours}h`)
    if (parts.minutes > 0 || segments.length === 0) segments.push(`${parts.minutes}m`)
    return segments.join(' ')
  }

  // Adaptive style (default): choose the most readable format
  const totalHours = minutes / 60

  // Less than 1 hour: show minutes only
  if (totalHours < 1) {
    return `${parts.minutes}m`
  }

  // Less than 24 hours: show hours and minutes
  if (totalHours < 24) {
    if (parts.minutes === 0) {
      return `${parts.hours}h`
    }
    return `${parts.hours}h ${parts.minutes}m`
  }

  // 24+ hours: show days and hours (skip minutes for readability)
  if (parts.hours === 0) {
    return `${parts.days}d`
  }
  return `${parts.days}d ${parts.hours}h`
}

/**
 * Format duration with i18n-friendly output for translation keys
 * Returns an object that can be used with ICU message format
 */
export function formatDurationI18n(minutes: number): {
  days: number
  hours: number
  minutes: number
  formatted: string
  style: 'minutes' | 'hours' | 'days'
} {
  const parts = formatDurationParts(minutes)
  const totalHours = minutes / 60

  let style: 'minutes' | 'hours' | 'days'
  if (totalHours < 1) {
    style = 'minutes'
  } else if (totalHours < 24) {
    style = 'hours'
  } else {
    style = 'days'
  }

  return {
    days: parts.days,
    hours: parts.hours,
    minutes: parts.minutes,
    formatted: formatDuration(minutes),
    style,
  }
}

/**
 * Categorize flight duration into haul type
 * Industry standard thresholds:
 * - Short-haul: < 3 hours
 * - Medium-haul: 3-6 hours
 * - Long-haul: > 6 hours
 */
export type HaulType = 'short' | 'medium' | 'long'

export function getHaulType(minutes: number): HaulType {
  const hours = minutes / 60
  if (hours < 3) return 'short'
  if (hours <= 6) return 'medium'
  return 'long'
}

/**
 * Get haul type distribution from an array of flight durations
 */
export function getHaulDistribution(durations: number[]): Record<HaulType, number> {
  const distribution: Record<HaulType, number> = { short: 0, medium: 0, long: 0 }

  for (const duration of durations) {
    if (duration > 0) {
      distribution[getHaulType(duration)]++
    }
  }

  return distribution
}

/**
 * Categorize departure time into aviation time buckets
 * - Red-eye: 22:00-05:00
 * - Early: 05:00-09:00
 * - Business: 09:00-17:00
 * - Evening: 17:00-22:00
 */
export type DepartureBucket = 'red_eye' | 'early' | 'business' | 'evening'

export function getDepartureBucket(hour: number): DepartureBucket {
  if (hour >= 22 || hour < 5) return 'red_eye'
  if (hour >= 5 && hour < 9) return 'early'
  if (hour >= 9 && hour < 17) return 'business'
  return 'evening'
}

/**
 * Get the dominant departure pattern from counts
 */
export function getDominantPattern(
  patterns: Record<DepartureBucket, number>
): { bucket: DepartureBucket; count: number; percentage: number } | null {
  const total = Object.values(patterns).reduce((sum, count) => sum + count, 0)
  if (total === 0) return null

  let maxBucket: DepartureBucket = 'business'
  let maxCount = 0

  for (const [bucket, count] of Object.entries(patterns) as [DepartureBucket, number][]) {
    if (count > maxCount) {
      maxCount = count
      maxBucket = bucket
    }
  }

  return {
    bucket: maxBucket,
    count: maxCount,
    percentage: Math.round((maxCount / total) * 100),
  }
}
