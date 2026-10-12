import type { SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'

// Adapted from Arc UI Waffle Chart (MIT), source hash f1538515ae585da3.
// Copyright (c) 2026 Elia Kuratli; license: ../../ui/ARC-LICENSE.txt.
// Full provenance: docs/research/2026-10-08-arc-source-inventory.md.
// Arc's rounded SVG cells use caller-owned slots, units and identities, without apportionment.
export type ArcWaffleCell<T> = {
  key: string
  x: number
  y: number
  fill: string
  group?: string
  ghost?: boolean
  /** The Unknown role: `fill` becomes the outline colour on a transparent cell, with a «?» when the cell is large enough. */
  outline?: boolean
  point?: ChartPoint<T>
}
export function ArcWaffle<T>({
  cells,
  cellSize,
  gap,
  mark,
}: {
  cells: readonly ArcWaffleCell<T>[]
  cellSize: number
  gap: number
  mark?: (point: ChartPoint<T>) => SVGProps<SVGGElement>
}) {
  return (
    <>
      {cells.map((cell) => (
        <g
          key={cell.key}
          {...(cell.point ? mark?.(cell.point) : { 'aria-hidden': true as const })}
          className="arc-waffle-cell"
          data-waffle-group={cell.group}
          style={{
            transform: `translate(${cell.x * (cellSize + gap)}px, ${cell.y * (cellSize + gap)}px)`,
          }}
        >
          {cell.outline ? (
            <>
              <rect
                x={1}
                y={1}
                width={Math.max(0, cellSize - 2)}
                height={Math.max(0, cellSize - 2)}
                rx={cellSize * 0.2}
                fill="transparent"
                data-kc-outline=""
                stroke={cell.fill}
                strokeWidth={2}
              />
              {cellSize >= 14 && (
                <text
                  x={cellSize / 2}
                  y={cellSize / 2}
                  dy="0.35em"
                  textAnchor="middle"
                  fontSize={Math.min(18, Math.round(cellSize * 0.6))}
                  fontWeight={600}
                  fill="var(--text-muted)"
                  aria-hidden="true"
                >
                  ?
                </text>
              )}
            </>
          ) : (
            <rect
              width={cellSize}
              height={cellSize}
              rx={cellSize * 0.2}
              fill={cell.ghost ? 'none' : cell.fill}
              stroke={cell.ghost ? 'var(--mark-ghost)' : undefined}
              strokeWidth={cell.ghost ? 1 : undefined}
            />
          )}
        </g>
      ))}
    </>
  )
}
