import type { SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'

// Adapted from Arc UI Line Chart (MIT), source hash 1276d1375167311c.
// Copyright (c) 2026 Elia Kuratli; license: ../../ui/ARC-LICENSE.txt.
// Full provenance: docs/research/2026-10-08-arc-source-inventory.md.
// Keep Arc's SVG line/area composition; use real numeric time rather than index spacing.
export type ArcLinePoint<T> = ChartPoint<T> & { x: number; y: number }
export type ArcLineProps<T> = {
  points: readonly ArcLinePoint<T>[]
  ghost?: readonly { x: number; y: number }[]
  xDomain: readonly [number, number]
  yDomain: readonly [number, number]
  height: number
  width?: number
  stepAfter?: boolean
  area?: boolean
  mark?: (point: ChartPoint<T>) => SVGProps<SVGGElement>
}
export function ArcLine<T>({
  points,
  ghost,
  xDomain,
  yDomain,
  height,
  width = 600,
  stepAfter = false,
  area = false,
  mark,
}: ArcLineProps<T>) {
  const x = (value: number) => ((value - xDomain[0]) / (xDomain[1] - xDomain[0] || 1)) * width
  const y = (value: number) =>
    height - ((value - yDomain[0]) / (yDomain[1] - yDomain[0] || 1)) * height
  const path = (values: readonly { x: number; y: number }[]) =>
    values
      .map(
        (point, index) =>
          `${index ? (stepAfter ? `H${x(point.x)}V` : 'L') : 'M'}${index && stepAfter ? y(point.y) : `${x(point.x)},${y(point.y)}`}`,
      )
      .join('')
  const line = path(points)
  return (
    <>
      {ghost?.length ? (
        <path
          d={path(ghost)}
          fill="none"
          stroke="var(--mark-ghost)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        />
      ) : null}
      {area && points.length > 0 ? (
        <path
          d={`${line}L${x(points[points.length - 1].x)},${height}L${x(points[0].x)},${height}Z`}
          fill="var(--kc-chart-1)"
          opacity={0.12}
          aria-hidden="true"
        />
      ) : null}
      <path
        d={line}
        fill="none"
        stroke="var(--kc-chart-1)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        aria-hidden="true"
      />
      {points.map((point) => (
        <g key={point.key} {...mark?.(point)}>
          <circle cx={x(point.x)} cy={y(point.y)} r={22} fill="transparent" />
          <circle cx={x(point.x)} cy={y(point.y)} r={3} fill="var(--kc-chart-1)" />
        </g>
      ))}
    </>
  )
}
