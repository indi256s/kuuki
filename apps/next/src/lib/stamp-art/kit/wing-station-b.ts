// Fiat Tagliero-type cantilever (Asmara): a tall central cabin on a slim base with two thin
// concrete wings thrust out from its roof like an aircraft's, tips lifting. Dark tall windows
// on the cabin, a shaded wing soffit, and a pump island under each wing. The box bottom is the
// forecourt.
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

export const wingStationB: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const cx = x + w / 2
  const cabW = w * num(p, 'cabin', 0.2)
  const roofY = y + h * 0.42
  const cabTop = y + h * 0.26
  const out: SvgNode[] = []
  // Wings (both sides).
  for (const s of [-1, 1]) {
    const root = cx + s * (cabW / 2 - 1)
    const tip = cx + s * w * 0.5
    const wing: Pt[] = [
      [root, roofY - 5],
      [cx + s * w * 0.28, roofY - 6],
      [tip, roofY - 8],
      [cx + s * w * 0.46, roofY - 5],
      [cx + s * w * 0.28, roofY + 0.6],
      [root, roofY + 4],
    ]
    out.push(occlude(wing, { halo: 1.2 }), ...body(wing, 'line'))
    out.push(
      ...toneFill([wing[3], wing[4], wing[5], [cx + s * w * 0.2, roofY + 2]], 'T4', {
        angle: 90,
        gap: 1.6,
        weight: 'fine',
        inset: 0.3,
      }),
      stroke('fine', [
        [root, roofY],
        [cx + s * w * 0.4, roofY - 8],
      ]),
    )
    // Pump island under the wing.
    const px = cx + s * w * 0.34
    out.push(
      ...body(rectPts(px - 3, base - 9, 6, 9), 'hair'),
      fill(rectPts(px - 2, base - 7, 4, 2.4)),
    )
  }
  // Cabin and tower base.
  const cab: Pt[] = rectPts(cx - cabW / 2, cabTop, cabW, roofY - cabTop + 4)
  out.push(occlude(cab), ...body(cab, 'line'))
  out.push(fill(rectPts(cx - cabW / 2 + 2, cabTop + 3, cabW - 4, 4)))
  for (let k = 0; k < 4; k++)
    out.push(fill(rectPts(cx - cabW / 2 + 2.4 + k * ((cabW - 6) / 4), cabTop + 10, 2, 8)))
  out.push(hline('bold', cx - cabW / 2 - 1, cx + cabW / 2 + 1, cabTop))
  const stem: Pt[] = rectPts(cx - cabW * 0.32, roofY + 4, cabW * 0.64, base - roofY - 4)
  out.push(occlude(stem), ...body(stem, 'line'))
  out.push(
    ...toneFill(
      [
        [cx + cabW * 0.04, roofY + 5],
        [cx + cabW * 0.32, roofY + 5],
        [cx + cabW * 0.32, base],
        [cx + cabW * 0.04, base],
      ],
      'T4',
      { angle: 90, gap: 1.8, weight: 'fine', inset: 0.4 },
    ),
  )
  // Forecourt slab.
  out.push(hline('bold', x, x + w, base - 0.5))
  return out
}
