export const DAY_MS = 86_400_000

/** Calendar days use UTC; setUTCFullYear avoids Date.UTC's 1900 offset for years 0–99. */
export function dayToEpoch(day: string): number | null {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(day)) return null
  const date = new Date(0)
  date.setUTCFullYear(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8)))
  return date.toISOString().slice(0, 10) === day ? date.getTime() : null
}

export function epochToDay(epoch: number): string | null {
  const date = new Date(epoch)
  const year = date.getUTCFullYear()
  return Number.isFinite(date.getTime()) && year >= 0 && year <= 9999 ? date.toISOString().slice(0, 10) : null
}

/** Legacy month bounds expand to whole months; exact bounds stay inclusive calendar days. */
export function periodDays(period: { from: string; to: string }): { from: string; to: string } | null {
  let { from, to } = period
  if (/^\d{4}-(?:0[1-9]|1[0-2])$/.test(from) && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(to)) {
    from += '-01'
    const end = new Date(0)
    end.setUTCFullYear(Number(to.slice(0, 4)), Number(to.slice(5)), 0)
    to = end.toISOString().slice(0, 10)
  }
  return dayToEpoch(from) !== null && dayToEpoch(to) !== null && from <= to ? { from, to } : null
}
