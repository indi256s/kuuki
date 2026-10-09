import { EARTH_CIRCUMFERENCE_KM, MOON_DISTANCE_KM } from '@kuuki/shared/constants'

// Great-circle totals against well-known distances. Nothing here is estimated: laps are total / equator, Moon is the average Earth-Moon distance.
export const MOON_AND_BACK_KM = MOON_DISTANCE_KM * 2
/** The reference line is drawn only when it keeps the chart scale within this factor of the current total. */
export const REACH = 1.6

export type Landmark =
  | { kind: 'lap'; laps: number; km: number }
  | { kind: 'moon' | 'moonBack'; km: number }

/** First point whose cumulative value reaches each full lap. Points must be ascending in x with a non-decreasing y; one big jump yields several laps at the same x. */
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

/** The nearest landmark above the total: the next equator lap, the Moon or the Moon and back. */
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
/** Whole percent, floored so a total that has not arrived never reads 100%. */
export const progressPercent = (total: number, km: number) =>
  Math.min(99, Math.floor((total / km) * 100))

/** Equator laps plus progress toward the Moon (then Moon and back); null once past both. */
export function landmarkSummary(total: number) {
  const moon =
    total < MOON_DISTANCE_KM
      ? { kind: 'moon' as const, percent: progressPercent(total, MOON_DISTANCE_KM) }
      : total < MOON_AND_BACK_KM
        ? { kind: 'moonBack' as const, percent: progressPercent(total, MOON_AND_BACK_KM) }
        : null
  return { laps: total / EARTH_CIRCUMFERENCE_KM, moon }
}

/** Greedy label thinning in pixels: a label is dropped when it is within `minDx` horizontally and `minDy` vertically of one already kept. */
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
