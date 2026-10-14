// Dominica: the Boiling Lake seen at eye level from the near lip of the crater. Rules for craters:
// a near rim (solid), a far inner wall in T4 with a lit far rim and a forest crown on top, and the
// water as a low T1 band between them. One steam column rises off the lake as hatching with no
// contour, its lit edge eroded and drifting right. No ellipses. The box is the whole view; its top
// is the top of the steam and its bottom the bottom of the near lip.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hatch, occlude, stroke, toneFill } from '../grid'
import { canopyNodes, hatchMass } from './mass-b'
import { clipPoly } from './rock-b'
import { type KitModule, num } from './util'

/** A steam column: base to top, drifting right, widening as it rises, hatched not outlined. */
export function steamColumn(
  cx: number,
  baseY: number,
  topY: number,
  w0: number,
  w1: number,
  drift: number,
  rand: () => number,
): SvgNode[] {
  const n = 18
  const ph = rand() * 6
  const L: Pt[] = [],
    R: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = baseY + (topY - baseY) * t
    const c = cx + drift * t ** 1.2 + 5 * Math.sin(t * 4 + ph) * t
    const hw = (w0 + (w1 - w0) * Math.sin(t * 1.5) ** 0.7) / 2
    L.push([c - hw * (1 + 0.22 * Math.sin(t * 9 + ph)), y])
    R.push([c + hw * (1 + 0.26 * Math.sin(t * 7 + ph * 2)), y])
  }
  const poly: Pt[] = [...L, ...R.reverse()]
  return [
    occlude(poly, { halo: 1.8 }),
    ...hatchMass(poly, rand, { angle: -28, gap: 2.1, weight: 'fine', thr: 0.44, wx: 0.8, wy: 0.7 }),
  ]
}

export const craterEyeA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const out: SvgNode[] = []
  const shoreY = Y(0.66)
  // Far inner wall: shoulders at both sides with a dip between, low where it meets the frame.
  const shape = (t: number) =>
    0.46 -
    0.1 * Math.exp(-(((t - 0.2) / 0.16) ** 2)) -
    0.08 * Math.exp(-(((t - 0.8) / 0.18) ** 2)) +
    0.03 * Math.sin(t * 19)
  const ridge: Pt[] = []
  const N = 26
  for (let i = 0; i <= N; i++) {
    const t = i / N
    ridge.push([X(t), Y(shape(t)) + (rand() - 0.5) * 1.2])
  }
  const wall: Pt[] = [...ridge, [X(1), shoreY], [X(0), shoreY]]
  // Light from the left: the left shoulder is lit forest (open T2), the right is T4 in shade.
  const cut = (yy: number) => X(0.46) + (yy - Y(0.45)) * 0.35
  const dark = clipPoly(wall, ([px, py]) => px - cut(py))
  const lit = clipPoly(wall, ([px, py]) => cut(py) - px)
  out.push(
    occlude(wall),
    ...toneFill(lit, 'T2', { gap: 3.4 }),
    ...toneFill(dark, 'T4', { gap: 2.2, angle: 66 }),
    stroke('line', ridge),
  )
  // Forest crown on the far rim, following the ridge.
  for (let i = 0; i < 7; i++) {
    const a = X(i / 7),
      b = X((i + 1) / 7 + 0.015)
    const ys = ridge.filter(([px]) => px >= a && px <= b).map(([, py]) => py)
    out.push(...canopyNodes(a, b, Math.min(...ys) + 5.5, 8, rand, { crowns: 2, thr: 0.4 }))
  }
  // The lake: a T1 band, far shore as a hair line.
  const lake: Pt[] = [
    [X(0), shoreY],
    [X(1), shoreY],
    [X(1), Y(0.74)],
    [X(0.95), Y(0.84)],
    [X(0.05), Y(0.84)],
    [X(0), Y(0.74)],
  ]
  out.push(occlude(lake), ...hatch(lake, 'h', 3.0, 'fine'))
  out.push(
    stroke('hair', [
      [X(0), shoreY],
      [X(0.3), shoreY + 0.6],
      [X(0.62), shoreY - 0.4],
      [X(1), shoreY],
    ]),
  )
  // Steam rising off the water, one column drifting right.
  out.push(...steamColumn(X(0.4), shoreY + 7, Y(0.04), 13, 30, w * 0.15, rand))
  // Near lip: solid, ragged, a rock shoulder on the left falling away to the right.
  const lip: Pt[] = [
    [X(0.15), Y(0.96)],
    [X(0.012), Y(0.8)],
  ]
  for (let i = 0; i <= 22; i++) {
    const t = 0.06 + (0.88 * i) / 22
    const v = 0.8 + 0.08 * Math.min(1, t * 1.6) + 0.03 * Math.sin(t * 11 + 1) - 0.05 * t ** 3
    lip.push([X(t), Y(v) + (rand() - 0.5) * 1.8])
  }
  lip.push([X(0.988), Y(0.8)], [X(0.85), Y(0.96)])
  // A fill only: solid ink hides the hatching under it, and it stays out of the lit-interior count.
  out.push(fill(lip))
  return out
}
