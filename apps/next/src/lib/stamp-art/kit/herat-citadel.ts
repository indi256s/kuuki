// Herat Citadel (Afghanistan): a mud-brick fortress on a battered mound. A curtain wall with
// merlons, round towers along it (the two central ones taller, flanking the gate), horizontal
// course lines, slit windows, and a dark pointed gate. Mound slopes are hatched dark. The box is the
// whole fortress; its bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, rectPts, toneFill } from '../grid'
import { merlons, pointedArch } from './dome-parts-c'
import { type KitModule, num } from './util'

export const heratCitadel: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const glacisTop = base - h * 0.2
  const wallTop = y + h * 0.4
  // Mound: a battered slope dark with fall-line hatching.
  const mound: Pt[] = [
    [x, base],
    [x + w * 0.05, glacisTop],
    [x + w * 0.95, glacisTop],
    [x + w, base],
  ]
  out.push(...body(mound, 'line'))
  out.push(...toneFill(mound, 'T4', { gap: [3.2, 3.2], inset: 0.3, weight: 'hair' }))
  // Curtain wall.
  const wall: Pt[] = [
    [x + w * 0.03, glacisTop + 0.5],
    [x + w * 0.03, wallTop],
    [x + w * 0.97, wallTop],
    [x + w * 0.97, glacisTop + 0.5],
  ]
  out.push(...body(wall, 'line'))
  for (let cy = wallTop + 6; cy < glacisTop - 2; cy += 6)
    out.push(hline('fine', x + w * 0.04, x + w * 0.96, cy + (rand() - 0.5) * 0.4))
  out.push(...merlons(x + w * 0.04, x + w * 0.96, wallTop, 3.2, 2.4, 2.8))
  out.push(hline('bold', x + w * 0.03, x + w * 0.97, wallTop))
  // Towers.
  const towers: Array<[number, number, number]> = [
    [0.08, 0.1, 0.18],
    [0.25, 0.09, 0.15],
    [0.42, 0.11, 0.07],
    [0.58, 0.11, 0.07],
    [0.75, 0.09, 0.15],
    [0.92, 0.1, 0.18],
  ]
  const tower = (fx: number, fw: number, ftop: number): SvgNode[] => {
    const t: SvgNode[] = []
    const tx = x + w * fx
    const tw = w * fw
    const top = y + h * ftop
    const bot = glacisTop + 1
    t.push(
      ...body(
        [
          [tx - tw / 2 - 1.2, bot],
          [tx - tw / 2, top],
          [tx + tw / 2, top],
          [tx + tw / 2 + 1.2, bot],
        ],
        'line',
      ),
    )
    t.push(
      ...toneFill(
        [
          [tx + tw * 0.2, top + 1],
          [tx + tw / 2, top + 1],
          [tx + tw / 2 + 1.2, bot],
          [tx + tw * 0.2, bot],
        ],
        'T4',
        { gap: [2.8, 2.8], inset: 0.25 },
      ),
    )
    t.push(...merlons(tx - tw / 2 + 0.6, tx + tw / 2 - 0.4, top, 2.6, 1.8, 2.6))
    t.push(hline('bold', tx - tw / 2 - 1, tx + tw / 2 + 1, top))
    for (let wy = top + (bot - top) * 0.28; wy < bot - 6; wy += (bot - top) * 0.3)
      t.push(fill(rectPts(tx - tw * 0.2 - 0.6, wy, 1.8, 4.2)))
    return t
  }
  for (const [fx, fw, ft] of towers) out.push(...tower(fx, fw, ft))
  // Gate between the two central towers.
  const gw = w * 0.1
  const gTop = wallTop + h * 0.02
  out.push(...body(rectPts(cx - gw / 2 - 1.4, gTop, gw + 2.8, glacisTop - gTop + 0.5), 'line'))
  out.push(fill(pointedArch(cx - gw / 2 + 1, gTop + 3, gw - 2, glacisTop + 0.5)))
  out.push(hline('bold', cx - gw / 2 - 2.4, cx + gw / 2 + 2.4, gTop))
  out.push(hline('bold', x + 2, x + w - 2, base))
  return out
}
