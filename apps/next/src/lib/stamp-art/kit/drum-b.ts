// Round masonry tower in elevation (Maiden Tower, Nizwa Fort): a battered shaft with curved
// course lines, the right `shade` of it in T4, a crown of merlons that crowd toward the edges the
// way a cylinder's do, and an optional rectangular `spur` buttress on the right. The box is the
// shaft base width by the whole height; the bottom is the ground.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

export const drumB: KitModule = ([x, y, w, h], p) => {
  const taper = num(p, 'taper', 0.9)
  const crownW = num(p, 'crownW', 1.08)
  const crownH = h * num(p, 'crownH', 0.12)
  const merlons = Math.max(0, Math.round(num(p, 'merlons', 7)))
  const merlonH = num(p, 'merlonH', 4)
  const bands = Math.round(num(p, 'bands', 5))
  const slits = Math.round(num(p, 'slits', 3))
  const shade = num(p, 'shade', 0.36)
  const door = num(p, 'door', 0)
  const spurW = w * num(p, 'spur', 0)
  const spurH = h * num(p, 'spurH', 0.6)
  const cx = x + w / 2
  const base = y + h
  const topW = w * taper
  const crownTop = y + merlonH
  const shaftTop = crownTop + crownH
  const half = (yy: number) => (topW + (w - topW) * ((yy - shaftTop) / (base - shaftTop))) / 2
  const out: SvgNode[] = []

  // Spur first, so the shaft overlaps its root.
  if (spurW > 0) {
    const yt = base - spurH
    const edge = cx + half(yt)
    const sp: Pt[] = [
      [cx + w / 2 - 2, base],
      [cx + half(yt) - 1.5, yt],
      [edge + spurW * 0.7, yt + spurW * 0.5],
      [cx + w / 2 + spurW, base],
    ]
    out.push(...body(sp, 'line'))
    out.push(...toneFill(sp, 'T4', { gap: 2.2, weight: 'hair', inset: 0.5 }))
  }

  const shaft: Pt[] = [
    [cx - topW / 2, shaftTop],
    [cx + topW / 2, shaftTop],
    [cx + w / 2, base],
    [cx - w / 2, base],
  ]
  out.push(...body(shaft, 'line'))
  // Shaded flank with a curved terminator.
  if (shade > 0) {
    const sx = (yy: number) => cx + half(yy) * (1 - shade * 2)
    const flank: Pt[] = [
      [sx(shaftTop), shaftTop],
      [cx + half(shaftTop), shaftTop],
      [cx + w / 2, base],
      [sx(base), base],
    ]
    out.push(...toneFill(flank, 'T4', { gap: 2.4, weight: 'hair', inset: 0.4 }))
  }
  // Courses bow downward across the curved face.
  for (let i = 1; i <= bands; i++) {
    const yy = shaftTop + ((base - shaftTop) * i) / (bands + 1)
    const hw = half(yy)
    out.push(stroke('hair', quad([cx - hw, yy], [cx, yy + 2.6], [cx + hw, yy], 10)))
  }
  // Slit windows on the lit side.
  for (let i = 0; i < slits; i++) {
    const yy = shaftTop + (base - shaftTop) * (0.2 + (0.6 * i) / Math.max(1, slits))
    out.push(fill(rectPts(cx - half(yy) * (i % 2 ? 0.2 : 0.55) - 1, yy, 2, 5)))
  }
  if (door > 0) {
    const dw = w * door
    out.push(fill([...rectPts(cx - dw / 2 - w * 0.12, base - dw * 1.5, dw, dw * 1.5 - 0.5)]))
  }
  // Crown: a projecting band, a bold corbel course, merlons foreshortened by the curve.
  const cw = topW * crownW
  const crown: Pt[] = rectPts(cx - cw / 2, crownTop, cw, crownH)
  out.push(...body(crown, 'line'))
  out.push(
    stroke('bold', [
      [cx - cw / 2 - 0.8, shaftTop],
      [cx + cw / 2 + 0.8, shaftTop],
    ]),
  )
  if (shade > 0)
    out.push(
      ...toneFill(rectPts(cx + cw * 0.14, crownTop, cw * 0.36, crownH), 'T4', {
        gap: 2.4,
        weight: 'hair',
        inset: 0.4,
      }),
    )
  if (merlons > 0) {
    const pitch = Math.PI / merlons
    for (let i = 0; i < merlons; i++) {
      const a0 = -Math.PI / 2 + pitch * i
      const a1 = a0 + pitch * 0.55
      const xa = cx + (cw / 2) * Math.sin(a0)
      const xb = cx + (cw / 2) * Math.sin(a1)
      out.push(...body(rectPts(xa, y, Math.max(1.4, xb - xa), merlonH + 0.5), 'line'))
    }
  }
  out.push(hline('bold', cx - cw / 2 - 0.8, cx + cw / 2 + 0.8, crownTop))
  return out
}
