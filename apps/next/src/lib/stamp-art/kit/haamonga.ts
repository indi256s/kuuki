// Ha'amonga 'a Maui: two thick coral-limestone uprights with a heavy lintel laid across their
// heads, seen three-quarter: lit front faces, shaded right sides, a lit top on the lintel. The box
// is the whole gate; the bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

export const haamonga: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const depth = num(p, 'depth', 8)
  const lintelH = h * num(p, 'lintel', 0.2)
  const upW = w * num(p, 'upright', 0.2)
  const lintelY = y + depth * 0.5
  const out: SvgNode[] = []
  const upright = (ux: number): void => {
    const top = lintelY + lintelH * 0.7
    const front: Pt[] = [
      [ux, base],
      [ux + 0.8, top + 2],
      [ux + upW - 0.6, top],
      [ux + upW, base],
    ]
    const side: Pt[] = [
      [ux + upW, base],
      [ux + upW - 0.6, top],
      [ux + upW + depth * 0.6, top - depth * 0.45],
      [ux + upW + depth * 0.6, base - depth * 0.45],
    ]
    out.push(...body(side, 'line'))
    out.push(...toneFill(side, 'T4', { gap: 2.2, inset: 0.2 }))
    out.push(...body(front, 'line'))
    // Bedding lines and a few stone texture ticks on the lit front.
    for (const f of [0.34, 0.58, 0.8]) {
      const yy = top + (base - top) * f
      const x0 = ux + 3 + rand() * 3
      out.push(
        stroke('fine', [
          [x0, yy],
          [x0 + upW * (0.35 + rand() * 0.3), yy + 0.8],
        ]),
      )
    }
    out.push(vline('fine', ux + upW * 0.28, top + 5, top + (base - top) * 0.4))
    out.push(vline('fine', ux + upW * 0.7, top + (base - top) * 0.5, base - 4))
  }
  const gap = w - 2 * upW - depth
  const ux0 = x
  const ux1 = x + upW + gap * 0.9
  upright(ux0)
  upright(ux1)
  // Lintel: front face, top face and right end, overhanging both uprights.
  const lx0 = x - w * 0.02
  const lx1 = ux1 + upW + depth * 0.6 - 0.5
  const front: Pt[] = [
    [lx0, lintelY],
    [lx1 - depth * 0.6, lintelY],
    [lx1 - depth * 0.6, lintelY + lintelH],
    [lx0, lintelY + lintelH],
  ]
  const topFace: Pt[] = [
    [lx0, lintelY],
    [lx0 + depth * 0.6, lintelY - depth * 0.45],
    [lx1, lintelY - depth * 0.45],
    [lx1 - depth * 0.6, lintelY],
  ]
  const end: Pt[] = [
    [lx1 - depth * 0.6, lintelY],
    [lx1, lintelY - depth * 0.45],
    [lx1, lintelY + lintelH - depth * 0.45],
    [lx1 - depth * 0.6, lintelY + lintelH],
  ]
  out.push(...body(end, 'line'), ...toneFill(end, 'T4', { gap: 2.2, inset: 0.2 }))
  out.push(...body(front, 'line'))
  out.push(...body(topFace, 'line'))

  out.push(hline('bold', lx0, lx1 - depth * 0.6, lintelY + lintelH))
  out.push(
    stroke('fine', [
      [lx0 + 6, lintelY + lintelH * 0.45],
      [lx0 + w * 0.3, lintelY + lintelH * 0.5],
    ]),
  )
  out.push(
    stroke('fine', [
      [lx0 + w * 0.5, lintelY + lintelH * 0.62],
      [lx1 - depth - 8, lintelY + lintelH * 0.58],
    ]),
  )
  out.push(
    vline('line', lx0 + (lx1 - depth * 0.6 - lx0) * 0.46, lintelY + 0.4, lintelY + lintelH - 0.4),
  )
  out.push(hline('bold', x - 6, x + w + 8, base))
  return out
}
