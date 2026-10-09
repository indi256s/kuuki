import type { OverviewRow } from '@kuuki/shared/overview/model'

export type OnThisDay = {
  year: string
  flightId: number
  origin: string
  destination: string
  more: number
}

/**
 * Logged flights flown on today's month and day in an earlier year; the most recent such year wins and its first flight is shown.
 * Matching is by exact month-day, so a 29 February flight is remembered only in leap years.
 * `today` is the user's local calendar day as `YYYY-MM-DD`. Rows with non-day dates (legacy monthly summaries) never match.
 */
export function onThisDay(rows: readonly OverviewRow[], today: string): OnThisDay | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const monthDay = today.slice(5),
    year = today.slice(0, 4)
  const matches = rows.filter(
    (row) =>
      row.state === 'logged' &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      row.date.slice(5) === monthDay &&
      row.date.slice(0, 4) < year,
  )
  if (!matches.length) return null
  const latest = matches
    .map((row) => row.date.slice(0, 4))
    .sort()
    .at(-1)!
  const day = matches.filter((row) => row.date.startsWith(latest)).sort((a, b) => a.id - b.id)
  return {
    year: latest,
    flightId: day[0].id,
    origin: day[0].origin,
    destination: day[0].destination,
    more: day.length - 1,
  }
}

export function localDay(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
