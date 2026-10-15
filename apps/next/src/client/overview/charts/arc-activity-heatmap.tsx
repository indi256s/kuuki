import type { SVGProps } from 'react'
import { DAY_MS, dayToEpoch, epochToDay } from '@kuuki/shared/overview/range'
import { formatDateOnly, formatNumber, type Locale } from '../../../lib/format'
import type { ChartPoint } from './kuuki-chart'

/** `missing` marks a day the journal has no evidence for (see `activityPoints`); its `count` of 0 is then not a known zero. */
type ActivityDay = { date: string; count: number; missing: boolean }
/** Absolute daily levels: 0 flights, then 1, 2, 3 and 4 or more, whatever the year or filter. */
export type DailyLevel = 0 | 1 | 2 | 3 | 4
export const dailyLevel = (count: number): DailyLevel =>
  count > 0 ? (Math.min(4, Math.ceil(count)) as 1 | 2 | 3 | 4) : 0
/** Levels 1–3 can sit under 3:1 on the card surface (level 3 for Matcha and Asagi in light), so their cells carry `--heat-contour`. A known zero is the quiet `--heat-0` fill and a missing day is the dashed outline, so neither is contoured. */
export const heatIsWeak = (level: number) => level >= 1 && level <= 3

// Arc Activity heatmap calendar model, MIT; see the source inventory and ui/ARC-LICENSE.txt. Levels are Kuuki's own absolute scale.
/**
 * One point per day of `year`. A day inside `known` (first dated flight of the whole journal through today, inclusive)
 * with no completed flight is a known zero. A day outside it is missing: the journal does not say whether anything
 * happened. A day with a completed flight is never missing. `known: null` treats every empty day as missing.
 */
export function activityPoints(
  year: number,
  days: readonly Pick<ActivityDay, 'date' | 'count'>[],
  locale: Locale,
  known: { from: string; to: string } | null,
): ChartPoint<ActivityDay>[] {
  const start = dayToEpoch(`${String(year).padStart(4, '0')}-01-01`)
  const end = dayToEpoch(`${String(year).padStart(4, '0')}-12-31`)
  if (start === null || end === null) return []
  const counts = new Map(days.map((day) => [day.date, day.count]))
  return Array.from({ length: Math.round((end - start) / DAY_MS) + 1 }, (_, index) => {
    const date = epochToDay(start + index * DAY_MS)!,
      count = counts.get(date) ?? 0,
      missing = count <= 0 && (!known || date < known.from || date > known.to)
    return {
      key: date,
      datum: { date, count, missing },
      label: `${formatDateOnly(locale, date, 'medium')} · ${missing ? (locale === 'ru' ? 'нет данных' : 'no data') : formatNumber(locale, count)}`,
    }
  })
}

// Calendar geometry in CSS pixels: cells sit on a square pitch that grows with the host up to MAX, never below MIN (the host scrolls instead). A tight pitch narrows the gap.
const CAL = { left: 20, right: 4, top: 30, gap: 3, min: 10, max: 21 }
const calendarGap = (pitch: number) => (pitch < 13 ? 2 : CAL.gap)
const leadDays = (points: readonly ChartPoint<ActivityDay>[], locale: Locale) =>
  (new Date(dayToEpoch(points[0].datum.date)!).getUTCDay() - (locale === 'ru' ? 1 : 0) + 7) % 7
/** Number of week columns the year needs, including the partial first and last weeks. */
export const calendarColumns = (points: readonly ChartPoint<ActivityDay>[], locale: Locale) =>
  points.length ? Math.ceil((leadDays(points, locale) + points.length) / 7) : 0
/** Natural SVG width for `columns` weeks inside `available` pixels. */
export const calendarWidth = (columns: number, available: number) =>
  CAL.left +
  CAL.right +
  columns *
    Math.min(CAL.max, Math.max(CAL.min, (available - CAL.left - CAL.right) / Math.max(1, columns)))
const calendarPitch = (columns: number, width: number) =>
  (width - CAL.left - CAL.right) / Math.max(1, columns)
export const calendarHeight = (columns: number, width: number) =>
  CAL.top + 7 * calendarPitch(columns, width) + 2

export function ArcActivityHeatmap({
  points,
  locale,
  width,
  mark,
}: {
  points: readonly ChartPoint<ActivityDay>[]
  locale: Locale
  /** SVG width in CSS pixels, from `calendarWidth`. */ width: number
  mark: (point: ChartPoint<ActivityDay>) => SVGProps<SVGGElement>
}) {
  if (!points.length) return null
  const start = dayToEpoch(points[0].datum.date)!,
    lead = leadDays(points, locale)
  const pitch = calendarPitch(calendarColumns(points, locale), width),
    cell = pitch - calendarGap(pitch)
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  return (
    <g>
      {points.map((point, index) => {
        const x = Math.floor((lead + index) / 7) * pitch + CAL.left,
          y = ((lead + index) % 7) * pitch + CAL.top
        const { count, missing } = point.datum,
          level = dailyLevel(count)
        const props = mark(point),
          date = new Date(start + index * DAY_MS)
        return (
          <g key={point.key}>
            {(index === 0 || date.getUTCDate() === 1) && (
              <text x={x} y={16} fill="var(--text-muted)" fontSize={12} data-sans>
                {monthName.format(date)}
              </text>
            )}
            <g
              {...props}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  event.stopPropagation()
                  const next =
                    points[
                      Math.max(
                        0,
                        Math.min(points.length - 1, index + (event.key === 'ArrowLeft' ? -7 : 7)),
                      )
                    ]
                  const target = Array.from(
                    event.currentTarget.ownerSVGElement?.querySelectorAll<SVGGElement>(
                      '[data-kc-key]',
                    ) ?? [],
                  ).find((node) => node.dataset.kcKey === next.key)
                  target?.focus()
                } else props.onKeyDown?.(event)
              }}
            >
              {/* Missing days are an empty dashed outline (transparent, not none, so the cell keeps its hit area); known zeros are filled. */}
              {missing ? (
                <rect
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill="transparent"
                  stroke="var(--missing)"
                  strokeDasharray="2 2"
                />
              ) : (
                <rect
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill={`var(--heat-${level})`}
                  stroke={heatIsWeak(level) ? 'var(--heat-contour)' : undefined}
                />
              )}
              <title>{point.label}</title>
            </g>
          </g>
        )
      })}
    </g>
  )
}
