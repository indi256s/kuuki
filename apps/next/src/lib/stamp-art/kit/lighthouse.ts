// Lighthouse module: a tapering tower with a gallery, a glazed lantern and a domed cap. The box is
// the whole lighthouse (the ground is its bottom). The right `shade` of the shaft is T4; `bands`
// paints that many horizontal T4 stripes (a banded tower); `ribs` adds fine vertical panel lines
// (cast iron); `base` is a low keeper's block at the foot (fraction of the height).
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
  vline,
} from '../grid'
import { type KitModule, num } from './util'

export const lighthouse: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const taper = num(p, 'taper', 0.62)
  const lanternH = h * num(p, 'lantern', 0.12)
  const domeH = h * num(p, 'dome', 0.07)
  const galleryH = h * 0.025
  const baseH = h * num(p, 'base', 0)
  const shade = num(p, 'shade', 0.3)
  const bands = Math.round(num(p, 'bands', 0))
  const ribs = Math.round(num(p, 'ribs', 0))
  const bottom = y + h - baseH
  const topW = w * taper
  const lanternW = topW * 0.7
  const gallery = y + domeH + lanternH
  const shaftTop = gallery + galleryH
  const out: SvgNode[] = []
  const half = (yy: number) => (topW + ((w - topW) * (yy - shaftTop)) / (bottom - shaftTop)) / 2
  const shaft: Pt[] = [
    [cx - topW / 2, shaftTop],
    [cx + topW / 2, shaftTop],
    [cx + w / 2, bottom],
    [cx - w / 2, bottom],
  ]
  out.push(...body(shaft, 'line'))
  const shaftH = bottom - shaftTop
  if (bands > 0) {
    for (let i = 0; i < bands; i++) {
      const t0 = (i * 2 + 1) / (bands * 2 + 1)
      const t1 = (i * 2 + 2) / (bands * 2 + 1)
      const y0 = shaftTop + shaftH * t0
      const y1 = shaftTop + shaftH * t1
      out.push(
        ...toneFill(
          [
            [cx - half(y0), y0],
            [cx + half(y0), y0],
            [cx + half(y1), y1],
            [cx - half(y1), y1],
          ],
          'T4',
          { inset: 0.4 },
        ),
        hline('hair', cx - half(y0), cx + half(y0), y0),
        hline('hair', cx - half(y1), cx + half(y1), y1),
      )
    }
  } else if (shade > 0) {
    const xl = (yy: number) => cx + half(yy) * (1 - 2 * shade)
    out.push(
      ...toneFill(
        [
          [xl(shaftTop), shaftTop],
          [cx + half(shaftTop), shaftTop],
          [cx + half(bottom), bottom],
          [xl(bottom), bottom],
        ],
        'T4',
        { inset: 0.5 },
      ),
    )
  }
  for (let i = 1; i <= ribs; i++) {
    const f = -1 + (2 * i) / (ribs + 1)
    out.push(
      stroke('fine', [
        [cx + f * half(shaftTop + 3), shaftTop + 3],
        [cx + f * half(bottom - 3), bottom - 3],
      ]),
    )
  }
  // Windows up the lit side.
  const wins = Math.round(num(p, 'windows', 3))
  for (let i = 0; i < wins; i++) {
    const yy = shaftTop + (shaftH * (i + 0.7)) / (wins + 0.9)
    out.push(fill(rectPts(cx - half(yy) * 0.35 - 0.9, yy, 1.8, Math.max(3, h * 0.04))))
  }
  // Door.
  out.push(fill(rectPts(cx - 1.8, bottom - h * 0.06, 3.6, h * 0.06)))
  // Gallery slab and railing.
  const gw = topW * 1.4
  out.push(...body(rectPts(cx - gw / 2, gallery, gw, galleryH), 'line'))
  out.push(
    stroke('bold', [
      [cx - gw / 2 - 1, gallery + galleryH],
      [cx + gw / 2 + 1, gallery + galleryH],
    ]),
  )
  const brackets = Math.round(num(p, 'brackets', 0))
  if (brackets > 0) {
    // Cast-iron brackets under the gallery: diagonal struts from the shaft to the slab edge.
    const drop = h * 0.09
    for (let i = 0; i < brackets; i++) {
      const f = (i + 0.5) / brackets
      const ex = cx - gw / 2 + 1 + f * (gw / 2 - 1)
      const sxx = cx - half(shaftTop + drop) * (1 - f * 0.55)
      for (const m of [1, -1])
        out.push(
          stroke('hair', [
            [cx + m * (cx - ex), shaftTop + galleryH],
            [cx + m * (cx - sxx), shaftTop + drop * (0.45 + f * 0.55)],
          ]),
        )
    }
  }
  for (let rx = cx - gw / 2 + 1.2; rx < cx + gw / 2; rx += 3) {
    out.push(vline('fine', rx, gallery - h * 0.03, gallery))
  }
  out.push(hline('hair', cx - gw / 2, cx + gw / 2, gallery - h * 0.03))
  // Lantern: glazed with mullions, then the dome.
  const lantTop = y + domeH
  out.push(...body(rectPts(cx - lanternW / 2, lantTop, lanternW, lanternH), 'line'))
  for (const f of [-0.33, 0, 0.33])
    out.push(vline('hair', cx + f * lanternW, lantTop + 1, gallery - 1))
  const dome: Pt[] = [
    [cx - lanternW / 2 - 1.2, lantTop],
    [cx - lanternW * 0.3, y + domeH * 0.35],
    [cx, y],
    [cx + lanternW * 0.3, y + domeH * 0.35],
    [cx + lanternW / 2 + 1.2, lantTop],
  ]
  out.push(occlude(dome), fill(dome))
  // Keeper's block.
  if (baseH > 0) {
    const bw = w * 1.7
    out.push(...body(rectPts(cx - bw / 2, bottom, bw, baseH), 'line'))
    out.push(
      ...toneFill(rectPts(cx + bw * 0.1, bottom + 1, bw * 0.4, baseH - 1), 'T4', { inset: 0.4 }),
    )
  }
  out.push(
    stroke('bold', [
      [cx - w, y + h],
      [cx + w, y + h],
    ]),
  )
  return out
}
