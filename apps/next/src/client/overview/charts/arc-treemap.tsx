import type { SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'

// Adapted from Arc UI Treemap (MIT), source SHA256 80615b9948ab7e5e066c4d666b983dfb02da8f2a630e682eeab24485dc81751e.
// Copyright (c) 2026 Elia Kuratli; license: ../../ui/ARC-LICENSE.txt.
// Full provenance: docs/research/2026-10-08-arc-source-inventory.md.
type Rect = { x: number; y: number; w: number; h: number }

function squarify(items: { id: string; value: number }[], rect: Rect, out: Map<string, Rect>) {
  const list = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  const total = list.reduce((sum, item) => sum + item.value, 0)
  if (!total || rect.w <= 0 || rect.h <= 0) {
    for (const item of items) out.set(item.id, { x: rect.x, y: rect.y, w: 0, h: 0 })
    return
  }
  const scale = (rect.w * rect.h) / total
  let { x, y, w, h } = rect,
    i = 0
  const worst = (row: number[], side: number) => {
    const sum = row.reduce((a, b) => a + b, 0),
      max = Math.max(...row),
      min = Math.min(...row)
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
  }
  while (i < list.length) {
    const side = Math.min(w, h),
      row: number[] = [list[i]!.value * scale]
    let j = i + 1
    while (j < list.length) {
      const next = [...row, list[j]!.value * scale]
      if (worst(next, side) > worst(row, side)) break
      row.push(list[j]!.value * scale)
      j++
    }
    const sum = row.reduce((a, b) => a + b, 0)
    if (w >= h) {
      const cw = sum / h
      let cy = y
      for (let k = i; k < j; k++) {
        const th = (list[k]!.value * scale) / cw
        out.set(list[k]!.id, { x, y: cy, w: cw, h: th })
        cy += th
      }
      x += cw
      w -= cw
    } else {
      const rh = sum / w
      let cx = x
      for (let k = i; k < j; k++) {
        const tw = (list[k]!.value * scale) / rh
        out.set(list[k]!.id, { x: cx, y, w: tw, h: rh })
        cx += tw
      }
      y += rh
      h -= rh
    }
    i = j
  }
  for (const item of items)
    if (!out.has(item.id)) out.set(item.id, { x: rect.x, y: rect.y, w: 0, h: 0 })
}

export function ArcTreemap<T extends { value: number }>({
  points,
  height,
  width = 600,
  mark,
}: {
  points: readonly ChartPoint<T>[]
  height: number
  width?: number
  mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>
}) {
  const rects = new Map<string, Rect>()
  squarify(
    points.map((point) => ({ id: point.key, value: point.datum.value })),
    { x: 0, y: 0, w: width, h: height },
    rects,
  )
  return (
    <>
      {points.map((point) => {
        const rect = rects.get(point.key)!
        return (
          <g key={point.key} {...mark(point)}>
            <rect
              x={rect.x + 2}
              y={rect.y + 2}
              width={Math.max(0, rect.w - 4)}
              height={Math.max(0, rect.h - 4)}
              rx={4}
              fill="var(--mark-1)"
            />
            {rect.w > 70 && rect.h > 40 && (
              <text
                x={rect.x + 10}
                y={rect.y + 24}
                fill="var(--accent-foreground)"
                aria-hidden="true"
              >
                {point.label.length > Math.floor((rect.w - 20) / 8)
                  ? `${point.label.slice(0, Math.max(1, Math.floor((rect.w - 20) / 8) - 1))}…`
                  : point.label}
              </text>
            )}
          </g>
        )
      })}
    </>
  )
}
