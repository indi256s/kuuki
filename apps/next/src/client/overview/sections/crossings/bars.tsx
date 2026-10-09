import type { SVGProps } from 'react'
import type { ChartPoint } from '../../charts/kuuki-chart'

export type ShiftYear = {
  key: string
  year: number
  forward: number
  back: number
  flights: number
}
type Props = {
  points: readonly ChartPoint<ShiftYear>[]
  /** Unscoped years in baseline order: they define the columns, the zero axis scale and the ghost outlines. */
  ghosts: readonly ShiftYear[]
  height: number
  /** SVG width in CSS pixels, from `barsWidth`. */
  width: number
  format: (value: number) => string
  mark: (point: ChartPoint<ShiftYear>) => SVGProps<SVGGElement>
}

export const BAR_MARGIN = { top: 20, bottom: 30 }
// One band per year: it grows with the card up to BAND_MAX and stops at BAND_MIN (the host scrolls instead), so few years never smear across a wide card.
const BAND_MIN = 36,
  BAND_MAX = 64
/** Natural SVG width for `years` bands inside `available` pixels. */
export const barsWidth = (years: number, available: number) =>
  Math.max(1, years) * Math.min(BAND_MAX, Math.max(BAND_MIN, available / Math.max(1, years)))
// Forward shifts rise above the zero axis, back shifts hang below it; both share one scale sized from the unscoped maxima.
export function CrossingBars({ points, ghosts, height, width, format, mark }: Props) {
  const plot = height - BAR_MARGIN.top - BAR_MARGIN.bottom
  const up = Math.max(1, ...ghosts.map((row) => row.forward)) * 1.3,
    down = Math.max(1, ...ghosts.map((row) => row.back)) * 1.3
  const zero = BAR_MARGIN.top + (plot * up) / (up + down),
    unit = plot / (up + down)
  const column = width / Math.max(1, ghosts.length)
  const edge = (i: number) => ({ x: i * column + column * 0.18, w: column * 0.64 })
  const byYear = new Map(points.map((item) => [item.datum.year, item]))
  return (
    <g>
      <g aria-hidden="true" pointerEvents="none">
        {ghosts.map((row, i) => {
          const { x, w } = edge(i)
          return (
            <g key={row.key} fill="none" stroke="var(--mark-ghost)" strokeWidth={1}>
              {row.forward > 0 && (
                <rect
                  x={x}
                  y={zero - row.forward * unit}
                  width={w}
                  height={row.forward * unit}
                  rx={3}
                />
              )}
              {row.back > 0 && <rect x={x} y={zero} width={w} height={row.back * unit} rx={3} />}
            </g>
          )
        })}
        <line x1={0} x2={width} y1={zero} y2={zero} stroke="var(--mark-ghost)" strokeWidth={1} />
      </g>
      {ghosts.map((base, i) => {
        const item = byYear.get(base.year),
          row = item?.datum ?? { ...base, forward: 0, back: 0, flights: 0 },
          { x, w } = edge(i),
          mid = x + w / 2
        const body = (
          <>
            <rect x={i * column} y={0} width={column} height={height} fill="transparent" />
            {row.forward > 0 && (
              <rect
                x={x}
                y={zero - row.forward * unit}
                width={w}
                height={row.forward * unit}
                rx={3}
                fill="var(--mark-1)"
              />
            )}
            {row.back > 0 && (
              <rect x={x} y={zero} width={w} height={row.back * unit} rx={3} fill="var(--mark-2)" />
            )}
            {(row.flights === 0 || row.forward > 0) && (
              <text
                x={mid}
                y={zero - row.forward * unit - 8}
                textAnchor="middle"
                fontSize={12}
                fill="var(--text)"
                aria-hidden="true"
              >
                {row.flights === 0 ? '–' : `+${format(row.forward)}`}
              </text>
            )}
            {row.back > 0 && (
              <text
                x={mid}
                y={zero + row.back * unit + 14}
                textAnchor="middle"
                fontSize={12}
                fill="var(--text)"
                aria-hidden="true"
              >{`−${format(row.back)}`}</text>
            )}
          </>
        )
        return (
          <g key={base.key}>
            {item ? <g {...mark(item)}>{body}</g> : <g>{body}</g>}
            <text
              x={mid}
              y={height - BAR_MARGIN.bottom + 20}
              textAnchor="middle"
              fontSize={12}
              fill="var(--text-muted)"
              aria-hidden="true"
            >
              {base.year}
            </text>
          </g>
        )
      })}
    </g>
  )
}
