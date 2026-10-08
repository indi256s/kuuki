'use client'

import { useRef } from 'react'

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
  width?: number
  height?: number
  step?: number
}
export function ArcBrush({ bounds, value, onChange, onCommit, fromLabel, toLabel, points = [], width = 600, height = 80, step = 86_400_000 }: ArcBrushProps) {
  const draft = useRef(value), dirty = useRef(false)
  // A completed interaction consumes its draft, so blur after key/pointer release cannot commit twice.
  const change = (index: number, next: number) => {
    const range: readonly [number, number] = index === 0 ? [Math.min(next, value[1]), value[1]] : [value[0], Math.max(next, value[0])]
    if (range[0] === value[0] && range[1] === value[1]) return
    draft.current = range; dirty.current = true; onChange(range)
  }
  const commit = () => { if (dirty.current) { dirty.current = false; onCommit(draft.current) } }
  const x = (epoch: number) => (epoch - bounds[0]) / (bounds[1] - bounds[0] || 1) * width
  const max = Math.max(1, ...points.map(point => point.y))
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.x)},${height - point.y / max * height}`).join('')
  return <div className="arc-brush">
    <svg viewBox={`0 0 ${width} ${height}`} height={height} aria-hidden="true"><path d={line} fill="none" stroke="var(--mark-ghost)" strokeWidth={2} /><rect x={x(value[0])} width={Math.max(1, x(value[1]) - x(value[0]))} height={height} fill="var(--accent)" opacity={0.12} /></svg>
    <div className="arc-brush-handles">{[fromLabel, toLabel].map((label, index) => <label key={label}><span>{label}</span><input type="range" aria-label={label} aria-valuetext={new Date(value[index]).toISOString().slice(0, 10)} min={bounds[0]} max={bounds[1]} step={step} value={value[index]} onChange={event => change(index, Number(event.target.value))} onPointerUp={commit} onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commit() }} onBlur={commit} /></label>)}</div>
  </div>
}
