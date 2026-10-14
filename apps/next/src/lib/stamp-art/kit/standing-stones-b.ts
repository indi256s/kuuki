// Wassu stone circle: tall squared laterite monoliths of uneven height standing in a ring seen from
// low. Stones are drawn back to front on an ellipse; each has a flat top, a lit left face and a
// shaded right face in T4 verticals. The box bottom is the front of the ring's ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, hatch, stroke } from '../grid'
import { type KitModule, num } from './util'

function stone(cx: number, base: number, w: number, h: number, lean: number): SvgNode[] {
  const tw = w * 0.84
  const pts: Pt[] = [
    [cx - w / 2, base],
    [cx - tw / 2 + lean, base - h + 3],
    [cx - tw / 4 + lean, base - h],
    [cx + tw / 4 + lean, base - h + 0.6],
    [cx + tw / 2 + lean, base - h + 3],
    [cx + w / 2, base],
  ]
  const out = body(pts, 'line')
  const split = cx + w * 0.16
  const shade: Pt[] = [
    [split, base],
    [split + lean * 0.9, base - h + 1],
    [cx + tw / 2 + lean - 0.4, base - h + 1],
    [cx + w / 2 - 0.4, base],
  ]
  out.push(...hatch(shade, 'v', 2.3, 'hair', 0.4))
  out.push(stroke('hair', [pts[1], pts[2]]))
  out.push(hline('hair', cx - w * 0.3, cx - w * 0.05, base - h * 0.62))
  out.push(hline('fine', cx - w * 0.3, cx - w * 0.1, base - h * 0.3))
  return out
}

export const standingStonesB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const count = Math.round(num(p, 'count', 14))
  const rx = w * 0.46
  const ry = h * 0.17
  const cx = x + w / 2
  const cy = y + h - ry - 3
  const list: { px: number; py: number; t: number }[] = []
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + 0.15
    list.push({ px: cx + Math.cos(a) * rx, py: cy + Math.sin(a) * ry, t: (Math.sin(a) + 1) / 2 })
  }
  list.sort((a, b) => a.py - b.py)
  const out: SvgNode[] = []
  for (const s of list) {
    const k = 0.62 + 0.38 * s.t
    const sh = h * 0.72 * k * (0.78 + rand() * 0.3)
    out.push(...stone(s.px, s.py, sh * 0.35, sh, (rand() - 0.5) * 3.4 * k))
  }
  return out
}
