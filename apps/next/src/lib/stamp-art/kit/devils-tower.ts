// Devils Tower: a flat-topped igneous column fluted by vertical joints, rising from a skirt of
// fallen boulders. The box bottom is the foot of the talus. Columns are hair verticals of uneven
// length (the polygonal joints), the right third is shaded, the talus fans along its fall line.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const devilsTower: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const cx = x + w * num(p, 'axis', 0.5)
  const topW = w * num(p, 'topW', 0.3)
  const footW = topW * num(p, 'flare', 1.28)
  const talusTop = y + h * num(p, 'talus', 0.72)
  const lean = num(p, 'lean', 1.5)
  const steps = 9
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const yy = y + (talusTop - y) * t
    const half = (topW + (footW - topW) * t ** 1.8) / 2
    const inner = i > 0 && i < steps
    left.push([cx - half + lean * (1 - t) + (inner ? (rand() - 0.5) * 1.6 : 0), yy])
    right.push([cx + half + lean * (1 - t) + (inner ? (rand() - 0.5) * 1.6 : 0), yy])
  }
  const crown: Pt[] = [
    [left[0][0] + topW * 0.22, y + 0.6],
    [cx + lean + topW * 0.05, y - 0.4],
    [right[0][0] - topW * 0.2, y + 1.2],
  ]
  const tl = left[steps],
    tr = right[steps]
  const sl: Pt[] = [
    [x + w * 0.06, base - (base - talusTop) * 0.14],
    [x + w * 0.22, talusTop + (base - talusTop) * 0.5],
  ]
  const sr: Pt[] = [
    [x + w * 0.76, talusTop + (base - talusTop) * 0.5],
    [x + w * 0.93, base - (base - talusTop) * 0.14],
  ]
  const ridgeL: Pt[] = [[x, base], ...sl, tl]
  const ridgeR: Pt[] = [tr, ...sr, [x + w, base]]
  const tower: Pt[] = [...[...left].reverse(), ...crown, ...right]
  const out: SvgNode[] = [occlude([...ridgeL, ...tower.slice(1), ...ridgeR])]
  out.push(stroke('line', tower))
  out.push(stroke('hair', ridgeL), stroke('hair', ridgeR))
  out.push(hline('bold', left[0][0], right[0][0], y + 1.2))
  const edge = (t: number, yy: number) => {
    const f = ((yy - y) / (talusTop - y)) ** 1.8
    const a = left[0][0] + (tl[0] - left[0][0]) * f
    const b = right[0][0] + (tr[0] - right[0][0]) * f
    return a + (b - a) * t
  }
  for (let t = 0.04; t < 0.98; t += 0.06 + rand() * 0.035) {
    const top = y + 3 + rand() * (talusTop - y) * 0.12
    const len = (talusTop - top) * (0.55 + rand() * 0.45)
    out.push(
      stroke(
        t > 0.62 ? 'hair' : 'fine',
        [0, 0.5, 1].map((k) => [edge(t, top + len * k), top + len * k] as Pt),
      ),
    )
  }
  for (const t of [0.3, 0.52]) {
    out.push(
      stroke(
        'line',
        [0, 0.5, 1].map(
          (k) => [edge(t, y + 4 + (talusTop - y - 4) * k), y + 4 + (talusTop - y - 4) * k] as Pt,
        ),
      ),
    )
  }
  const shade: Pt[] = [
    [edge(0.74, y + 3), y + 3],
    [right[0][0], y + 3],
    ...right.slice(1),
    [edge(0.74, talusTop), talusTop],
  ]
  out.push(...toneFill(shade, 'T4', { gap: 1.7, weight: 'fine', inset: 0.5 }))
  for (let i = 0; i < 90; i++) {
    const f = rand()
    const sx = tl[0] + (tr[0] - tl[0]) * f
    const side = f < 0.5 ? -1 : 1
    const room = side < 0 ? sx - x : x + w - sx
    const len = 4 + rand() * (base - talusTop) * 0.55
    const sy = talusTop + rand() * 3
    out.push(
      stroke(side > 0 ? 'hair' : 'fine', [
        [sx, sy],
        [
          sx + side * room * 0.95 * (0.2 + rand() * 0.8) * (len / (base - talusTop)),
          Math.min(base - 1, sy + len),
        ],
      ]),
    )
  }
  return out
}
