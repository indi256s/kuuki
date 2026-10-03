/**
 * Adaptive duration formatting utility for Time Geek tier
 *
 * Formats duration in the most human-readable unit:
 * - < 60 minutes → "45m"
 * - < 24 hours → "3h 22m"
 * - ≥ 24 hours → "14d 7h"
 */

interface DurationParts {
  days: number
  hours: number
  minutes: number
  totalMinutes: number
}

/**
 * Decompose minutes into days, hours, and remaining minutes
 */
function formatDurationParts(totalMinutes: number): DurationParts {
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
