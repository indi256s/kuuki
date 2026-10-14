// Pico Cao Grande: a slim, slightly bent volcanic needle (lit left face, fluted T4 right face)
// whose foot is veiled by a T1 mist band and buried in a full-width rainforest canopy of hatched
// masses with no contour. The box bottom is the canopy base.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hatch, occlude, quad, stroke, toneFill } from '../grid'
import { canopyNodes } from './mass-b'
import { type KitModule, num } from './util'

export const caoGrandeB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const base = y + h
  const cx0 = x + w * num(p, 'axis', 0.42)
  const footW = w * num(p, 'footW', 0.13)
  const topW = footW * 0.36
  const bend = num(p, 'bend', 5)
  const mistY = y + h * num(p, 'mist', 0.62)
  const top = y
  const N = 14
  const L: Pt[] = [],
    R: Pt[] = [],
    M: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N // 0 top, 1 foot
    const half = (topW + (footW - topW) * t ** 2.3) / 2
    const c = cx0 + bend * (1 - t) ** 1.4 * Math.sin(1 + t * 0.4)
    const yy = top + 3 + (base - top - 3) * t
    L.push([c - half + (rand() - 0.5) * 0.5, yy])
    R.push([c + half + (rand() - 0.5) * 0.5, yy])
    M.push([c, yy])
  }
  const crown = quad(L[0], [M[0][0], top - 1.5], R[0], 8)
  const spire: Pt[] = [...L.slice().reverse(), ...crown.slice(1), ...R.slice(1)]
  const out: SvgNode[] = [occlude(spire, { halo: 2.4 })]
  out.push(stroke('line', spire.slice(0, -1)))
  // Shaded right face: vertical fluting only on this side.
  const sh: Pt[] = [[M[0][0] + 0.8, top + 3], ...R, [M[N][0] + footW * 0.1, base]]
  out.push(...toneFill(sh, 'T4', { angle: 88, gap: 2.7, weight: 'fine', inset: 0.5 }))
  // A few flutes on the lit face.
  for (const f of [0.22, 0.5]) {
    const a = 0.08 + rand() * 0.1
    out.push(
      stroke('fine', [
        [L[0][0] + (R[0][0] - L[0][0]) * f, top + 10 + a * h * 0.4],
        [L[N - 2][0] + (R[N - 2][0] - L[N - 2][0]) * f * 0.9, mistY - 6 - rand() * 6],
      ]),
    )
  }
  // Mist band: a ragged paper strip with sparse fine lines, veiling the needle's foot.
  const bandTop = mistY - 5,
    bandBot = mistY + 5
  const rag = (yy: number): Pt[] =>
    Array.from({ length: 22 }, (_, i): Pt => [x + (w * i) / 21, yy + (rand() - 0.5) * 3])
  const band: Pt[] = [...rag(bandTop), ...rag(bandBot).reverse()]
  out.push(occlude(band, { halo: 0.5 }))
  for (const row of hatch(band, 'h', 3, 'fine', 3, 0.4)) {
    if (row.kind !== 'stroke') continue
    const [a, b] = row.pts
    let cx = a[0] + rand() * 4
    while (cx < b[0] - 4) {
      const e = Math.min(b[0], cx + 8 + rand() * 22)
      out.push(
        stroke('fine', [
          [cx, a[1]],
          [e, a[1]],
        ]),
      )
      cx = e + 3 + rand() * 6
    }
  }
  // Rainforest canopy across the whole width, buried over the foot.
  const ch = h * num(p, 'canopy', 0.3)
  out.push(...canopyNodes(x, x + w, base, ch, rand, { crowns: Math.round(w / 13), thr: 0.22 }))
  return out
}
