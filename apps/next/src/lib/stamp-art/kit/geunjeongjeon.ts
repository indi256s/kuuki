// Geunjeongjeon (Seoul): a wide palace hall under two stacked hipped roofs whose eaves sweep up at
// the corners, a shallow row of columns and bays below, an upper storey between the roofs, all on a
// two-tier stone terrace with a broad central stair. Roofs are hatched along the fall line (dark
// tile), terrace and walls stay lit. The box is the whole hall; its bottom is the ground.
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

export const geunjeongjeon: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const base = y + h
  const out: SvgNode[] = []
  const terr1 = base - h * 0.11
  const terr2 = base - h * 0.2
  const bodyTop = base - h * 0.34
  const roof1Y = bodyTop + 1
  const wall2Top = base - h * 0.62
  const roof2Y = y + 1
  const gap = num(p, 'tileGap', 3.6)
  // Terrace tiers.
  const t1w = w * 0.47,
    t2w = w * 0.41
  out.push(...body(rectPts(cx - t1w, terr1, t1w * 2, base - terr1), 'line'))
  out.push(...body(rectPts(cx - t2w, terr2, t2w * 2, terr1 - terr2 + 0.5), 'line'))
  for (let k = 0; k < 2; k++) {
    const yy = k ? terr1 + (base - terr1) * 0.5 : terr2 + (terr1 - terr2) * 0.5
    const hw = k ? t1w : t2w
    out.push(
      stroke('fine', [
        [cx - hw + 2, yy],
        [cx - hw * 0.2, yy],
      ]),
      stroke('fine', [
        [cx + hw * 0.2, yy],
        [cx + hw - 2, yy],
      ]),
    )
  }
  // Balustrade posts along the upper terrace edge.
  for (let px = cx - t2w + 3; px < cx + t2w - 2; px += 5.2) {
    if (Math.abs(px - cx) < w * 0.1) continue
    out.push(
      stroke('hair', [
        [px, terr2 - 2.6],
        [px, terr2],
      ]),
    )
  }
  // Central stair: sides and treads.
  const sw = w * 0.11
  const treads = 7
  for (let i = 1; i < treads; i++) {
    const yy = terr2 + ((base - terr2) * i) / treads
    out.push(
      stroke('hair', [
        [cx - sw, yy],
        [cx + sw, yy],
      ]),
    )
  }
  out.push(
    stroke('line', [
      [cx - sw, terr2],
      [cx - sw, base],
    ]),
    stroke('line', [
      [cx + sw, terr2],
      [cx + sw, base],
    ]),
  )
  out.push(
    ...toneFill(rectPts(cx - sw * 0.14, terr2 + 1, sw * 0.28, base - terr2 - 1), 'T4', {
      inset: 0.4,
    }),
  )
  // Hall body: columns and bays.
  const bw = w * 0.35
  out.push(...body(rectPts(cx - bw, bodyTop, bw * 2, terr2 - bodyTop + 0.5), 'line'))
  const bays = 6
  for (let i = 0; i < bays; i++) {
    const bx0 = cx - bw + (bw * 2 * i) / bays
    const bwid = (bw * 2) / bays
    if (i % 3 === 1)
      out.push(
        ...toneFill(rectPts(bx0 + 1.1, bodyTop + 2.4, bwid - 2.2, terr2 - bodyTop - 3), 'T4', {
          inset: 0.3,
          gap: [2.2, 2.2],
        }),
      )
    out.push(
      stroke('line', [
        [bx0, bodyTop],
        [bx0, terr2],
      ]),
    )
  }
  out.push(
    stroke('line', [
      [cx + bw, bodyTop],
      [cx + bw, terr2],
    ]),
  )
  // Roofs.
  const roof = (halfEave: number, yEave: number, halfTop: number, yTop: number, lift: number) => {
    const bot: Pt[] = quad(
      [cx - halfEave, yEave - lift],
      [cx - halfEave * 0.86, yEave + 2.5],
      [cx - halfEave * 0.62, yEave + 1.6],
      6,
    )
    const botR: Pt[] = bot.map(([px, py]): Pt => [2 * cx - px, py]).reverse()
    const rightSide = quad(
      [cx + halfEave, yEave - lift],
      [cx + (halfEave + halfTop) / 2 - 2, (yEave + yTop) / 2 + (yEave - yTop) * 0.2],
      [cx + halfTop, yTop],
      10,
    )
    const leftSide = rightSide.map(([px, py]): Pt => [2 * cx - px, py]).reverse()
    const poly: Pt[] = [...bot, ...botR, ...rightSide, ...leftSide]
    out.push(occlude(poly))
    out.push(...toneFill(poly, 'T4', { inset: 0.8, gap: [gap, gap] }))
    out.push(stroke('line', poly, true))
    out.push(stroke('bold', [...bot, ...botR]))
    out.push(
      stroke('bold', [
        [cx - halfTop, yTop],
        [cx + halfTop, yTop],
      ]),
    )
  }
  // Upper storey wall between the roofs.
  const uw = w * 0.2
  out.push(...body(rectPts(cx - uw, wall2Top, uw * 2, base - h * 0.5 - wall2Top + 2), 'line'))
  for (const f of [-0.5, 0, 0.5])
    out.push(fill(rectPts(cx + uw * f - 1.8, wall2Top + 3, 3.6, base - h * 0.5 - wall2Top - 3)))
  roof(w * 0.49, roof1Y, uw * 1.15, base - h * 0.5, num(p, 'lift', 4))
  roof(w * 0.3, wall2Top, w * 0.1, roof2Y, num(p, 'lift', 4) * 0.8)
  out.push(hline('bold', x + 3, x + w - 3, base))
  return out
}
