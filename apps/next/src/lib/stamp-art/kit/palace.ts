// Austria: a long baroque palace front (Schoenbrunn) and the free-standing arcade crowning the
// hill behind it (Gloriette). Lit walls, T5 mansard slates and window rows; no outline on windows.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'
import { archPts, windowRow } from './windows'

const slate = (pts: Pt[]): SvgNode[] => [occlude(pts), fill(pts), stroke('hair', pts, true)]

/** Palace front: low wings under a slate band, raised end pavilions, a central block with pediment. */
export const palace: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const cw = w * num(p, 'centreW', 0.3)
  const pw = w * num(p, 'pavilionW', 0.14)
  const cx = x + w / 2
  const wingTop = y + h * num(p, 'wingTop', 0.42)
  const roofH = h * 0.09
  const pavTop = y + h * 0.3
  const centreTop = y + h * 0.2
  const pedH = h * 0.16
  const rows = [0.5, 0.78]
  out.push(...body(rectPts(x, wingTop, w, y + h - wingTop), 'line'))
  out.push(
    ...slate([
      [x, wingTop + roofH],
      [x + 3, wingTop],
      [x + w - 3, wingTop],
      [x + w, wingTop + roofH],
    ]),
  )
  const wins = (a: number, b: number, top: number) => {
    for (const r of rows) {
      const wy = top + (y + h - top) * (r - 0.2) - 2
      if (wy > top + 2) out.push(...windowRow(a + 2, b - 2, wy, 3, 5, 7.4))
    }
  }
  wins(x + pw, cx - cw / 2, wingTop + roofH)
  wins(cx + cw / 2, x + w - pw, wingTop + roofH)
  for (const px of [x, x + w - pw]) {
    out.push(...body(rectPts(px, pavTop, pw, y + h - pavTop), 'line'))
    out.push(
      ...slate([
        [px - 1.2, pavTop + roofH * 0.7],
        [px + 2, pavTop - 4],
        [px + pw - 2, pavTop - 4],
        [px + pw + 1.2, pavTop + roofH * 0.7],
      ]),
    )
    wins(px, px + pw, pavTop + roofH * 0.7)
  }
  out.push(...body(rectPts(cx - cw / 2, centreTop, cw, y + h - centreTop), 'line'))
  const ped: Pt[] = [
    [cx - cw / 2 - 1.5, centreTop],
    [cx, centreTop - pedH],
    [cx + cw / 2 + 1.5, centreTop],
  ]
  out.push(...body(ped, 'line'), ...toneFill(ped, 'T4', { gap: 2.2, weight: 'fine', inset: 1.4 }))
  wins(cx - cw / 2, cx + cw / 2, centreTop)
  out.push(fill(archPts(cx - 3, y + h - 11, 6, 11)))
  out.push(hline('bold', x, x + w, y + h - 0.2))
  return out
}

/** Gloriette: a long arcade between two end pavilions with a raised central bay and pediment. */
export const gloriette: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const n = Math.max(3, Math.round(num(p, 'arches', 7)))
  const cx = x + w / 2
  const baseY = y + h
  const topY = y + h * 0.42
  const endW = w * 0.14
  out.push(...body(rectPts(x, topY, w, baseY - topY), 'line'))
  out.push(hline('bold', x - 1, x + w + 1, topY))
  const span = w - 2 * endW
  const pitch = span / n
  for (let i = 0; i < n; i++) {
    const aw = pitch * 0.62
    out.push(
      fill(
        archPts(
          x + endW + i * pitch + (pitch - aw) / 2,
          topY + h * 0.14,
          aw,
          baseY - topY - h * 0.14,
        ),
      ),
    )
  }
  for (const ex of [x, x + w - endW]) {
    out.push(...body(rectPts(ex, y + h * 0.28, endW, baseY - y - h * 0.28), 'line'))
    out.push(
      ...toneFill(rectPts(ex + endW * 0.25, y + h * 0.46, endW * 0.5, h * 0.4), 'T4', {
        gap: 1.8,
        weight: 'fine',
      }),
    )
  }
  const cw = w * 0.26
  out.push(...body(rectPts(cx - cw / 2, y + h * 0.2, cw, topY - y - h * 0.2), 'line'))
  const ped: Pt[] = [
    [cx - cw / 2 - 1, y + h * 0.2],
    [cx, y],
    [cx + cw / 2 + 1, y + h * 0.2],
  ]
  out.push(...body(ped, 'line'), ...toneFill(ped, 'T4', { gap: 2, weight: 'fine', inset: 1.2 }))
  return out
}
