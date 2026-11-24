import { isCalendarDate } from '@kuuki/shared'

export const NOMADS_ACCEPT = '.json,application/json'
export const isNomadsFile = (file: { name: string; type: string }) =>
  /\.json$/i.test(file.name) || file.type === 'application/json'

interface Stay {
  place: string
  country_code: string
  date_start: string
  date_end: string
}

function samePlace(a: Stay, b: Stay): boolean {
  return a.country_code === b.country_code && a.place.toLowerCase() === b.place.toLowerCase()
}

function omitSplitResumptions(stays: Stay[]): Stay[] {
  const starts = new Map<string, Stay[]>()
  for (const stay of stays) {
    const group = starts.get(stay.date_start) ?? []
    group.push(stay)
    starts.set(stay.date_start, group)
  }
  return stays.filter((stay) => {
    if (starts.get(stay.date_start)?.length !== 2) return true
    const visits = stays.filter(
      (visit) =>
        visit.date_start < stay.date_start &&
        visit.date_end === stay.date_start &&
        starts.get(visit.date_start)?.length === 1 &&
        !samePlace(stay, visit),
    )
    if (visits.length !== 1) return true
    const [visit] = visits
    const candidates = starts
      .get(stay.date_start)!
      .filter(
        (candidate) =>
          !samePlace(candidate, visit) &&
          stays.some(
            (earlier) =>
              earlier.date_start < visit.date_start &&
              earlier.date_end === visit.date_start &&
              samePlace(earlier, candidate),
          ),
      )
    return candidates.length !== 1 || candidates[0] !== stay
  })
}

export function nomadsToText(content: string): { content: string; skipped: number } {
  const data: unknown = JSON.parse(content.replace(/^\uFEFF/, ''))
  if (!data || typeof data !== 'object' || !('trips' in data) || !Array.isArray(data.trips))
    throw new Error('Expected Nomads trips')
  if (data.trips.length > 501) throw new Error('Too many stays')
  const stays = data.trips
    .map((value: unknown): Stay => {
      if (!value || typeof value !== 'object') throw new Error('Invalid stay')
      const stay = value as Record<string, unknown>
      if (
        typeof stay.place !== 'string' ||
        !stay.place.trim() ||
        stay.place.length > 150 ||
        /[|\[\]\r\n→➝<>]/.test(stay.place) ||
        typeof stay.country_code !== 'string' ||
        !/^(?:[A-Z]{2})?$/.test(stay.country_code) ||
        typeof stay.date_start !== 'string' ||
        !isCalendarDate(stay.date_start) ||
        typeof stay.date_end !== 'string' ||
        !isCalendarDate(stay.date_end) ||
        stay.date_end < stay.date_start
      )
        throw new Error('Invalid stay')
      return {
        place: stay.place.trim(),
        country_code: stay.country_code,
        date_start: stay.date_start,
        date_end: stay.date_end,
      }
    })
    .sort((a, b) => a.date_start.localeCompare(b.date_start))
  const review = omitSplitResumptions(stays)
  const starts = new Map<string, number>()
  for (const stay of review) starts.set(stay.date_start, (starts.get(stay.date_start) ?? 0) + 1)
  const lines: string[] = []
  for (let index = 1; index < review.length; index++) {
    const from = review[index - 1],
      to = review[index]
    if (starts.get(from.date_start)! > 1 || starts.get(to.date_start)! > 1 || samePlace(from, to)) {
      continue
    }
    const date = from.date_end > to.date_start ? 'Undated' : to.date_start
    lines.push(
      `${date} | ${from.place}, ${from.country_code || '?'} → ${to.place}, ${to.country_code || '?'} [possible flight inferred from Nomads stays; unconfirmed]`,
    )
  }
  const text = lines.join('\n')
  if (text.length > 100_000) throw new Error('Routes too long')
  return { content: text, skipped: Math.max(0, stays.length - 1 - lines.length) }
}
