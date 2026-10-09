'use client'

import { useRef, type CSSProperties } from 'react'
import { useMeasuredWidth } from './use-width'

// Adapted from Arc UI Brush Chart (MIT), source hash d37c0f866336bd4a.
// Copyright (c) 2026 Elia Kuratli; license: ../../ui/ARC-LICENSE.txt.
// Full provenance: docs/research/2026-10-08-arc-source-inventory.md.
// Keep its time-scaled overview/selected window; native range handles own keyboard and touch.
export type ArcBrushProps = {
  bounds: readonly [number, number]
  value: readonly [number, number]
  onChange: (value: readonly [number, number]) => void
  onCommit: (value: readonly [number, number]) => void
  fromLabel: string
  toLabel: string
  points?: readonly { x: number; y: number }[]
  /** Viewbox width in CSS pixels; measured from the host when omitted. */
  width?: number
  height?: number
  step?: number
  /** Plot-area insets in CSS pixels (1 viewBox unit = 1px); the line, the selection and the thumbs' travel all use them. */
  inset?: { left: number; right: number }
}
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']
const day = (epoch: number) => new Date(epoch).toISOString().slice(0, 10)
export function ArcBrush({ bounds, value, onChange, onCommit, fromLabel, toLabel, points = [], width: fixedWidth, height = 80, step = 86_400_000, inset = { left: 12, right: 12 } }: ArcBrushProps) {
  const draft = useRef(value), dirty = useRef(false)
  const [root, measured] = useMeasuredWidth<HTMLDivElement>(), width = fixedWidth ?? measured
  // A completed interaction consumes its draft, so blur after key/pointer release cannot commit twice.
  const change = (index: number, next: number) => {
    const range: readonly [number, number] = index === 0 ? [Math.min(next, value[1]), value[1]] : [value[0], Math.max(next, value[0])]
    if (range[0] === value[0] && range[1] === value[1]) return
    draft.current = range; dirty.current = true; onChange(range)
  }
  const commit = () => { if (dirty.current) { dirty.current = false; onCommit(draft.current) } }
  const plot = width - inset.left - inset.right
  const x = (epoch: number) => inset.left + (epoch - bounds[0]) / (bounds[1] - bounds[0] || 1) * plot
  const max = Math.max(1, ...points.map(point => point.y))
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.x)},${height - point.y / max * height}`).join('')
  // Both inputs span the plot area, so each thumb sits on its own edge. When the pair rests in the far half, the start input is lifted so it stays grabbable.
  const startOnTop = value[0] > (bounds[0] + bounds[1]) / 2
  return <div ref={root} className="arc-brush" style={{ '--brush-left': `${inset.left}px`, '--brush-right': `${inset.right}px`, '--brush-height': `${height}px` } as CSSProperties}>
    <svg viewBox={`0 0 ${width} ${height}`} height={height} preserveAspectRatio="none" aria-hidden="true"><path d={line} fill="none" stroke="var(--mark-ghost)" strokeWidth={2} vectorEffect="non-scaling-stroke" /><rect x={x(value[0])} width={Math.max(1, x(value[1]) - x(value[0]))} height={height} fill="var(--accent)" opacity={0.12} /></svg>
    <div className="arc-brush-handles">{[fromLabel, toLabel].map((label, index) => <input key={index} type="range" aria-label={label} aria-valuetext={day(value[index])} style={{ zIndex: (index === 0) === startOnTop ? 2 : 1 }} min={bounds[0]} max={bounds[1]} step={step} value={value[index]} onChange={event => change(index, Number(event.target.value))} onPointerUp={commit} onKeyUp={event => { if (KEYS.includes(event.key)) commit() }} onBlur={commit} />)}</div>
  </div>
}
