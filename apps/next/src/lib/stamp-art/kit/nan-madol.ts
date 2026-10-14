// Nan Madol: a ring of artificial islets whose walls are stacked basalt prisms, laid like log-cabin
// courses with the ends of the logs sticking out at the corners. The box is the wall front; its
// bottom is the waterline. Two corner towers stand taller than the wall between them, which has a
// low gateway with a lintel and a dark threshold.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, rectPts, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

export const nanMadol: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const out: SvgNode[] = []
  const towerW = w * num(p, 'tower', 0.2)
  const wallTop = y + h * num(p, 'wall', 0.4)
  const ch = num(p, 'course', 5.4)
  const tower = (tx: number): void => {
    const top = y
    out.push(...body(rectPts(tx, top, towerW, base - top), 'line'))
    // Courses: alternate long logs and protruding log ends at the corners.
    let k = 0
    for (let cy = top + ch; cy < base - 1; cy += ch, k++) {
      out.push(hline('hair', tx, tx + towerW, cy))
      if (k % 2 === 0) {
        out.push(
          ...body(rectPts(tx - 3, cy - ch + 0.4, 3, ch - 0.8), 'hair'),
          ...body(rectPts(tx + towerW, cy - ch + 0.4, 3, ch - 0.8), 'hair'),
        )
      }
    }
    // Shaded right edge.
    out.push(
      ...toneFill(rectPts(tx + towerW * 0.72, top + 1, towerW * 0.28, base - top - 1), 'T4', {
        gap: 2.4,
        inset: 0.1,
      }),
    )
  }
  const lx = x + 3
  const rx = x + w - towerW - 3
  // Wall between the towers.
  const wx0 = lx + towerW
  const wx1 = rx
  out.push(...body(rectPts(wx0, wallTop, wx1 - wx0, base - wallTop), 'line'))
  let row = 0
  for (let cy = wallTop + ch; cy < base - 0.5; cy += ch, row++) {
    out.push(hline('hair', wx0, wx1, cy))
    for (let jx = wx0 + 6 + (row % 2) * 9; jx < wx1 - 3; jx += 18 + rand() * 5) {
      out.push(vline('fine', jx, cy - ch + 0.4, cy - 0.4))
    }
  }
  // Gateway: dark threshold under a heavy lintel.
  const gx = (wx0 + wx1) / 2
  const gw = num(p, 'gate', 13)
  const gh = (base - wallTop) * 0.58
  out.push(...body(rectPts(gx - gw / 2, base - gh, gw, gh), 'line'))
  out.push(...toneFill(rectPts(gx - gw / 2, base - gh, gw, gh), 'T4', { gap: 1.9, inset: 0.2 }))
  out.push(...body(rectPts(gx - gw / 2 - 3, base - gh - 4.4, gw + 6, 4.4), 'line'))
  tower(lx)
  tower(rx)
  out.push(hline('bold', wx0, wx1, wallTop))
  out.push(hline('bold', x - 4, x + w + 4, base))
  const pts: Pt[] = []
  void pts
  void stroke
  return out
}
