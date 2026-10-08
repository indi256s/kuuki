import type { SVGProps } from 'react'
import { DAY_MS, dayToEpoch, epochToDay } from '@kuuki/shared/overview/range'
import { formatDateOnly, type Locale } from '../../../lib/format'
import type { ChartPoint } from './kuuki-chart'

type ActivityDay = { date: string; count: number }

// Arc Activity heatmap calendar model and level rules, MIT; see the source inventory and ui/ARC-LICENSE.txt.
export function activityPoints(year: number, days: readonly ActivityDay[], locale: Locale): ChartPoint<ActivityDay>[] {
  const start = dayToEpoch(`${String(year).padStart(4, '0')}-01-01`)
  const end = dayToEpoch(`${String(year).padStart(4, '0')}-12-31`)
  if (start === null || end === null) return []
  const counts = new Map(days.map(day => [day.date, day.count]))
  return Array.from({ length: Math.round((end - start) / DAY_MS) + 1 }, (_, index) => {
    const date = epochToDay(start + index * DAY_MS)!, count = counts.get(date) ?? 0
    return { key: date, datum: { date, count }, label: `${formatDateOnly(locale, date, 'medium')} · ${new Intl.NumberFormat(locale).format(count)}` }
  })
}

export function ArcActivityHeatmap({ points, locale, mark }: { points: readonly ChartPoint<ActivityDay>[]; locale: Locale; mark: (point: ChartPoint<ActivityDay>) => SVGProps<SVGGElement> }) {
  if (!points.length) return null
  const start = dayToEpoch(points[0].datum.date)!, weekStartsOn = locale === 'ru' ? 1 : 0
  const lead = (new Date(start).getUTCDay() - weekStartsOn + 7) % 7
  const max = points.reduce((highest, point) => Math.max(highest, point.datum.count), 0)
  const bounds = [Math.max(1, Math.ceil(max * .25)), Math.max(2, Math.ceil(max * .5)), Math.max(3, Math.ceil(max * .75))]
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  return <g>
    {points.map((point, index) => {
      const x = Math.floor((lead + index) / 7) * 16 + 20, y = ((lead + index) % 7) * 16 + 30
      const count = point.datum.count, level = count <= 0 ? 0 : count <= bounds[0] ? 1 : count <= bounds[1] ? 2 : count <= bounds[2] ? 3 : 4
      const props = mark(point), date = new Date(start + index * DAY_MS)
      return <g key={point.key}>
        {(index === 0 || date.getUTCDate() === 1) && <text x={x} y={16} fill="var(--text-muted)" fontSize={11}>{monthName.format(date)}</text>}
        <g {...props} onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            event.stopPropagation()
            const next = points[Math.max(0, Math.min(points.length - 1, index + (event.key === 'ArrowLeft' ? -7 : 7)))]
            const target = Array.from(event.currentTarget.ownerSVGElement?.querySelectorAll<SVGGElement>('[data-kc-key]') ?? []).find(node => node.dataset.kcKey === next.key)
            target?.focus()
          } else props.onKeyDown?.(event)
        }}><rect x={x} y={y} width={13} height={13} rx={3} fill={`var(--heat-${level})`} /><title>{point.label}</title></g>
      </g>
    })}
  </g>
}
