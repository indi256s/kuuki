// Monaco: a row of moored yachts and sailboats seen from the quay. Solid hulls, white cabins, thin
// masts with stays. The box bottom is the waterline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke, vline } from '../grid'
import { type KitModule, num } from './util'

export const boatsC: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const n = Math.max(2, Math.round(num(p, 'count', 6)))
  const out: SvgNode[] = []
  const pitch = w / n
  const water = y + h
  for (let i = 0; i < n; i++) {
    const bw = pitch * (0.92 + rand() * 0.2)
    const bx = x + i * pitch + (pitch - bw) / 2
    const hullH = num(p, 'hullH', 3.4) + rand() * 1.2
    const hull: Pt[] = [
      [bx, water - hullH],
      [bx + bw, water - hullH - 0.8],
      [bx + bw - 3, water],
      [bx + 2.5, water],
    ]
    const sail = rand() > 0.35
    if (sail) {
      const mh = h * (0.55 + rand() * 0.4)
      const mx = bx + bw * (0.38 + rand() * 0.2)
      out.push(
        stroke('hair', [
          [mx, water - hullH],
          [mx, water - hullH - mh],
        ]),
      )
      out.push(
        stroke('fine', [
          [mx, water - hullH - mh],
          [bx + 1, water - hullH],
        ]),
      )
      out.push(
        stroke('fine', [
          [mx, water - hullH - mh],
          [bx + bw - 1, water - hullH - 0.8],
        ]),
      )
      const jib: Pt[] = [
        [mx + 1, water - hullH - mh * 0.92],
        [mx + 1, water - hullH - 1.5],
        [bx + bw - 3, water - hullH - 1.5],
      ]
      out.push(occlude(jib), stroke('hair', jib, true))
    } else {
      const ch = hullH + 2.8
      out.push(...body(rectPts(bx + bw * 0.22, water - hullH - 2.8, bw * 0.5, 2.8), 'hair'))
      out.push(fill(rectPts(bx + bw * 0.3, water - hullH - 1.9, bw * 0.34, 1)))
      out.push(vline('hair', bx + bw * 0.46, water - ch - 6, water - ch))
    }
    out.push(occlude(hull), fill(hull))
  }
  return out
}
