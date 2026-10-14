// Wallis and Futuna: Talietumu, the fortified royal platform. Three battered basalt tiers step up,
// the lowest swelling in the middle and tapering at both ends so its ramparts seem to curve away
// from the viewer. Lit faces carry stone joints (staggered ticks between courses), the right of
// each tier is T4, tops are lit strips. Palms stand around it as separate layers. The box is the
// platform; its bottom is the ground under the middle of the lowest tier.
import { type Pt, type SvgNode, body, hline, quad, stroke, toneFill } from '../grid'
import { clipPoly } from './rock-b'
import { type KitModule, num } from './util'

/** Stone courses and staggered joints inside a lit face, clipped to its polygon rows. */
function joints(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  rowH: number,
  shift: number,
): SvgNode[] {
  const out: SvgNode[] = []
  let k = 0
  for (let yy = y0 + rowH; yy < y1 - 0.5; yy += rowH, k++) {
    out.push(
      stroke('fine', [
        [x0, yy],
        [x1, yy],
      ]),
    )
    const step = 8.4
    for (let xx = x0 + ((k % 2) * step) / 2 + shift; xx < x1 - 1; xx += step) {
      if (xx > x0 + 1)
        out.push(
          stroke('fine', [
            [xx, yy - rowH],
            [xx, yy],
          ]),
        )
    }
  }
  return out
}

export const talietumuA: KitModule = ([x, y, w, h], p) => {
  const X = (u: number) => x + w * u
  const base = y + h
  const out: SvgNode[] = []
  const shadeAt = num(p, 'shade', 0.78)
  // Lowest tier: a lens, thick in the middle, thin at the curving ends.
  const lensTop = base - h * 0.34
  const edge = 5
  const bottom = quad([X(0), base - edge], [X(0.5), base + edge * 0.6], [X(1), base - edge], 16)
  const lens: Pt[] = [
    [X(0.01), lensTop + 4],
    [X(0.5), lensTop],
    [X(0.99), lensTop + 4],
    ...bottom.slice().reverse(),
  ]
  out.push(...body(lens, 'line'))
  out.push(...joints(X(0.03), X(0.97), lensTop + 1, base - 2, 3.8, 0))
  const dark1 = clipPoly(lens, ([px]) => px - X(shadeAt + 0.14))
  out.push(...toneFill(dark1, 'T4', { gap: 2.2, inset: 0.3 }))
  out.push(hline('bold', X(0.02), X(0.98), lensTop + 1.5))
  // Upper tiers: battered trapezoids with joints, shaded right, bold ledge at the foot.
  const tiers: [number, number, number, number][] = [
    [0.15, 0.85, lensTop, lensTop - h * 0.26],
    [0.3, 0.7, lensTop - h * 0.26, lensTop - h * 0.5],
  ]
  for (const [ua, ub, yb, yt] of tiers) {
    const bat = 2.6
    const poly: Pt[] = [
      [X(ua), yb],
      [X(ua) + bat, yt],
      [X(ub) - bat, yt],
      [X(ub), yb],
    ]
    out.push(...body(poly, 'line'))
    out.push(...joints(X(ua) + 1, X(ub) - 1, yt, yb, 3.8, 1.5))
    out.push(
      ...toneFill(
        clipPoly(poly, ([px]) => px - (X(ua) + (X(ub) - X(ua)) * shadeAt)),
        'T4',
        { gap: 2.2, inset: 0.3 },
      ),
    )
    out.push(hline('bold', X(ua) - 1, X(ub) + 1, yb))
  }
  // Top strip: the lit upper terrace edge.
  const yt = lensTop - h * 0.5
  out.push(hline('bold', X(0.3) + 1, X(0.7) - 1, yt))
  return out
}
