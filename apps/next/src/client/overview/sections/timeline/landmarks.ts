import { EARTH_CIRCUMFERENCE_KM, MOON_DISTANCE_KM } from '@kuuki/shared/constants'

export const MOON_AND_BACK_KM = MOON_DISTANCE_KM * 2
export const REACH = 1.6

export type Landmark =
  | { kind: 'lap'; laps: number; km: number }
  | { kind: 'moon' | 'moonBack'; km: number }

export function lapCrossings(
  points: readonly { x: number; y: number }[],
): Array<{ lap: number; x: number; y: number }> {
  const out: Array<{ lap: number; x: number; y: number }> = []
  let lap = 1
  for (const point of points) {
    while (point.y >= lap * EARTH_CIRCUMFERENCE_KM) {
      out.push({ lap, x: point.x, y: lap * EARTH_CIRCUMFERENCE_KM })
      lap++
    }
  }
  return out
}

export function nextLandmark(total: number): Landmark | null {
  if (!(total > 0)) return null
  const laps = Math.floor(total / EARTH_CIRCUMFERENCE_KM) + 1
  const candidates: Landmark[] = [
    { kind: 'lap', laps, km: laps * EARTH_CIRCUMFERENCE_KM },
    { kind: 'moon', km: MOON_DISTANCE_KM },
    { kind: 'moonBack', km: MOON_AND_BACK_KM },
  ]
  return candidates.filter((item) => item.km > total).sort((a, b) => a.km - b.km)[0] ?? null
}
export const withinReach = (total: number, landmark: Landmark) => landmark.km <= total * REACH
export const progressPercent = (total: number, km: number) =>
  Math.min(99, Math.floor((total / km) * 100))

export function landmarkSummary(total: number) {
  const moon =
    total < MOON_DISTANCE_KM
      ? { kind: 'moon' as const, percent: progressPercent(total, MOON_DISTANCE_KM) }
      : total < MOON_AND_BACK_KM
        ? { kind: 'moonBack' as const, percent: progressPercent(total, MOON_AND_BACK_KM) }
        : null
  return { laps: total / EARTH_CIRCUMFERENCE_KM, moon }
}

export function spreadLabels(
  items: readonly { x: number; y: number }[],
  minDx: number,
  minDy: number,
): boolean[] {
  const kept: Array<{ x: number; y: number }> = []
  return items.map((item) => {
    if (
      kept.some((other) => Math.abs(other.x - item.x) < minDx && Math.abs(other.y - item.y) < minDy)
    )
      return false
    kept.push(item)
    return true
  })
}
