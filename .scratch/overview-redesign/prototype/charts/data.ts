import flightsJson from './flights.json'

export const C = { text: '#302d2a', muted: '#66605b', hair: '#dedad5', inset: '#f2f0ed', accent: '#c23417', bg: '#fbfaf8', r1: '#e6c8c1', r2: '#e4735c', r3: '#e4735c', r4: '#b16042', ok: '#2f6b3f' }
export const nf = new Intl.NumberFormat('en-US')
export const hm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`

export interface Flight { date: string; from: string; to: string; airline: string; family: string; maker: string; distanceKm: number; blockMinutes: number; depLocalHour: number; fromUtcOffset: number; toUtcOffset: number; outlier?: string; flightNumber?: string }
export interface Row extends Flight { hours: number; d: Date; route: string }
export const rows: Row[] = (flightsJson as Flight[]).map((f) => ({ ...f, hours: f.blockMinutes / 60, d: new Date(f.date + 'T00:00:00Z'), route: `${f.from}→${f.to}` }))
export const totalKm = rows.reduce((s, r) => s + r.distanceKm, 0)

export const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// least-squares line of block hours on distance (same line the regression mark draws)
export const fit = (() => {
  const n = rows.length
  const mx = rows.reduce((s, r) => s + r.distanceKm, 0) / n
  const my = rows.reduce((s, r) => s + r.hours, 0) / n
  const slope = rows.reduce((s, r) => s + (r.distanceKm - mx) * (r.hours - my), 0) / rows.reduce((s, r) => s + (r.distanceKm - mx) ** 2, 0)
  const intercept = my - slope * mx
  return { slope, intercept, at: (km: number) => intercept + slope * km }
})()
