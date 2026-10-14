// Norfolk Island pine (lane A, motif-specific): a straight trunk under regular whorls of short
// horizontal branches. Each tier is a flat, slightly upturned wedge with a scalloped underside in
// dark hatching, tiers widening evenly toward the foot, a bare trunk below the lowest one and a
// short leader on top. The box is the tree (ground at its bottom).
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const araucariaA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const tiers = Math.max(4, Math.round(num(p, 'tiers', 8)))
  const bare = h * num(p, 'bare', 0.2)
  const cx = x + w / 2
  const crownTop = y + h * 0.07
  const crownBot = y + h - bare
  const pitch = (crownBot - crownTop) / tiers
  const out: SvgNode[] = []
  // Trunk, drawn first so the tiers overlap it.
  const tw = Math.max(2.4, w * 0.06)
  out.push(
    stroke('line', [
      [cx - tw / 2, y + h],
      [cx - (tw / 2) * 0.5, crownTop],
    ]),
    stroke('line', [
      [cx + tw / 2, y + h],
      [cx + (tw / 2) * 0.5, crownTop],
    ]),
    stroke('bold', [
      [cx, crownTop],
      [cx, y + 1],
    ]),
  )
  out.push(hline('bold', cx - w * 0.25, cx + w * 0.25, y + h))
  // Tiers from the top (narrow, small) to the foot (wide), later tiers overlap earlier ones.
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1)
    const half = (w / 2) * (0.22 + 0.78 * Math.pow(f, 0.92)) * (0.96 + rand() * 0.08)
    const ty = crownTop + pitch * i + pitch * 0.15
    const th = pitch * 1.05
    const up = pitch * 0.18
    const pts: Pt[] = []
    // Upper edge: from the left tip up to the trunk and down to the right tip.
    pts.push([cx - half, ty + th * 0.55 - up], [cx - half * 0.5, ty + th * 0.18], [cx, ty])
    pts.push([cx + half * 0.5, ty + th * 0.18], [cx + half, ty + th * 0.55 - up])
    // Scalloped underside, right to left.
    const n = Math.max(3, Math.round(half / 4.2))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const px = cx + half - 2 * half * t
      pts.push([px, ty + th * (0.9 + (k % 2 ? 0.1 : -0.02)) - up * Math.abs(1 - 2 * t)])
    }
    out.push(occlude(pts), stroke('hair', pts, true))
    const under: Pt[] = [
      [cx - half * 0.9, ty + th * 0.55],
      [cx + half * 0.9, ty + th * 0.55],
      [cx + half * 0.8, ty + th * 0.92],
      [cx - half * 0.8, ty + th * 0.92],
    ]
    out.push(...toneFill(under, 'T4', { angle: 90, gap: 2.4, weight: 'fine', inset: 0.5 }))
  }
  return out
}
