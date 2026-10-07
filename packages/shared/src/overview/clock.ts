import { bandOf, haulOf } from './filter'
import { coverage, hasPreciseDuration, type Gate } from './figures'
import type { Haul, OverviewRow } from './model'

export interface Clock {
  byHour: Array<{ key: string; hour: number; flights: number }>
  redEyes: number
  haul: Array<{ key: Haul; flights: number }>
  averageSpeedKmh: number | null
  withDepartureTime: number; total: number
}

export function clock(rows: OverviewRow[]): Gate<Clock> {
  const { withDepartureTime, total } = coverage(rows)
  if (withDepartureTime < 10) return { status: 'below', have: withDepartureTime, need: 10 }
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ key: String(hour).padStart(2, '0'), hour, flights: 0 }))
  const haul: Clock['haul'] = [{ key: 'short', flights: 0 }, { key: 'medium', flights: 0 }, { key: 'long', flights: 0 }]
  let redEyes = 0, speedDistance = 0, speedDuration = 0
  for (const row of rows) {
    const minute = row.depMinute, distance = row.distanceKm
    if (minute !== null && Number.isFinite(minute) && minute >= 0 && minute < 1440) {
      byHour[Math.floor(minute / 60)].flights += row.weight
      if (bandOf(minute) === 'night') redEyes += row.weight
    }
    if (distance !== null && Number.isFinite(distance) && distance >= 0 && row.weight > 0) {
      const category = haulOf(distance / row.weight)
      haul.find(item => item.key === category)!.flights += row.weight
      if (hasPreciseDuration(row) && row.durationMinutes !== null && row.durationMinutes > 0) {
        speedDistance += distance
        speedDuration += row.durationMinutes
      }
    }
  }
  return { status: 'ready', value: { byHour, redEyes, haul,
    averageSpeedKmh: speedDuration > 0 ? speedDistance / speedDuration * 60 : null, withDepartureTime, total } }
}
