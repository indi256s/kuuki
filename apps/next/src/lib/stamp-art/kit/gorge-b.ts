// A gorge: two tall eroded walls facing each other across a V-notch, tops cut into pinnacles,
// faces fluted by vertical gullies (lit left walls plain, right walls hatched), a forest and river
// gleam at the floor. Symmetric about `axis`. The box bottom is the floor.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const gorgeB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  const cx = x + w * num(p, 'axis', 0.5)
  const notchTop = num(p, 'notch', 0.16) * w
  const notchFoot = num(p, 'notchFoot', 0.05) * w
  const floor = base - h * 0.12
  const out: SvgNode[] = []
  const wall = (side: -1 | 1) => {
    const outerX = side < 0 ? x : x + w
    const edge = (t: number) => cx + side * (notchFoot + (notchTop - notchFoot) * (1 - t) ** 0.8)
    const sil: Pt[] = [[outerX, floor]]
    const flutes: SvgNode[] = []
    const span = edge(0) - outerX
    const pins = [0.1, 0.26, 0.44, 0.62, 0.8].map((u) => u + (rand() - 0.5) * 0.05)
    const ridge = (u: number) => {
      let yy = y + 4 + h * 0.2 * u ** 1.5
      for (const c of pins) yy -= 12 * Math.max(0, 1 - Math.abs(u - c) / 0.05)
      return yy
    }
    for (let i = 0; i <= 48; i++) {
      const u = i / 48
      sil.push([outerX + span * u, ridge(u) + (rand() - 0.5) * 1.2])
    }
    for (const c of pins) {
      const vx = outerX + span * (c + 0.07)
      const top = ridge(c + 0.07)
      const drop = (floor - top) * (0.55 + rand() * 0.45)
      flutes.push(
        stroke('hair', [
          [vx, top + 2],
          [vx + (rand() - 0.5) * 1.2, top + drop * 0.5],
          [vx + (rand() - 0.5), top + drop],
        ]),
      )
      const px = outerX + span * c
      flutes.push(
        stroke('fine', [
          [px, ridge(c) + 4],
          [px + (rand() - 0.5), ridge(c) + 4 + (floor - ridge(c)) * (0.4 + rand() * 0.4)],
        ]),
      )
    }
    sil.push([edge(0) - side * 0.5, y + h * 0.16])
    const prof: Pt[] = []
    for (let k = 0; k <= 10; k++) {
      const t = k / 10
      prof.push([edge(t), y + h * 0.16 + (floor - y - h * 0.16) * t])
    }
    const poly: Pt[] = [...sil, ...prof]
    out.push(occlude(poly))
    out.push(stroke('line', [...sil.slice(1), ...prof]), ...flutes)
    if (side < 0) {
      const sh: Pt[] = [
        [outerX, y + 14],
        [outerX + span * 0.2, y + 14],
        [outerX + span * 0.2, floor],
        [outerX, floor],
      ]
      out.push(...toneFill(sh, 'T4', { gap: 2.4, weight: 'fine', inset: 0.5 }))
    }
    if (side > 0) {
      const sh: Pt[] = [
        [outerX + span * 0.7, y + 14],
        [outerX, y + 14],
        [outerX, floor],
        [outerX + span * 0.7, floor],
      ]
      out.push(...toneFill(sh, 'T4', { gap: 2, weight: 'fine', inset: 0.5 }))
    }
  }
  wall(-1)
  wall(1)
  // Floor: forest band and river gleam.
  const fl: Pt[] = [
    [x, floor],
    [x + w, floor],
    [x + w, base],
    [x, base],
  ]
  out.push(occlude(fl), ...toneFill(fl, 'T4', { gap: 2, weight: 'hair' }))
  out.push(hline('bold', x, x + w, floor))
  for (let sx = cx - 12; sx < cx + 12; sx += 5)
    out.push(hline('hair', sx, sx + 3, base - 3 - rand() * 2))
  return out
}
