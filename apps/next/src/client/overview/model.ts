import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
// Pure view-model helpers for the Overview modules: captions, comparison text, ranking shape and month strip.
// No DOM, no data lookups; the modules pass already localized labels in.
import type { OverviewDelta, OverviewSummary } from '@kuuki/shared/overview'
import { formatCount, formatDuration, formatMonthYear, formatNumber, type Locale } from '../../lib/format'
import { S, fill, forms, t } from './copy'

const MINUS = '−'
const EARTH_KM = EARTH_CIRCUMFERENCE_KM

/** "−85% vs 2025", "+3 vs 2025" or "First year"; null when there is nothing honest to say (no baseline and no change). */
export function comparisonCaption(locale: Locale, delta: OverviewDelta | null, comparison: NonNullable<OverviewSummary['comparison']>, unit: (n: number) => string = n => formatNumber(locale, n)): string | null {
  if (!delta) return null
  const year = comparison.previousPeriod
  if (delta.percent !== null) {
    if (delta.percent === 0) return fill(t(S.unchanged, locale), { year })
    return `${delta.percent > 0 ? '+' : MINUS}${formatNumber(locale, Math.abs(delta.percent))}% ${fill(t(S.vs, locale), { year })}`
  }
  if (delta.delta === 0) return null
  if (comparison.firstYear) return t(S.firstYear, locale)
  return `${delta.delta > 0 ? '+' : MINUS}${unit(Math.abs(delta.delta))} ${fill(t(S.vs, locale), { year })}`
}

/** "3.5 times around the Earth"; null under a tenth of a lap, where the comparison says nothing. */
export function earthCaption(locale: Locale, km: number): string | null {
  const laps = Math.round(km / EARTH_KM * 10) / 10
  if (laps < 0.1) return null
  if (Number.isInteger(laps)) return formatCount(locale, laps, forms.earth)
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(laps)
  // A fraction takes the singular genitive in Russian ("3,5 раза") and the plural in English.
  return `${number} ${locale === 'ru' ? 'раза вокруг Земли' : 'times around the Earth'}`
}

export interface TimeFigure { value: string; unit: string | null; caption: string | null }

/** Hours in the air with an availability caption: unknown is never shown as a genuine zero. */
export function timeFigure(locale: Locale, summary: Pick<OverviewSummary, 'totals' | 'dataAvailability'>): TimeFigure {
  const { flights, durationKnown } = summary.dataAvailability
  if (flights > 0 && durationKnown === 0) return { value: '—', unit: null, caption: t(S.durationUnknown, locale) }
  const minutes = summary.totals.durationMinutes
  const partial = flights > 0 && durationKnown < flights
    ? formatCount(locale, flights, forms.durationKnown).replace('{known}', formatNumber(locale, durationKnown)) : null
  if (minutes < 60 && minutes > 0) return { value: formatDuration(locale, minutes), unit: null, caption: partial }
  return { value: formatNumber(locale, Math.round(minutes / 60)), unit: t(S.hours, locale), caption: partial }
}

export type RankingKind = 'airlines' | 'airports' | 'aircraft'
export interface RankingRow { id: string; label: string; count: number; href: string }
export type RankingShape =
  | { kind: 'empty' }
  | { kind: 'sentence'; rows: RankingRow[]; all: boolean }
  | { kind: 'list'; rows: RankingRow[]; max: number }

/**
 * Fewer than three entries read as a sentence, not as bars that would overstate a pattern.
 * `all` is true when one entry covers every flight of the period (airlines and aircraft only).
 */
export function rankingShape(rows: RankingRow[], flights: number, kind: RankingKind): RankingShape {
  if (rows.length === 0) return { kind: 'empty' }
  if (rows.length < 3) return { kind: 'sentence', rows, all: kind !== 'airports' && rows.length === 1 && rows[0].count === flights }
  return { kind: 'list', rows, max: Math.max(...rows.map(row => row.count)) }
}

const LEADS: Record<RankingKind, { en: string; ru: string }> = {
  airlines: { en: 'Flown with', ru: 'Вы летали с' },
  airports: { en: 'Passed through', ru: 'Через' },
  aircraft: { en: 'Flown on', ru: 'Вы летали на' },
}

/** The words before the names of a sentence ranking: "Flown with" or "All 12 flights:". */
export function sentenceLead(locale: Locale, kind: RankingKind, all: boolean, totalFlights: number): string {
  if (all) {
    const total = formatCount(locale, totalFlights, forms.flights)
    return locale === 'ru' ? `Все ${total}:` : `All ${total}:`
  }
  return t(LEADS[kind], locale)
}

export interface MonthBar { month: string; label: string; flights: number; height: number; text: string }

/** Bars scaled to the busiest month, each with its own text; `busiest` is a sentence, or null when nothing flew. */
export function monthStrip(locale: Locale, months: OverviewSummary['months']): { bars: MonthBar[]; busiest: string | null } {
  const max = Math.max(0, ...months.map(month => month.flights))
  const bars = months.map(month => ({
    month: month.month,
    label: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(`${month.month}-01T12:00:00Z`)),
    flights: month.flights,
    height: max === 0 ? 0 : month.flights === 0 ? 0 : Math.max(6, Math.round(month.flights / max * 100)),
    text: `${formatMonthYear(locale, month.month)}: ${formatCount(locale, month.flights, forms.flights)}`,
  }))
  if (max === 0) return { bars, busiest: null }
  const top = months.reduce((best, month) => (month.flights > best.flights ? month : best))
  return { bars, busiest: fill(t(S.busiest, locale), { month: formatMonthYear(locale, top.month), flights: formatCount(locale, top.flights, forms.flights) }) }
}

const REGION_NAMES: Record<string, { en: string; ru: string }> = {
  africa: { en: 'Africa', ru: 'Африка' }, americas: { en: 'Americas', ru: 'Америка' }, asia: { en: 'Asia', ru: 'Азия' },
  europe: { en: 'Europe', ru: 'Европа' }, oceania: { en: 'Oceania', ru: 'Океания' }, antarctica: { en: 'Antarctica', ru: 'Антарктида' },
}
export const regionName = (locale: Locale, id: string) => (REGION_NAMES[id] ?? { en: id, ru: id })[locale]

/** Days from `today` ('YYYY-MM-DD' in the member's local calendar) to a flight date, without time-zone shifts. */
export function daysUntil(date: string, today: string): number {
  const day = (value: string) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) / 86_400_000
  return Math.round(day(date) - day(today))
}

export function countdownLabel(locale: Locale, days: number): string | undefined {
  if (days < 0) return undefined
  if (days === 0) return t(S.today, locale)
  if (days === 1) return t(S.tomorrow, locale)
  return formatCount(locale, days, forms.inDays)
}

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * The shape of a whole summary for the page: first run, a year without flights, or data. An all-time summary with no
 * flights but real published country evidence (archived legacy visits) is data: its geography is the member's own, so
 * the sample is reserved for a genuinely empty account. Unknown country figures (updating) never read as empty.
 */
export type OverviewMode = 'first-run' | 'empty-year' | 'data'
export function overviewMode(summary: Pick<OverviewSummary, 'period' | 'totals' | 'map'>): OverviewMode {
  const { totals, map } = summary
  if (totals.flights > 0) return 'data'
  if (summary.period !== 'all') return 'empty-year'
  const countryEvidence = totals.countries === null || totals.countries > 0 || (totals.pendingCountries ?? 0) > 0 || map.countries.length > 0
  return countryEvidence ? 'data' : 'first-run'
}
