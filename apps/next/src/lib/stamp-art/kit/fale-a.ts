// Samoan fale tele, the oval meeting house (lane A rebuild). A low oval thatch roof: a lit dome
// with broken courses above a steeper skirt of vertical thatch that ends in a ragged eave, over a
// ring of posts with a dark T5 interior showing between them, on a T4 stone platform. The box
// bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatchPoly, rectPts, stroke } from '../grid'
import { type KitModule, num } from './util'

export const faleA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const out: SvgNode[] = []
  const ground = y + h
  const platH = h * 0.12
  const postH = h * 0.24
  const platY = ground - platH
  const eaveY = platY - postH
  const roofH = eaveY - y
  const cx = x + w / 2
  const a = w * 0.5
  const prof = (u: number, k: number) =>
    eaveY - roofH * k * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.5)), 1 / 2.5)
  // Platform: T4 stone with one course line.
  const plat = rectPts(x + w * 0.04, platY, w * 0.92, platH)
  out.push(...body(plat, 'line'))
  out.push(...hatchPoly(plat, { angle: 90, gap: 2.4, weight: 'hair', inset: 0.2 }))
  out.push(
    stroke('bold', [
      [x, ground],
      [x + w, ground],
    ]),
  )
  // Interior and posts.
  const inner = rectPts(x + w * 0.1, eaveY - 2, w * 0.8, postH + 2)
  out.push(...body(inner, 'hair'))
  const posts = Math.max(6, Math.round(num(p, 'posts', 9)))
  for (let i = 0; i < posts; i++) {
    const px = x + w * 0.1 + 1 + ((w * 0.8 - 6) * i) / (posts - 1)
    out.push(...body(rectPts(px, eaveY + 0.5, 4, postH - 0.5), 'line'))
    if (i + 1 < posts) {
      const nx = x + w * 0.1 + 1 + ((w * 0.8 - 6) * (i + 1)) / (posts - 1)
      out.push(fill(rectPts(px + 4, eaveY + 1, nx - px - 4, postH - 1)))
    }
  }
  // Roof outline: dome across the top, skirt vertical on the ends, ragged eave underneath.
  const dome: Pt[] = []
  for (let i = 0; i <= 28; i++) {
    const u = -1 + (2 * i) / 28
    dome.push([cx + a * u, prof(u, 1)])
  }
  const eave: Pt[] = []
  const n = Math.round((2 * a) / 3.2)
  for (let i = 0; i <= n; i++)
    eave.push([cx + a - (2 * a * i) / n, eaveY + 1.2 + (i % 2 ? 2.6 : 0) + (rand() - 0.5) * 0.8])
  const roof: Pt[] = [...dome, ...eave]
  out.push(...body(roof, 'line'))
  // Skirt: vertical thatch (hair) in the lower 30% of the roof, stopping at the skirt line.
  const skirtK = 0.3
  const skirtTop: Pt[] = []
  for (let i = 0; i <= 28; i++) {
    const u = -1 + (2 * i) / 28
    skirtTop.push([cx + a * u, eaveY - roofH * skirtK * (1 - 0.35 * Math.abs(u))])
  }
  out.push(
    ...hatchPoly([...skirtTop, [cx + a, eaveY - 0.8], [cx - a, eaveY - 0.8]], {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
      inset: 0.2,
    }),
  )
  out.push(stroke('hair', skirtTop))
  // Dome: broken courses following the roof curve.
  for (const k of [0.8, 0.6, 0.4]) {
    let u = -0.82 + rand() * 0.1
    while (u < 0.8) {
      const len = 0.18 + rand() * 0.22
      const seg: Pt[] = []
      for (let s = 0; s <= 5; s++) {
        const uu = Math.min(0.85, u + (len * s) / 5)
        seg.push([cx + a * uu, prof(uu, k * 0.98 + 0.02)])
      }
      out.push(stroke('fine', seg))
      u += len + 0.07 + rand() * 0.1
    }
  }
  return out
}
