// Ship's anchor standing upright (lane A, `-a` until consolidated): a solid black anchor with a ring
// at the head, a stock across the shank, and a crown of two curved arms ending in flukes. The box is
// the anchor; its bottom is the ground. Drawn as solid fills with a halo against whatever is behind.
import { type Pt, type SvgNode, fill, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'

/** A ribbon along a centre line with half-widths w0 -> w1. */
function ribbon(c: Pt[], w0: number, w1: number): Pt[] {
  const l: Pt[] = [],
    r: Pt[] = []
  c.forEach((pt, i) => {
    const a = c[Math.max(0, i - 1)],
      b = c[Math.min(c.length - 1, i + 1)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
    const hw = w0 + ((w1 - w0) * i) / (c.length - 1)
    l.push([pt[0] + nx * hw, pt[1] + ny * hw])
    r.push([pt[0] - nx * hw, pt[1] - ny * hw])
  })
  return [...l, ...r.reverse()]
}

export const anchorA: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const base = y + h
  const shank = num(p, 'shank', 2.8)
  const out: SvgNode[] = []
  const parts: Pt[][] = []
  const ringR = h * 0.07
  const ring: Pt[] = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2
    return [cx + Math.cos(a) * ringR * 1.2, y + ringR + Math.sin(a) * ringR] as Pt
  })
  const ringIn: Pt[] = ring.map(([px, py]) => [
    cx + (px - cx) * 0.55,
    y + ringR + (py - y - ringR) * 0.5,
  ])
  const shankTop = y + ringR * 2 - 1
  const crownY = base - h * 0.1
  parts.push(
    ribbon(
      [
        [cx, shankTop],
        [cx, crownY],
      ],
      shank * 0.8,
      shank * 1.15,
    ),
  )
  // Stock: a bar across the upper shank with knobs.
  const stockY = y + h * 0.22
  const sw = w * 0.4
  parts.push([
    [cx - sw, stockY - 2.1],
    [cx + sw, stockY - 2.1],
    [cx + sw, stockY + 2.1],
    [cx - sw, stockY + 2.1],
  ])
  for (const s of [-1, 1]) {
    parts.push(
      ribbon(
        [
          [cx + s * sw, stockY - 4],
          [cx + s * sw, stockY + 4],
        ],
        2.6,
        2.6,
      ),
    )
  }
  // Arms: a bow from the crown up and out to the flukes.
  const armTop = y + h * 0.66
  for (const s of [-1, 1]) {
    const c: Pt[] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const ang = Math.PI * 0.5 + s * t * Math.PI * 0.62
      c.push([
        cx + s * Math.sin(t * Math.PI * 0.62) * w * 0.44,
        crownY -
          h * 0.02 -
          (1 - Math.cos(t * Math.PI * 0.62)) * (crownY - armTop) * 1.1 +
          (ang ? 0 : 0),
      ])
    }
    parts.push(ribbon(c, shank * 1.05, shank * 0.8))
    const [tx, ty] = c[c.length - 1]
    // Fluke: a leaf pointing up and outward at the arm tip.
    parts.push([
      [tx - s * 2.6, ty + 3.2],
      [tx + s * 5.2, ty - 2.2],
      [tx + s * 2.4, ty - 8.5],
      [tx - s * 4.5, ty - 2.5],
    ])
  }
  // Crown block at the foot of the shank.
  parts.push([
    [cx - shank * 1.5, crownY - 4],
    [cx + shank * 1.5, crownY - 4],
    [cx + shank * 1.1, base],
    [cx - shank * 1.1, base],
  ])
  for (const pts of parts) out.push(occlude(pts, { halo: 1.6 }), fill(pts))
  out.push(occlude(ring, { halo: 1.6 }), stroke('line', ring, true), stroke('hair', ringIn, true))
  return out
}
