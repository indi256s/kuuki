// Citadelle Laferriere (Haiti): a ship-shaped fortress on a forested summit, prow to the viewer's
// left. The hull's stem leans out over the slope; its lit prow face is paper with course lines,
// the long flank on the right is T4 with rows of T5 gun ports, a set-back second tier carries a
// crenellated parapet and a square tower. The mountain below is T3 forest. The box is mountain
// plus fortress; its bottom is the foot of the mountain.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { canopyNodes } from './mass-b'
import { clipPoly, rough } from './rock-b'
import { type KitModule, num } from './util'

export const citadelle: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 2)))
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const base = y + h
  const out: SvgNode[] = []
  // Forest mountain under the fortress, T3 with crowns along the slopes.
  const mt: Pt[] = rough(
    [
      [X(0.04), base],
      [X(0.07), Y(0.9)],
      [X(0.16), Y(0.8)],
      [X(0.3), Y(0.7)],
      [X(0.4), Y(0.62)],
      [X(0.7), Y(0.6)],
      [X(0.82), Y(0.7)],
      [X(0.94), Y(0.84)],
      [X(0.96), base],
    ],
    rand,
    0.9,
    6,
  )
  const cut = (yy: number) => X(0.6) + (yy - Y(0.6)) * 0.25
  const dark = clipPoly(mt, ([px, py]) => px - cut(py))
  const lit = clipPoly(mt, ([px, py]) => cut(py) - px)
  out.push(
    occlude(mt),
    ...toneFill(lit, 'T3', { angle: 64, gap: 3.4, weight: 'hair' }),
    ...toneFill(dark, 'T4', { gap: 2.5 }),
  )
  out.push(stroke('line', mt.slice(0, -1)))
  for (const [u0, u1, v] of [
    [0.08, 0.28, 0.9],
    [0.2, 0.4, 0.76],
  ])
    out.push(...canopyNodes(X(u0), X(u1), Y(v), 6, rand, { crowns: 2, thr: 0.3 }))
  // Hull: stem leaning out to the prow tip, flat top, lit prow face and shaded flank.
  const foot = Y(0.6)
  const tip: Pt = [X(0.1), Y(0.38)]
  const keel: Pt = [X(0.27), foot]
  const sal = X(0.5)
  const topR = Y(0.33)
  const prow: Pt[] = [tip, [sal, Y(0.35)], [sal, foot - 0.4], keel]
  const flank: Pt[] = [
    [sal, Y(0.35)],
    [X(0.96), topR],
    [X(0.96), foot],
    [sal, foot - 0.4],
  ]
  out.push(...body(prow, 'line'))
  const sh = (v: number): Pt => [
    X(0.72),
    Y(0.35) + (topR - Y(0.35)) * ((0.72 - 0.5) / 0.46) + (v - Y(0.35)) * 0,
  ]
  out.push(...body(flank, 'line'))
  out.push(
    ...toneFill([sh(0), [X(0.96), topR], [X(0.96), foot], [X(0.72), foot - 0.4]], 'T4', {
      gap: 2.3,
      inset: 0.3,
    }),
  )
  // Course lines follow the stem on the lit prow.
  for (let i = 1; i < 5; i++) {
    const t = i / 5
    const a: Pt = [tip[0] + (keel[0] - tip[0]) * t, tip[1] + (keel[1] - tip[1]) * t]
    const b: Pt = [sal, Y(0.35) + (foot - Y(0.35)) * t]
    out.push(
      stroke('fine', [
        [a[0] + 1.2, a[1]],
        [b[0] - 1, b[1]],
      ]),
    )
  }
  // Gun ports: a row on the prow, two along the flank.
  for (const v of [0.45, 0.53]) {
    const py = Y(v)
    for (const u of [0.3, 0.38, 0.45])
      out.push(fill(rectPts(X(u) - (v > 0.5 ? 0 : 1.5), py, 3, 3.2)))
  }
  for (const v of [0.41, 0.5]) {
    const py = Y(v)
    for (let u = 0.55; u < 0.94; u += 0.07) out.push(fill(rectPts(X(u), py, 3.2, 3.4)))
  }
  out.push(
    stroke('bold', [
      [X(0.22), foot],
      [X(0.98), foot],
    ]),
  )
  // Second tier set back: lit wall, crenellated parapet, ports.
  const t2x0 = X(0.4),
    t2x1 = X(0.9)
  const t2Top = Y(0.12),
    t2Foot = Y(0.34)
  const merlons = 9
  const pitch = (t2x1 - t2x0) / merlons
  const crown: Pt[] = [[t2x0, t2Foot]]
  for (let i = 0; i < merlons; i++) {
    const a = t2x0 + pitch * i
    crown.push(
      [a, t2Top],
      [a + pitch * 0.58, t2Top],
      [a + pitch * 0.58, t2Top + 2.6],
      [a + pitch, t2Top + 2.6],
    )
  }
  crown.push([t2x1, t2Foot])
  out.push(...body(crown, 'line'))
  const shade2 = rectPts(X(0.7), t2Top + 3.4, t2x1 - X(0.7), t2Foot - t2Top - 3.4)
  out.push(...toneFill(shade2, 'T4', { gap: 2.3, inset: 0.3 }))
  for (let u = 0.44; u < 0.68; u += 0.065) out.push(fill(rectPts(X(u), Y(0.21), 2.8, 3.2)))
  out.push(hline('bold', t2x0 - 1, t2x1 + 1, t2Foot))
  // Square tower with a flat cap at the stern.
  const tw = w * 0.1,
    tx = X(0.66)
  out.push(...body(rectPts(tx, y + 2, tw, t2Top - y + 0.6), 'line'))
  out.push(...body(rectPts(tx - 1.5, y + 0.4, tw + 3, 2.6), 'line'))
  out.push(fill(rectPts(tx + tw / 2 - 1.2, y + 6, 2.4, 4.4)))
  return out
}
