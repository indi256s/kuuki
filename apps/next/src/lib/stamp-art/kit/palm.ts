// Palm module: a leaning trunk with ring ticks and a crown of drooping solid fronds. The box is the
// tree (ground at its bottom); `lean` shifts the crown sideways as a fraction of the width.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, quad, stroke } from '../grid'
import { type KitModule, num } from './util'

export const palm: KitModule = ([x, y, w, h], p) => {
  const lean = num(p, 'lean', 0.15)
  const count = Math.max(5, Math.round(num(p, 'fronds', 7)))
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const trunkW = num(p, 'trunkW', Math.max(2.4, w * 0.07))
  const frondLen = w * num(p, 'frond', 0.62)
  const baseX = x + w / 2 - w * lean * 0.5
  const crown: Pt = [x + w / 2 + w * lean * 0.5, y + frondLen * 0.28]
  const out: SvgNode[] = []
  // Trunk: a bowed ribbon, tapering to the crown.
  const mid: Pt = [baseX + (crown[0] - baseX) * 0.3, y + h * 0.55]
  const spine = quad([baseX, y + h], mid, crown, 14)
  const left: Pt[] = spine.map(([px, py], i) => [px - (trunkW / 2) * (1 - (i / 14) * 0.4), py])
  const right: Pt[] = spine.map(([px, py], i) => [px + (trunkW / 2) * (1 - (i / 14) * 0.4), py])
  out.push(...body([...left, ...right.slice().reverse()], 'hair'))
  for (let i = 2; i < 14; i += 2) {
    const [lx, ly] = left[i]
    const [rx] = right[i]
    out.push(
      stroke('fine', [
        [lx, ly],
        [rx, ly + 0.6],
      ]),
    )
  }
  // Fronds: leaf shapes sweeping out and drooping, drawn solid.
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (1.02 + (0.96 * i) / (count - 1)) // left to right across the top
    const len = frondLen * (0.8 + rand() * 0.35)
    const dx = Math.cos(a)
    const tipX = crown[0] + dx * len
    const tipY = crown[1] + Math.sin(a) * len * 0.3 + len * (0.28 + 0.42 * Math.abs(dx))
    const ctrl: Pt = [crown[0] + dx * len * 0.6, crown[1] + Math.sin(a) * len * 0.85]
    const top = quad(crown, ctrl, [tipX, tipY], 8)
    const under = quad(crown, [ctrl[0], ctrl[1] + len * 0.34], [tipX, tipY], 8)
    out.push(fill([...top, ...under.slice(0, -1).reverse()]))
  }
  out.push(
    fill([
      [crown[0] - 1.1, crown[1] - 0.6],
      [crown[0] + 1.1, crown[1] - 0.6],
      [crown[0] + 1.1, crown[1] + 1.6],
      [crown[0] - 1.1, crown[1] + 1.6],
    ]),
  )
  return out
}
