// I-Kiribati maneaba, the open meeting house (lane A, `-a` until consolidated). Part `lagoon` is a
// backdrop strip of calm water behind the house. Part `house` is the subject: a steep thatched roof
// with eaves nearly to the ground (roof is about three quarters of the height), thatch courses and a
// ragged eave, and an open side of stout coral posts with a dark T5 interior between them. The box
// bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatchPoly, hline, quad, rectPts, stroke } from '../grid'
import { type KitModule, num, str } from './util'

export const maneabaA: KitModule = ([x, y, w, h], p) => {
  const part = str(p, 'part', ['lagoon', 'house'] as const, 'house')
  if (part === 'lagoon') {
    const top = num(p, 'top', y + h * 0.5)
    const hz = num(p, 'horizonY', y + h * 0.72)
    return hatchPoly(rectPts(x, top, w, hz - top), { angle: 0, gap: [3, 3.6], weight: 'fine' })
  }
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const out: SvgNode[] = []
  const ground = y + h
  const eaveY = y + h * 0.78
  const ridgeY = y
  const cx = x + w / 2
  const ridgeHalf = w * 0.2
  // Roof: concave steep sides, ridge flat, ragged eave.
  const left = quad(
    [x, eaveY],
    [cx - ridgeHalf - w * 0.02, eaveY - (eaveY - ridgeY) * 0.62],
    [cx - ridgeHalf, ridgeY],
    12,
  )
  const right = quad(
    [cx + ridgeHalf, ridgeY],
    [cx + ridgeHalf + w * 0.02, eaveY - (eaveY - ridgeY) * 0.62],
    [x + w, eaveY],
    12,
  )
  const eave: Pt[] = []
  const n = Math.round(w / 3.4)
  for (let i = 0; i <= n; i++)
    eave.push([x + w - (w * i) / n, eaveY + (i % 2 ? 2.4 : 0) + (rand() - 0.5) * 0.8])
  const roof: Pt[] = [...left, ...right, ...eave]
  // Interior and posts go in first; the roof overlaps their tops.
  const floorY = ground - 2
  out.push(...body(rectPts(x + w * 0.05, eaveY - 2, w * 0.9, floorY - eaveY + 2), 'hair'))
  const posts = Math.max(5, Math.round(num(p, 'posts', 7)))
  for (let i = 0; i < posts; i++) {
    const px = x + w * 0.05 + 2 + ((w * 0.9 - 10) * i) / (posts - 1)
    out.push(...body(rectPts(px, eaveY + 1, 6.4, floorY - eaveY - 0.5), 'line'))
    if (i + 1 < posts) {
      const nx = x + w * 0.05 + 2 + ((w * 0.9 - 10) * (i + 1)) / (posts - 1)
      out.push(fill(rectPts(px + 6.4, eaveY + 2, nx - px - 6.4, floorY - eaveY - 3)))
    }
  }
  out.push(...body(roof, 'line'))
  out.push(
    stroke('bold', [
      [x - 2, floorY + 1],
      [x + w + 2, floorY + 1],
    ]),
  )
  // Thatch courses: broken fine lines running parallel to the eave, shorter toward the ridge.
  for (let yy = eaveY - 5; yy > ridgeY + 5; yy -= 4.6) {
    const t = (eaveY - yy) / (eaveY - ridgeY)
    const lo = x + w * 0.02 + (cx - ridgeHalf - x) * Math.pow(t, 1.1) * 0.95
    const hi = x + w * 0.98 - (x + w - cx - ridgeHalf) * Math.pow(t, 1.1) * 0.95
    let px = lo + 2 + rand() * 4
    while (px < hi - 2) {
      const len = 6 + rand() * 12
      out.push(
        stroke('fine', [
          [px, yy],
          [Math.min(hi - 1.5, px + len), yy + 0.5],
        ]),
      )
      px += len + 3 + rand() * 5
    }
  }
  // Shaded right flank of the roof: T4 verticals above the eave.
  const flank: Pt[] = [...right, [x + w - 1.5, eaveY - 1], [x + w * 0.74, eaveY - 1]]
  out.push(...hatchPoly(flank, { angle: 90, gap: 2.6, weight: 'hair', inset: 0.4 }))
  // Ridge cap.
  out.push(
    stroke('bold', [
      [cx - ridgeHalf - 1, ridgeY],
      [cx + ridgeHalf + 1, ridgeY],
    ]),
  )
  out.push(hline('hair', cx - ridgeHalf * 0.7, cx + ridgeHalf * 0.7, ridgeY + 3.4))
  return out
}
