// Shared helpers for the lane C building modules: window rows, arched openings and polyline lookup.
import { type Pt, type SvgNode, fill, rectPts } from '../grid'

/** Centred row of dark windows between x0 and x1 at y, `pitch` apart. */
export function windowRow(
  x0: number,
  x1: number,
  y: number,
  ww: number,
  wh: number,
  pitch: number,
): SvgNode[] {
  const n = Math.floor((x1 - x0) / pitch)
  if (n < 1) return []
  const start = x0 + (x1 - x0 - n * pitch) / 2 + (pitch - ww) / 2
  const out: SvgNode[] = []
  for (let i = 0; i < n; i++) out.push(fill(rectPts(start + i * pitch, y, ww, wh)))
  return out
}

/** Round-headed opening: a rectangle with a semicircular top, base at y + h. */
export function archPts(x: number, y: number, w: number, h: number): Pt[] {
  const r = w / 2
  const pts: Pt[] = [[x, y + h]]
  pts.push([x, y + r])
  for (let i = 1; i < 6; i++) {
    const a = Math.PI - (i / 6) * Math.PI
    pts.push([x + r + r * Math.cos(a), y + r - r * Math.sin(a)])
  }
  pts.push([x + w, y + r], [x + w, y + h])
  return pts
}

/** Linear interpolation on a polyline sorted by x ascending. */
export function lerpLine(line: Pt[], x: number): number {
  if (x <= line[0][0]) return line[0][1]
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
  }
  return line[line.length - 1][1]
}
