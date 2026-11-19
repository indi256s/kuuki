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

/** Projects stays onto tentative routes; profile details and trip IDs stay on the device. */
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
  const starts = new Map<string, number>()
  for (const stay of stays) starts.set(stay.date_start, (starts.get(stay.date_start) ?? 0) + 1)
  const lines: string[] = []
  let skipped = 0
  for (let index = 1; index < stays.length; index++) {
    const from = stays[index - 1],
      to = stays[index]
    // Tied starts cannot establish direction; repeated stays do not establish a journey.
    if (
      starts.get(from.date_start)! > 1 ||
      starts.get(to.date_start)! > 1 ||
      (from.place === to.place && from.country_code === to.country_code)
    ) {
      skipped++
      continue
    }
    // Overlaps cannot supply a date. The next stay's start is otherwise only an estimate.
    const date = from.date_end > to.date_start ? 'Undated' : to.date_start
    lines.push(
      `${date} | ${from.place}, ${from.country_code || '?'} → ${to.place}, ${to.country_code || '?'} [possible flight inferred from Nomads stays; unconfirmed]`,
    )
  }
  const text = lines.join('\n')
  if (text.length > 100_000) throw new Error('Routes too long')
  return { content: text, skipped }
}
