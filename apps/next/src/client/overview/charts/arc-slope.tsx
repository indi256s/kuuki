import type { SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'

// Adapted from Arc Slope, MIT; license: ../../ui/ARC-LICENSE.txt; hashes: docs/research/2026-10-08-arc-source-inventory.md.
// Upstream slope-chart.tsx SHA256: 84f25522305d5120df73b0455e95720b7588d4d29afe95c6f46caa969e3d7ae1.
// Keep shared-column geometry and collision-spread labels; host owns selection, touch actions, tooltip and table. Counts use a caller-supplied zero-based domain.
export type ArcSlopeRow<T> = {
  point: ChartPoint<T>
  label: string
  start: number
  end: number
  color: string
  dash?: string
}
export type ArcSlopeProps<T> = {
  rows: readonly ArcSlopeRow<T>[]
  mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>
  maxValue: number
  startLabel: string
  endLabel: string
  formatValue: (value: number) => string
  width?: number
  height?: number
  highlightKey?: string | null
}

function spread(wanted: number[], gap: number, low: number, high: number): number[] {
  const order = wanted.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y)
  let groups = order.map((entry) => ({ members: [entry], top: entry.y }))
  for (let changed = true; changed;) {
    changed = false
    const next: typeof groups = []
    for (const group of groups) {
      const prev = next[next.length - 1]
      if (prev && prev.top + prev.members.length * gap > group.top) {
        const members = [...prev.members, ...group.members]
        next[next.length - 1] = {
          members,
          top: members.reduce((sum, member, k) => sum + member.y - k * gap, 0) / members.length,
        }
        changed = true
      } else next.push(group)
    }
    groups = next.map((group) => ({
      ...group,
      top: Math.min(
        Math.max(group.top, low),
        Math.max(low, high - (group.members.length - 1) * gap),
      ),
    }))
  }
  const out = new Array<number>(wanted.length)
  groups.forEach((group) =>
    group.members.forEach((member, k) => {
      out[member.index] = group.top + k * gap
    }),
  )
  return out
}

/** Mount only with a known baseline and counts for the same stable identities in both periods. */
export function ArcSlope<T>({
  rows,
  mark,
  maxValue,
  startLabel,
  endLabel,
  formatValue,
  width = 600,
  height = 260,
  highlightKey,
}: ArcSlopeProps<T>) {
  const narrow = width < 400
  const x0 = Math.min(160, width * 0.32),
    x1 = width - Math.min(100, width * 0.2),
    top = narrow ? 48 : 36,
    bottom = height - 24
  const yOf = (value: number) => bottom - (value / Math.max(1, maxValue)) * (bottom - top)
  const gap = Math.min(20, (bottom - top) / Math.max(1, rows.length - 1))
  const left = spread(
    rows.map((row) => yOf(row.start)),
    gap,
    top,
    bottom,
  )
  const right = spread(
    rows.map((row) => yOf(row.end)),
    gap,
    top,
    bottom,
  )
  return (
    <g>
      <g aria-hidden="true" pointerEvents="none" fill="var(--text-muted)" fontSize={12}>
        {[startLabel, endLabel].map((label, index) => (
          <text key={index} x={index === 0 ? x0 : x1} y={18} textAnchor="middle">
            {narrow
              ? label.split(' ').map((word, line) => (
                  <tspan key={line} x={index === 0 ? x0 : x1} dy={line === 0 ? 0 : 16}>
                    {word}{' '}
                  </tspan>
                ))
              : label}
          </text>
        ))}
        <text x={(x0 + x1) / 2} y={height - 4} textAnchor="middle">
          0–{formatValue(maxValue)}
        </text>
      </g>
      {rows.map((row, index) => {
        const y0 = yOf(row.start),
          y1 = yOf(row.end)
        return (
          <g
            key={row.point.key}
            {...mark(row.point)}
            data-highlight={row.point.key === highlightKey || undefined}
          >
            <line x1={x0} x2={x1} y1={y0} y2={y1} stroke="transparent" strokeWidth={44} />
            <line x1={x0 - 6} x2={x0} y1={left[index]} y2={y0} stroke="var(--text-muted)" />
            <line x1={x1} x2={x1 + 6} y1={y1} y2={right[index]} stroke="var(--text-muted)" />
            <line
              x1={x0}
              x2={x1}
              y1={y0}
              y2={y1}
              stroke={row.color}
              strokeWidth={row.point.key === highlightKey ? 3 : 2}
              strokeDasharray={row.dash}
            />
            <circle cx={x0} cy={y0} r={4} fill={row.color} />
            <circle cx={x1} cy={y1} r={4} fill={row.color} />
            <text
              x={x0 - 10}
              y={left[index]}
              dy=".32em"
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize={12}
            >
              {row.label} · {formatValue(row.start)}
            </text>
            <text x={x1 + 10} y={right[index]} dy=".32em" fill="var(--text-muted)" fontSize={12}>
              {formatValue(row.end)}
            </text>
          </g>
        )
      })}
    </g>
  )
}
