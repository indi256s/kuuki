const formatters = new Map<string, Intl.DateTimeFormat>()

export function utcOffsetMinutes(timeZone: string, instant: Date): number | null {
  try {
    let formatter = formatters.get(timeZone)
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      formatters.set(timeZone, formatter)
    }
    const offset = formatter.formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value
    if (offset === 'GMT') return 0
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset ?? '')
    return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : null
  } catch {
    return null
  }
}
