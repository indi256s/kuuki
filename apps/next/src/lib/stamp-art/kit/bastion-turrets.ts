// Terrace of arcades with a row of conical turrets and broad steps (Fisherman's Bastion, HU).
// The box base is the foot of the steps.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  hline,
  occlude,
  rectPts,
  stroke,
} from '../grid'
import { type KitModule, num } from './util'
import { archPts } from './windows'

export const bastionTurrets: KitModule = ([x, y, w, h], p) => {
  const X = (f: number) => x + f * w
  const out: SvgNode[] = []
  const base = y + h
  const stepsH = h * num(p, 'stepsH', 0.2)
  const wallBot = base - stepsH
  const wallTop = wallBot - h * 0.27
  // upper terrace wall behind and its arcade
  out.push(...body(rectPts(X(0.04), wallTop, X(0.96) - X(0.04), wallBot - wallTop), 'line'))
  out.push(hline('bold', X(0.04) - 1, X(0.96) + 1, wallTop))
  const n = num(p, 'arches', 9)
  const pitch = (X(0.96) - X(0.04)) / n
  for (let i = 0; i < n; i++) {
    const ax = X(0.04) + i * pitch + pitch * 0.3
    out.push(fill(archPts(ax, wallTop + 6, pitch * 0.4, wallBot - wallTop - 6)))
  }
  // turrets: [fx, width, height-fraction]
  const turrets: [number, number, number][] = [
    [0.1, 0.075, 0.5],
    [0.24, 0.075, 0.58],
    [0.38, 0.075, 0.66],
    [0.5, 0.1, 0.94],
    [0.62, 0.075, 0.66],
    [0.76, 0.075, 0.58],
    [0.9, 0.075, 0.5],
  ]
  for (const [fx, fw, fh] of turrets) {
    const tw = fw * w
    const tx = X(fx) - tw / 2
    const total = (wallTop - y) * fh
    const shaftTop = wallTop - total * 0.42
    out.push(...body(rectPts(tx, shaftTop, tw, wallTop - shaftTop + 1), 'line'))
    out.push(
      ...hatchPoly(rectPts(tx + tw * 0.6, shaftTop + 1, tw * 0.4, wallTop - shaftTop), {
        angle: 90,
        gap: 2.1,
        weight: 'hair',
      }),
    )
    out.push(fill(rectPts(tx + tw * 0.28, shaftTop + 5, 1.8, 5)))
    const cap: Pt[] = [
      [tx - 1.6, shaftTop],
      [tx + tw / 2, wallTop - total],
      [tx + tw + 1.6, shaftTop],
    ]
    out.push(
      ...body(cap, 'line'),
      ...hatchPoly(cap, { angle: 90, gap: 2.6, weight: 'hair', inset: 0.5, phase: 0.2 }),
    )
  }
  // steps: courses getting narrower toward the top
  const rows = 5
  for (let i = 0; i < rows; i++) {
    const t = i / rows
    const ry = wallBot + t * stepsH
    const inset = X(0.04) - x + 0
    out.push(
      ...body(rectPts(X(0.04) - 1 - (1 - t) * 0, ry, X(0.96) - X(0.04) + 2, stepsH / rows), 'hair'),
    )
    void inset
  }
  out.push(
    stroke('bold', [
      [X(0.02), base],
      [X(0.98), base],
    ]),
  )
  return out
}
