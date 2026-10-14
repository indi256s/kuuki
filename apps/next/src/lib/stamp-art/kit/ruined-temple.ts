// Ruined Doric temple front (Parthenon type): a stepped stylobate, a row of fluted columns of
// uneven height (some broken), a collapsed stretch of entablature and a pediment with a gap in it.
// The box is the whole front; the stylobate steps sit at its foot, the pediment at the top.
import { type Pt, type SvgNode, body, hline, rectPts, vline } from '../grid'
import { type KitModule, num, nums } from './util'

export const ruinedTemple: KitModule = ([x, y, w, h], p) => {
  const count = Math.max(4, Math.round(num(p, 'count', 8)))
  const stepH = h * num(p, 'stepsH', 0.1)
  const pedH = h * num(p, 'pediment', 0.2)
  const entH = h * num(p, 'entablature', 0.1)
  const base = y + h
  const colTop = y + pedH + entH
  const colBot = base - stepH
  const out: SvgNode[] = []
  // Stylobate: three steps, each narrower than the one below.
  for (let s = 0; s < 3; s++) {
    out.push(
      ...body(rectPts(x + s * 1.6, base - (stepH * (s + 1)) / 3, w - s * 3.2, stepH / 3), 'hair'),
    )
  }
  const pitch = (w - 6) / count
  const colW = pitch * num(p, 'colW', 0.5)
  // broken[i]: fraction of the full shaft height that is left standing (1 = intact).
  const broken = nums(p, 'broken', [])
  const gapFrom = num(p, 'gapFrom', 4.2),
    gapTo = num(p, 'gapTo', 5.4)
  for (let i = 0; i < count; i++) {
    const cx = x + 3 + pitch * (i + 0.5)
    const frac = broken[i] ?? 1
    const top = colBot - (colBot - colTop) * frac
    const poly: Pt[] = [
      [cx - colW / 2, colBot],
      [cx - colW / 2 + 0.35, top],
      [cx + colW / 2 - 0.35, top],
      [cx + colW / 2, colBot],
    ]
    if (frac < 1)
      poly.splice(
        1,
        2,
        [cx - colW / 2 + 0.35, top + 2],
        [cx - colW / 6, top],
        [cx + colW / 3, top + 1.5],
        [cx + colW / 2 - 0.35, top + 3],
      )
    out.push(...body(poly, 'line'))
    out.push(vline('fine', cx - colW * 0.12, top + 3, colBot - 1))
    if (frac === 1) out.push(hline('line', cx - colW * 0.75, cx + colW * 0.75, top))
  }
  // Entablature: continuous bar with one fallen block (indices gapFrom..gapTo).
  const ex0 = x + 1,
    ex1 = x + w - 1
  const gx0 = x + 3 + pitch * gapFrom,
    gx1 = x + 3 + pitch * gapTo
  const entY = colTop - entH
  const entPoly: Pt[] = [
    [ex0, colTop],
    [ex1, colTop],
    [ex1, entY],
    [gx1 + 1, entY],
    [gx1, entY + entH * 0.45],
    [(gx0 + gx1) / 2, entY + entH * 0.2],
    [gx0, entY + entH * 0.6],
    [gx0 - 1, entY],
    [ex0, entY],
  ]
  out.push(...body(entPoly, 'line'))
  for (let tx = ex0 + 3; tx < ex1 - 2; tx += 4.5) {
    if (tx > gx0 - 1 && tx < gx1 + 1) continue
    out.push(vline('fine', tx, entY + 2, colTop - 1.2))
  }
  // Pediment: one triangle whose apex has fallen away (a notch in the raking cornice).
  const apexX = x + w / 2 + num(p, 'notchX', 6),
    apexY = y
  const ped: Pt[] = [
    [ex0, entY],
    [apexX - 10, apexY + pedH * 0.08],
    [apexX - 7, apexY + pedH * 0.22],
    [apexX - 3, apexY + pedH * 0.16],
    [apexX + 1, apexY + pedH * 0.42],
    [apexX + 6, apexY + pedH * 0.3],
    [apexX + 9, apexY + pedH * 0.48],
    [apexX + 14, apexY + pedH * 0.4],
    [ex1, entY],
  ]
  out.push(...body(ped, 'line'))
  // Tympanum: fine lines under the surviving slopes.
  for (let tx = ex0 + 4; tx < ex1 - 3; tx += 5) {
    const top = yOnPoly(ped, tx) + 3
    if (entY - top > 3) out.push(vline('fine', tx, top, entY - 1.5))
  }
  return out
}

/** Top edge of a polyline sorted by x ascending (pediment slope), linear between vertices. */
function yOnPoly(pts: Pt[], px: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i],
      b = pts[i + 1]
    if (px >= a[0] && px <= b[0]) return a[1] + ((px - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
  }
  return pts[0][1]
}
