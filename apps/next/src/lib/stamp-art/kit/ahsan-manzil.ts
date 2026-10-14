// Ahsan Manzil (Bangladesh): the riverfront palace in Dhaka. Long arcaded wings under a flat
// cornice, a taller central block with a columned first-floor porch, twin stairs climbing from the
// quay to that porch, and an octagonal drum under a ribbed dome with a finial. The box is the whole
// palace; its bottom is the ground (the quay).
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'
import { archPts } from './windows'

export const ahsanManzil: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const wingTop = y + h * num(p, 'wingTop', 0.6)
  const mid = wingTop + (base - wingTop) * 0.5
  // Wings: two floors of arches under a flat cornice and parapet.
  out.push(...body(rectPts(x, wingTop, w, base - wingTop), 'line'))
  out.push(hline('bold', x - 1, x + w + 1, wingTop))
  out.push(hline('hair', x, x + w, mid))
  out.push(hline('hair', x, x + w, wingTop + 3))
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const ax = cx + s * (w * 0.33 + k * w * 0.06) - w * 0.016
      const aw = w * 0.028
      out.push(fill(archPts(ax, wingTop + 5, aw, mid - wingTop - 6)))
      out.push(fill(archPts(ax, mid + 2, aw, base - mid - 2)))
    }
  }
  // Central block.
  const bw = w * 0.38
  const blockTop = y + h * 0.4
  out.push(...body(rectPts(cx - bw / 2, blockTop, bw, base - blockTop), 'line'))
  out.push(hline('bold', cx - bw / 2 - 1.4, cx + bw / 2 + 1.4, blockTop))
  const landing = base - h * 0.26
  // Porch columns on the first floor.
  const cols = 5
  const colX = (i: number) => cx - bw * 0.42 + (bw * 0.84 * i) / (cols - 1)
  for (let i = 0; i < cols - 1; i++)
    out.push(fill(rectPts(colX(i) + 2.6, blockTop + 6, colX(i + 1) - colX(i) - 5.2, 6)))
  for (let i = 0; i < cols; i++)
    out.push(
      stroke('hair', [
        [colX(i), blockTop + 2],
        [colX(i), landing],
      ]),
    )
  out.push(hline('hair', cx - bw / 2, cx + bw / 2, blockTop + 4))
  out.push(hline('bold', cx - bw * 0.5, cx + bw * 0.5, landing))
  // Ground floor of the block: three arches.
  for (let k = -1; k <= 1; k++) {
    const aw = bw * 0.16
    out.push(fill(archPts(cx + k * bw * 0.3 - aw / 2, landing + 4, aw, base - landing - 4)))
  }
  // Twin stairs from the quay to the porch.
  for (const s of [-1, 1]) {
    const stair: Pt[] = [
      [cx + s * w * 0.3, base],
      [cx + s * bw * 0.5, landing],
      [cx + s * bw * 0.5, base],
    ]
    out.push(...body(stair, 'line'))
    for (let k = 1; k < 4; k++) {
      const f = k / 4
      const sx0 = cx + s * (w * 0.3 + (bw * 0.5 - w * 0.3) * f)
      out.push(
        stroke('hair', [
          [sx0, base - (base - landing) * f + 1.6],
          [sx0, base - 0.5],
        ]),
      )
    }
    out.push(
      stroke('bold', [
        [cx + s * w * 0.3, base - 1],
        [cx + s * bw * 0.5, landing - 1],
      ]),
    )
  }
  // Drum and dome.
  const dw = w * 0.2
  const drumTop = blockTop - h * 0.08
  out.push(...body(rectPts(cx - dw / 2, drumTop, dw, blockTop - drumTop + 0.5), 'line'))
  for (let k = -1; k <= 1; k++)
    out.push(fill(rectPts(cx + k * dw * 0.28 - 0.9, drumTop + 2.6, 1.8, blockTop - drumTop - 4)))
  out.push(hline('bold', cx - dw / 2 - 1.2, cx + dw / 2 + 1.2, drumTop))
  const rx = dw * 0.54
  const ry = h * 0.2
  const arc: Pt[] = []
  for (let a = 0; a <= 24; a++) {
    const th = (Math.PI * a) / 24
    arc.push([cx - rx * Math.cos(th), drumTop - ry * Math.sin(th)])
  }
  out.push(...body(arc, 'line'))
  const shade: Pt[] = [[cx + rx * 0.2, drumTop]]
  for (let a = 12; a <= 24; a++) {
    const th = (Math.PI * a) / 24
    shade.push([cx - rx * Math.cos(th), drumTop - ry * Math.sin(th)])
  }
  out.push(...toneFill(shade, 'T4', { gap: [3, 3], inset: 0.3 }))
  out.push(
    stroke('line', [
      [cx, drumTop - ry],
      [cx, drumTop - ry - h * 0.07],
    ]),
  )
  out.push(fill(rectPts(cx - 1.2, drumTop - ry - h * 0.07 - 1.2, 2.4, 2.4)))
  out.push(hline('bold', x + 2, x + w - 2, base))
  return out
}
