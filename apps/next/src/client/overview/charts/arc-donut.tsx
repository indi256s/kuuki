import { useId, type CSSProperties, type SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'

// Adapted from Arc Donut, MIT; license: ../../ui/ARC-LICENSE.txt; hashes: docs/research/2026-10-08-arc-source-inventory.md.
// Upstream donut-chart.tsx SHA256: 82e5d96b8f69bd2ea5153af9f09427c5bee54513f3de52c0d5cf9377d98a9bf8.
// Retain clockwise annular sectors; omit grouping, gaps and rounding so small identities keep their exact shares. The host owns interaction and tables.
// Sectors are separated by a surface-colored edge stroke clipped to the sector itself, so angles and radii stay exact; it thins on tiny sectors, which keep at least half of their width. The interactive outline (chart-theme.css) never grows past that same width.
export type ArcDonutRow<T> = { point: ChartPoint<T>; value: number; color: string }
export type ArcDonutProps<T> = {
  rows: readonly ArcDonutRow<T>[]
  mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>
  width?: number
  height?: number
  totalLabel: string
  formatValue: (value: number) => string
  /** Sector outlined from outside the chart, such as the legend row under the pointer. */
  highlightKey?: string | null
}
const SEPARATOR = 0.75

function sector(outer: number, inner: number, start: number, end: number) {
  if (end <= start) return ''
  const at = (radius: number, turn: number) =>
    `${radius * Math.cos(turn * Math.PI * 2 - Math.PI / 2)} ${radius * Math.sin(turn * Math.PI * 2 - Math.PI / 2)}`
  if (end - start >= 1)
    return `M${at(outer, 0)}A${outer} ${outer} 0 1 1 ${at(outer, 0.5)}A${outer} ${outer} 0 1 1 ${at(outer, 0)}ZM${at(inner, 0)}A${inner} ${inner} 0 1 0 ${at(inner, 0.5)}A${inner} ${inner} 0 1 0 ${at(inner, 0)}Z`
  const large = end - start > 0.5 ? 1 : 0
  return `M${at(outer, start)}A${outer} ${outer} 0 ${large} 1 ${at(outer, end)}L${at(inner, end)}A${inner} ${inner} 0 ${large} 0 ${at(inner, start)}Z`
}

/** Inputs are confirmed counts; unavailable data is handled by the caller before mounting. */
export function ArcDonut<T>({
  rows,
  mark,
  width = 240,
  height = 240,
  totalLabel,
  formatValue,
  highlightKey,
}: ArcDonutProps<T>) {
  const clips = useId()
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const outer = Math.min(width, height) / 2 - 12,
    inner = outer - 24
  let at = 0
  const placed: { row: ArcDonutRow<T>; path: string; band: number }[] = []
  for (const row of rows) {
    const start = at
    at += total ? row.value / total : 0
    // Visible separator per side: 0.75px, less on a sector narrower than 3px (measured on its middle arc).
    const arc = (at - start) * Math.PI * (outer + inner)
    placed.push({
      row,
      path: sector(outer, inner, start, at),
      band: Math.min(SEPARATOR, arc / 4),
    })
  }
  return (
    <g transform={`translate(${width / 2},${height / 2})`} data-empty={total === 0 || undefined}>
      {total === 0 && (
        <circle
          r={(inner + outer) / 2}
          fill="none"
          stroke="var(--surface-inset)"
          strokeWidth={24}
          aria-hidden="true"
        />
      )}
      {placed.map(({ row, path, band }, index) => (
        <g
          key={row.point.key}
          {...mark(row.point)}
          data-highlight={row.point.key === highlightKey || undefined}
        >
          {path ? (
            <clipPath id={`${clips}-${index}`}>
              <path d={path} />
            </clipPath>
          ) : null}
          <path d={path} fill={row.color} data-no-contour="" />
          {path ? (
            <path
              d={path}
              fill="none"
              stroke="var(--surface)"
              strokeWidth={placed.length > 1 ? band * 2 : 0}
              style={
                placed.length > 1
                  ? ({ '--kc-edge-max': `${band * 2}px` } as CSSProperties)
                  : undefined
              }
              clipPath={`url(#${clips}-${index})`}
              data-kc-edge=""
            />
          ) : null}
        </g>
      ))}
      <g aria-hidden="true" pointerEvents="none" textAnchor="middle">
        <text y={-6} fill="var(--text-muted)" fontSize={13}>
          {totalLabel}
        </text>
        <text y={20} fill="var(--text)" fontSize={22}>
          {formatValue(total)}
        </text>
      </g>
    </g>
  )
}
