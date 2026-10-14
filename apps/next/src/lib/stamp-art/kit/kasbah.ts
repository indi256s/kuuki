// Ait Benhaddou type ksar: three rows of clay blocks climbing a slope to tall crenellated corner
// towers. Rows are drawn back to front, each block tapering a little, lit on the left, shaded on the
// right third in fine vertical hatching, with a few dark openings. The box bottom is the foot row.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

function block(
  x: number,
  base: number,
  w: number,
  h: number,
  merlons: number,
  tall: boolean,
): SvgNode[] {
  const top = base - h
  const tw = w * 0.9
  const l = x + (w - tw) / 2
  const mw = tw / (2 * merlons - 1)
  const pts: Pt[] = [
    [x, base],
    [l, top + 2],
  ]
  for (let k = 0; k < merlons; k++) {
    pts.push([l + 2 * k * mw, top], [l + (2 * k + 1) * mw, top])
    if (k < merlons - 1) pts.push([l + (2 * k + 1) * mw, top + 2], [l + (2 * k + 2) * mw, top + 2])
  }
  pts.push([l + tw, top + 2], [x + w, base])
  const out = body(pts, 'line')
  out.push(
    ...toneFill(rectPts(x + w * 0.66, top + 3, w * 0.34, h - 3), 'T4', {
      gap: 1.7,
      weight: 'fine',
    }),
  )
  out.push(hline('hair', x, x + w, base))
  const ww = 1.8
  const rows = tall ? 3 : 1
  for (let i = 0; i < rows; i++) {
    out.push(fill(rectPts(x + w * 0.24, top + 5 + (i * (h - 8)) / rows, ww, 3.2)))
  }
  if (tall)
    out.push(
      stroke('hair', [
        [l + 1, top + h * 0.2],
        [l + tw - 1, top + h * 0.2],
      ]),
    )
  return out
}

export const kasbah: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  const out: SvgNode[] = []
  const rows = [
    { lift: 22, n: 5, hMin: 14, hMax: 22, x0: 0.3 },
    { lift: 11, n: 6, hMin: 12, hMax: 18, x0: 0.12 },
    { lift: 0, n: 7, hMin: 9, hMax: 14, x0: 0 },
  ]
  for (const [ri, r] of rows.entries()) {
    const bw = (w * (1 - r.x0)) / r.n
    for (let i = 0; i < r.n; i++) {
      const bx = x + w * r.x0 + bw * i + rand() * 1.2
      const bh = r.hMin + rand() * (r.hMax - r.hMin)
      const tower =
        (ri === 0 && (i === r.n - 1 || i === 1)) || (ri === 2 && (i === 0 || i === r.n - 1))
      const th = tower ? bh * (ri === 0 ? 2.1 : 1.7) : bh
      out.push(...block(bx, base - r.lift, bw - 0.8, th, tower ? 3 : 2, tower))
    }
  }
  return out
}
