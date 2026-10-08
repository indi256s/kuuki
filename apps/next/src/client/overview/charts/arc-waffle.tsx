import type { SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'

// Adapted from Arc UI Waffle Chart (MIT), source hash f1538515ae585da3.
// Copyright (c) 2026 Elia Kuratli; license: ../../ui/ARC-LICENSE.txt.
// Full provenance: docs/research/2026-10-08-arc-source-inventory.md.
// Arc's rounded SVG cells use caller-owned slots, units and identities, without apportionment.
export type ArcWaffleCell<T> = { key: string; x: number; y: number; fill: string; group?: string; ghost?: boolean; point?: ChartPoint<T> }
export function ArcWaffle<T>({ cells, cellSize, gap, mark }: { cells: readonly ArcWaffleCell<T>[]; cellSize: number; gap: number; mark?: (point: ChartPoint<T>) => SVGProps<SVGGElement> }) {
  return <>{cells.map(cell => <g key={cell.key} {...(cell.point ? mark?.(cell.point) : { 'aria-hidden': true as const })} className="arc-waffle-cell" data-waffle-group={cell.group} style={{ transform: `translate(${cell.x * (cellSize + gap)}px, ${cell.y * (cellSize + gap)}px)` }}>
    <rect width={cellSize} height={cellSize} rx={cellSize * 0.2} fill={cell.ghost ? 'none' : cell.fill} stroke={cell.ghost ? 'var(--mark-ghost)' : undefined} strokeWidth={cell.ghost ? 1 : undefined} />
  </g>)}</>
}
