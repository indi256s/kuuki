// St Kitts: Brimstone Hill. A steep conical hill (T3 hatching, T4 on its shaded side) rises from
// the shore with the compact polygonal Fort George citadel on the summit, T5 embrasures along its
// walls. Across the sea on the right stands the Nevis cone in T2. The box is the whole view; its
// bottom is the waterline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, occlude, rectPts, stroke, toneFill } from '../grid'
import { garitaA, tier } from './fort-a'
import { clipPoly, rough } from './rock-b'
import { type KitModule, num } from './util'

export const brimstoneA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const X = (u: number) => x + w * u
  const base = y + h
  const out: SvgNode[] = []
  // Nevis: a broad cone across the water, T2.
  const nevis: Pt[] = [
    [X(0.5), base],
    [X(0.62), base - h * 0.2],
    [X(0.74), base - h * 0.5],
    [X(0.84), base - h * 0.72],
    [X(0.9), base - h * 0.78],
    [X(0.94), base - h * 0.72],
    [X(0.98), base - h * 0.5],
    [X(1), base - h * 0.2],
    [X(1), base],
  ]
  out.push(
    occlude(nevis),
    ...toneFill(nevis, 'T2', { gap: 3.7 }),
    stroke('line', nevis.slice(1, -1)),
  )
  // The hill: steep sides, a small summit shoulder.
  const topY = y + h * 0.3
  const hillL: Pt[] = [
    [X(0.0), base],
    [X(0.06), base - h * 0.12],
    [X(0.12), base - h * 0.32],
    [X(0.18), base - h * 0.55],
    [X(0.23), topY + 3],
    [X(0.27), topY],
  ]
  const hillR: Pt[] = [
    [X(0.4), topY],
    [X(0.45), topY + 4],
    [X(0.5), base - h * 0.52],
    [X(0.56), base - h * 0.3],
    [X(0.64), base - h * 0.12],
    [X(0.72), base],
  ]
  const ridge = rough([...hillL, ...hillR], rand, 0.8, 6)
  const hill: Pt[] = [...ridge, [X(0.72), base], [X(0), base]]
  const cut = (yy: number) => X(0.38) + (yy - topY) * 0.2
  const dark = clipPoly(hill, ([px, py]) => px - cut(py))
  const lit = clipPoly(hill, ([px, py]) => cut(py) - px)
  out.push(
    occlude(hill),
    ...toneFill(lit, 'T3', { gap: [4.4, 3.4], ramp: [topY, base] }),
    ...toneFill(dark, 'T4', { gap: 2.2 }),
    stroke('line', ridge),
  )
  // Fort George on the summit: a compact two-tier polygonal citadel, embrasures in T5.
  const cx0 = X(0.17),
    cx1 = X(0.46)
  const t1 = tier({
    x0: cx0,
    x1: cx1,
    yb: topY + 2,
    yt: topY - 8,
    salient: 0.5,
    cap: 2.4,
    recede: 2,
  })
  out.push(...t1.nodes)
  for (let i = 0; i < 4; i++) {
    const ex = cx0 + 3 + i * 3.8
    out.push(fill(rectPts(ex, topY - 5, 1.8, 2.8)))
  }
  const t2 = tier({
    x0: X(0.26),
    x1: X(0.38),
    yb: topY - 9,
    yt: topY - 17,
    salient: 0.5,
    cap: 2.2,
    recede: 1.4,
    batter: 2,
  })
  out.push(...t2.nodes)
  out.push(fill(rectPts(X(0.3), topY - 14, 1.8, 2.6)))
  out.push(...garitaA(cx1 - 1.5, topY - 7, 0.8))
  return out
}
