import type { SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'

// Adapted from Arc "ridgeline" (uiarc.dev, MIT, see ../../ui/ARC-LICENSE.txt). Upstream files, SHA256 as fetched 2026-10-08:
//   ridgeline.tsx        82048bc381bc1755030fad27b0a4c0a97a0fe87913f507d27aaf75cb75c226ae
//   ridgeline.module.css 5f05deb648fea914e894ee3c3025c987c19bef4d0b1eeeb30c0ce63210edefa9
// Kept from upstream: stacked rows with a shared baseline per row, a filled ridge with a line on top, and the quartile band + median as the row summary.
// Removed: raw-value input, Gaussian KDE with Silverman bandwidth, the spring morph, pointer/keyboard handling, tooltip, tint scale, and the figure
// wrapper. The densities come in already sampled (see sections/fleet/helpers.ts ridgeProfile), so nothing is recomputed or reconstructed here.
// Only SVG geometry is emitted: the host owns the <g> props (focus, actions, labels) through `mark`, plus the tooltip and the data table.

/** One density sample: `x` is the actual value (minutes), `height` is relative to the row, 0 to 1. */
export type ArcRidgeSample = { x: number; height: number }
export type ArcRidgeRow<T> = {
  key: string
  label: string
  profile: readonly ArcRidgeSample[]
  /** Unscoped baseline drawn behind every row as a thin outline. */
  ghost?: readonly ArcRidgeSample[]
  /** Summary statistics in the same unit as `profile[].x`. Missing ones (sparse rows) are not drawn. */
  min?: number
  q1?: number
  median?: number
  q3?: number
  max?: number
  /** A Kuuki colour token reference, e.g. `var(--cat-maker-airbus)`. */
  color?: string
  /** Leaves one empty slot above this row, as the Fleet narrowbody/widebody split does. */
  gapBefore?: boolean
  /** Rows without a point are scope-hidden: only their label and `ghost` outline are drawn, with no focus or actions. */
  point?: ChartPoint<T>
  /** Per-sample points, ascending by `x`. Each gets a transparent midpoint strip over the ridge instead of one row-wide target; takes precedence over `point`. */
  samplePoints?: readonly { x: number; point: ChartPoint<T> }[]
}
export type ArcRidgelineProps<T> = {
  rows: readonly ArcRidgeRow<T>[]
  mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>
  width?: number
  height?: number
  rowHeight?: number
  /** Labels the fixed axis ticks (minutes). */
  formatTick?: (minutes: number) => string
}

// Fixed log domain and margins of the Fleet chart this replaces.
const LOW = Math.log(30), HIGH = Math.log(1020)
const TICKS = [60, 120, 240, 480, 960]
const MARGIN = { left: 120, right: 12, top: 36, bottom: 30 }
const PADDING = 0.8, OVERLAP = 1.1
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const num = (value: number) => value.toFixed(2)

export function ArcRidgeline<T>({ rows, mark, width = 600, height, rowHeight = 42, formatTick = minutes => `${minutes / 60}h` }: ArcRidgelineProps<T>) {
  const slots = rows.reduce((count, row, i) => count + (row.gapBefore && i > 0 ? 2 : 1), 0)
  const total = height ?? Math.max(200, slots * rowHeight + MARGIN.top + MARGIN.bottom)
  // Same spacing as a d3 point scale with padding 0.8: slots sit one step apart, with 0.8 step before the first and after the last.
  const step = (total - MARGIN.top - MARGIN.bottom) / (Math.max(1, slots - 1) + 2 * PADDING)
  const plotWidth = Math.max(40, width - MARGIN.left - MARGIN.right)
  const xOf = (minutes: number) => MARGIN.left + (clamp(Math.log(minutes), LOW, HIGH) - LOW) / (HIGH - LOW) * plotWidth
  const lift = OVERLAP * step

  const trace = (profile: readonly ArcRidgeSample[], base: number) => profile
    .filter(sample => Number.isFinite(sample.x) && sample.x > 0 && Number.isFinite(sample.height))
    .map(sample => [xOf(sample.x), base - clamp(sample.height, 0, 1) * lift] as const)
  const open = (points: readonly (readonly [number, number])[]) => points.length ? `M${points.map(([x, y]) => `${num(x)},${num(y)}`).join('L')}` : ''
  const closed = (points: readonly (readonly [number, number])[], base: number) => points.length ? `${open(points)}L${num(points[points.length - 1]![0])},${num(base)}L${num(points[0]![0])},${num(base)}Z` : ''

  let slot = 0
  const placed = rows.map((row, i) => {
    if (row.gapBefore && i > 0) slot += 1
    return { row, base: MARGIN.top + (PADDING + slot++) * step }
  })

  return <g>
    <g aria-hidden="true" pointerEvents="none">
      {placed.map(({ row, base }) => row.ghost && <path key={row.key} d={open(trace(row.ghost, base))} fill="none" stroke="var(--mark-ghost)" strokeWidth={1} strokeLinejoin="round" />)}
    </g>
    {placed.map(({ row, base }) => {
      if (!row.point && !row.samplePoints?.length) return <text key={row.key} x={MARGIN.left - 8} y={base} dy="0.32em" textAnchor="end" fontSize={13} fill="var(--text-muted)" aria-hidden="true">{row.label}</text>
      const points = trace(row.profile, base), color = row.color ?? 'var(--accent)'
      const { min, q1, median, q3, max } = row, band = base + 6
      const samples = (row.samplePoints ?? []).filter(sample => Number.isFinite(sample.x) && sample.x > 0)
      const visual = <>
        <path d={closed(points, base)} fill={color} fillOpacity={0.18} stroke="none" />
        <path d={open(points)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {min !== undefined && max !== undefined && <line x1={xOf(min)} x2={xOf(max)} y1={band} y2={band} stroke="var(--text-muted)" strokeWidth={1} />}
        {q1 !== undefined && q3 !== undefined && <rect x={xOf(q1)} y={band - 2} width={Math.max(1, xOf(q3) - xOf(q1))} height={4} rx={1} fill={color} fillOpacity={0.5} />}
        {median !== undefined && <line x1={xOf(median)} x2={xOf(median)} y1={band - 4} y2={band + 4} stroke="var(--text)" strokeWidth={1.5} strokeLinecap="round" />}
        <text x={MARGIN.left - 8} y={base} dy="0.32em" textAnchor="end" fontSize={13} fill="var(--text-muted)">{row.label}</text>
      </>
      if (samples.length) {
        // Voronoi-style strips: each sample owns the span up to the midpoint with its neighbours. Flat siblings, never nested interactive groups.
        const edges = samples.map(sample => xOf(sample.x))
        return <g key={row.key}>
          <g aria-hidden="true" pointerEvents="none">{visual}</g>
          {samples.map((sample, i) => {
            const from = i === 0 ? edges[0]! : (edges[i - 1]! + edges[i]!) / 2, to = i === samples.length - 1 ? edges[i]! : (edges[i]! + edges[i + 1]!) / 2
            return <g key={sample.point.key} {...mark(sample.point)}><rect x={from} y={base - 32} width={Math.max(1, to - from)} height={44} fill="transparent" /></g>
          })}
        </g>
      }
      return <g key={row.key} {...mark(row.point!)}>
        <rect x={0} y={base - 32} width={width} height={44} fill="transparent" />
        {visual}
      </g>
    })}
    <g aria-hidden="true" pointerEvents="none">
      {TICKS.map(minutes => <text key={minutes} x={xOf(minutes)} y={total - MARGIN.bottom + 20} textAnchor="middle" fontSize={12} fill="var(--text-muted)">{formatTick(minutes)}</text>)}
    </g>
  </g>
}
