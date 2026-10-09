import type { SVGProps } from 'react'
import type { ChartPoint } from '../../charts/kuuki-chart'

export type ClockHour = { key: string; hour: number; flights: number }
type Props = {
  points: readonly ChartPoint<ClockHour>[]
  ghosts: readonly ClockHour[]
  peakHour: number | null
  centerLabel: string
  centerCaption: string
  mark: (point: ChartPoint<ClockHour>) => SVGProps<SVGGElement>
}

// Radial hour dial: midnight at the top, hours clockwise. Bars grow outward from INNER, scaled to the busiest all-time hour.
export const DIAL_SIZE = 300
const CENTER = DIAL_SIZE / 2,
  OUTER = CENTER - 26,
  INNER = 52,
  STEP = (Math.PI * 2) / 24,
  GAP = STEP * 0.14
const point = (angle: number, radius: number) =>
  `${(CENTER + Math.sin(angle) * radius).toFixed(2)},${(CENTER - Math.cos(angle) * radius).toFixed(2)}`
const sector = (from: number, to: number, inner: number, outer: number) => {
  const large = to - from > Math.PI ? 1 : 0
  return `M${point(from, outer)}A${outer},${outer} 0 ${large} 1 ${point(to, outer)}L${point(to, inner)}A${inner},${inner} 0 ${large} 0 ${point(from, inner)}Z`
}

export function ClockDial({ points, ghosts, peakHour, centerLabel, centerCaption, mark }: Props) {
  const max = Math.max(1, ...ghosts.map((row) => row.flights))
  const radius = (flights: number) => INNER + (OUTER - INNER) * Math.min(1, flights / max)
  const wedge = (hour: number, outer: number, inner = INNER) =>
    sector(hour * STEP + GAP / 2, (hour + 1) * STEP - GAP / 2, inner, outer)
  return (
    <g>
      <path
        d={sector(22 * STEP, 30 * STEP, 41, 47)}
        fill="var(--surface-inset)"
        aria-hidden="true"
      />
      <g aria-hidden="true" pointerEvents="none">
        {ghosts.map((row) => (
          <path
            key={row.key}
            d={wedge(row.hour, radius(row.flights))}
            fill="none"
            stroke="var(--mark-ghost)"
            strokeWidth={1}
          />
        ))}
        {[0, 6, 12, 18, 22].map((hour) => (
          <text
            key={hour}
            x={CENTER + Math.sin(hour * STEP) * (OUTER + 14)}
            y={CENTER - Math.cos(hour * STEP) * (OUTER + 14)}
            dy="0.32em"
            textAnchor="middle"
            fontSize={12}
            fill="var(--text-muted)"
          >
            {String(hour).padStart(2, '0')}
          </text>
        ))}
        <text x={CENTER} y={CENTER} dy={-4} textAnchor="middle" fontSize={22} fill="var(--text)">
          {centerLabel}
        </text>
        <text
          x={CENTER}
          y={CENTER}
          dy={16}
          textAnchor="middle"
          fontSize={13}
          fill="var(--text-muted)"
        >
          {centerCaption}
        </text>
      </g>
      {points.map((item) => (
        <g key={item.key} {...mark(item)}>
          <path d={wedge(item.datum.hour, OUTER)} fill="transparent" />
          <path
            d={wedge(item.datum.hour, radius(item.datum.flights))}
            fill={item.datum.hour === peakHour ? 'var(--mark-1)' : 'var(--mark-2)'}
          />
        </g>
      ))}
    </g>
  )
}
