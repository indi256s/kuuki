import type { CSSProperties, SVGAttributes, SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'
import { apportion, sum } from './apportion'
import { markerPath, type SlotMarker } from './comparison-slots'
import './arc-dot-ring.css'

// Original chart in the Arc donut's vocabulary: clockwise wedges from 12:00, host-owned interaction, no grouping.
// A wedge spans its share of the circle and holds its dots on concentric rings; the host (KuukiChart) owns tooltip, keyboard and table.
export type DotRingSegment<T> = {
  point: ChartPoint<T>
  /** Flights in the segment. Zero-count segments are not drawn. */
  count: number
  /** `marked` draws the slot marker in `color`, `rest` a filled neutral circle, `unknown` a 1px outline circle (never a fill). */
  kind: 'marked' | 'rest' | 'unknown'
  color: string
  marker: SlotMarker
}

const GEOMETRY = {
  full: { size: 240, pitch: 11, dot: 3.6, rings: 5 },
  sheet: { size: 168, pitch: 9, dot: 3.2, rings: 4 },
}
export type DotRingSpan = keyof typeof GEOMETRY
/** Side of the square chart. */
export const dotRingSize = (span: DotRingSpan) => GEOMETRY[span].size
/** Smallest distance between two dot centres on a ring, and the looser one used to pick how many rings a small ring needs. */
const MIN_PITCH = 9,
  COMFORT_PITCH = 14
/** Angle between two wedges. */
const GAP = 0.07
/** Room kept between the outermost dots and the edge of the chart for the wedge contour. */
const EDGE = 5
const TAU = Math.PI * 2

export type DotRingPlan = {
  span: DotRingSpan
  /** Flights per dot. */
  k: number
  /** Dots per segment, in the order of the counts given. */
  dots: number[]
  /** Ring radii, outermost first. */
  radii: number[]
  /** Angular start and end of each segment, in radians clockwise from 12:00. */
  angles: { start: number; end: number }[]
}

/**
 * Where everything goes. One dot is one flight while the flights fit the rings at the minimum dot pitch; past that one dot is
 * the smallest whole number of flights that fits, with every non-empty segment keeping a dot.
 */
export function planDotRing(counts: readonly number[], span: DotRingSpan): DotRingPlan {
  const { size, pitch, rings: most, dot } = GEOMETRY[span]
  const outer = size / 2 - dot - EDGE,
    present = counts.filter((count) => count > 0).length,
    gap = present > 1 ? GAP : 0,
    usable = TAU - present * gap,
    total = sum(counts)
  const radiiOf = (rings: number) =>
    Array.from({ length: rings }, (_, ring) => outer - ring * pitch)
  const capacity = (rings: number, spacing: number) =>
    Math.floor((sum(radiiOf(rings)) * usable) / spacing)
  let k = 1,
    dots = apportion(counts, Math.round(total), true)
  while (sum(dots) > capacity(most, MIN_PITCH) && k < total) {
    k++
    dots = apportion(counts, Math.ceil(total / k), true)
  }
  let rings = 1
  while (rings < most && capacity(rings, COMFORT_PITCH) < sum(dots)) rings++
  let at = 0
  const angles = counts.map((count) => {
    if (count <= 0) return { start: at, end: at }
    const start = at,
      end = at + (total ? (count / total) * usable : 0)
    at = end + gap
    return { start, end }
  })
  return { span, k, dots, radii: radiiOf(rings), angles }
}

const point = (radius: number, angle: number) =>
  `${radius * Math.cos(angle - Math.PI / 2)} ${radius * Math.sin(angle - Math.PI / 2)}`

/** An annular sector between two angles, or the whole annulus. */
function sector(outer: number, inner: number, start: number, end: number) {
  if (end - start >= TAU - 1e-6)
    return `M${point(outer, 0)}A${outer} ${outer} 0 1 1 ${point(outer, Math.PI)}A${outer} ${outer} 0 1 1 ${point(outer, 0)}ZM${point(inner, 0)}A${inner} ${inner} 0 1 0 ${point(inner, Math.PI)}A${inner} ${inner} 0 1 0 ${point(inner, 0)}Z`
  const large = end - start > Math.PI ? 1 : 0
  return `M${point(outer, start)}A${outer} ${outer} 0 ${large} 1 ${point(outer, end)}L${point(inner, end)}A${inner} ${inner} 0 ${large} 0 ${point(inner, start)}Z`
}

/** One dot at the origin: the slot marker in its colour, a neutral fill for the rest, a 1px outline (never a fill) for unknown. */
export function DotMark({
  kind,
  marker,
  color,
  r,
  ...props
}: Pick<DotRingSegment<unknown>, 'kind' | 'marker' | 'color'> & {
  r: number
} & SVGAttributes<SVGElement>) {
  if (kind === 'marked')
    return <path {...props} d={markerPath(marker, r)} fill={color} fillRule="evenodd" />
  if (kind === 'rest') return <circle {...props} r={r} fill="var(--brand-neutral)" />
  return (
    <circle {...props} r={r - 0.6} fill="none" stroke="var(--cat-maker-unknown)" strokeWidth={1} />
  )
}

export type ArcDotRingProps<T> = {
  segments: readonly DotRingSegment<T>[]
  plan: DotRingPlan
  mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>
  /** Wedge outlined from outside the chart, such as the legend row under the pointer. */
  highlightKey?: string | null
  /** The picked reading, drawn in the hole. */
  centre?: { value: string; label: string } | null
}

/** Inputs are confirmed counts; unavailable data is handled by the caller before mounting. */
export function ArcDotRing<T>({ segments, plan, mark, highlightKey, centre }: ArcDotRingProps<T>) {
  const { size, dot } = GEOMETRY[plan.span]
  const innermost = plan.radii[plan.radii.length - 1],
    hole = innermost - dot - 6,
    reach = dot + 3
  // 13px sans averages about 6.9px a character; the name stays inside the hole.
  const whole = plan.dots.filter((dots) => dots > 0).length === 1
  const room = Math.max(4, Math.floor((hole * 2 * 0.92) / 6.9))
  const label =
    centre && centre.label.length > room ? `${centre.label.slice(0, room - 1)}…` : centre?.label
  return (
    <g transform={`translate(${size / 2},${size / 2})`} data-span={plan.span}>
      {segments.map((segment, index) => {
        const { start, end } = plan.angles[index],
          dots = plan.dots[index]
        if (segment.count <= 0 || dots <= 0) return null
        const perRing = apportion(plan.radii, dots)
        const used = plan.radii.filter((_, ring) => perRing[ring] > 0)
        const widest = (end - start) / 2 + GAP * 0.35,
          least = (dot + 2) / Math.min(...used),
          half = Math.max(widest, least),
          middle = (start + end) / 2
        const shape = sector(
          plan.radii[0] + reach,
          innermost - reach,
          whole ? 0 : middle - half,
          whole ? TAU : middle + half,
        )
        return (
          <g
            key={segment.point.key}
            {...mark(segment.point)}
            data-highlight={segment.point.key === highlightKey || undefined}
          >
            <path d={shape} fill="transparent" />
            <g aria-hidden="true" pointerEvents="none">
              {plan.radii.flatMap((radius, ring) =>
                Array.from({ length: perRing[ring] }, (_, slot) => {
                  const angle = start + ((end - start) * (slot + 0.5)) / perRing[ring]
                  const x = radius * Math.cos(angle - Math.PI / 2),
                    y = radius * Math.sin(angle - Math.PI / 2)
                  return (
                    <DotMark
                      key={`${ring}-${slot}`}
                      kind={segment.kind}
                      marker={segment.marker}
                      color={segment.color}
                      r={dot}
                      transform={`translate(${x},${y})`}
                      data-dot=""
                      data-no-contour=""
                    />
                  )
                }),
              )}
            </g>
            <path
              className="dot-ring-contour"
              d={shape}
              fill="none"
              stroke="none"
              pointerEvents="none"
              data-kc-edge=""
              style={{ '--kc-edge-max': '2px' } as CSSProperties}
            />
          </g>
        )
      })}
      {centre ? (
        <g aria-hidden="true" pointerEvents="none" textAnchor="middle" data-span={plan.span}>
          <text className="dot-ring-value" y={-2}>
            {centre.value}
          </text>
          <text className="dot-ring-name" y={18}>
            {label}
          </text>
        </g>
      ) : null}
    </g>
  )
}
