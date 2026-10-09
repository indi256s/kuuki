import type { SVGProps } from 'react'
import { DAY_MS, dayToEpoch, epochToDay } from '@kuuki/shared/overview/range'
import { formatDateOnly, type Locale } from '../../../lib/format'
import type { ChartPoint } from './kuuki-chart'

type ActivityDay = { date: string; count: number }

// Arc Activity heatmap calendar model and level rules, MIT; see the source inventory and ui/ARC-LICENSE.txt.
export function activityPoints(
  year: number,
  days: readonly ActivityDay[],
  locale: Locale,
): ChartPoint<ActivityDay>[] {
  const start = dayToEpoch(`${String(year).padStart(4, '0')}-01-01`)
  const end = dayToEpoch(`${String(year).padStart(4, '0')}-12-31`)
  if (start === null || end === null) return []
  const counts = new Map(days.map((day) => [day.date, day.count]))
  return Array.from({ length: Math.round((end - start) / DAY_MS) + 1 }, (_, index) => {
    const date = epochToDay(start + index * DAY_MS)!,
      count = counts.get(date) ?? 0
    return {
      key: date,
      datum: { date, count },
      label: `${formatDateOnly(locale, date, 'medium')} · ${new Intl.NumberFormat(locale).format(count)}`,
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
  const max = points.reduce((highest, point) => Math.max(highest, point.datum.count), 0)
  const bounds = [
    Math.max(1, Math.ceil(max * 0.25)),
    Math.max(2, Math.ceil(max * 0.5)),
    Math.max(3, Math.ceil(max * 0.75)),
  ]
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  return (
    <g>
      {points.map((point, index) => {
        const x = Math.floor((lead + index) / 7) * pitch + CAL.left,
          y = ((lead + index) % 7) * pitch + CAL.top
        const count = point.datum.count,
          level =
            count <= 0
              ? 0
              : count <= bounds[0]
                ? 1
                : count <= bounds[1]
                  ? 2
                  : count <= bounds[2]
                    ? 3
                    : 4
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
              <rect x={x} y={y} width={cell} height={cell} rx={3} fill={`var(--heat-${level})`} />
              <title>{point.label}</title>
            </g>
          </g>
        )
      })}
    </g>
  )
}
