// Rainforest canopy: rows of rounded crowns on visible trunks, back row smallest, with a few tall
// emergent crowns standing over the rest. Crowns are lit on the upper left; the lower right of
// each is hatched along the fall line. The box bottom is the forest floor.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

function crown(cx: number, cy: number, rx: number, ry: number, rand: () => number): Pt[] {
  const pts: Pt[] = []
  const n = 18
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n
    const bump = 1 + (i % 2 ? 0.1 : -0.06) + (rand() - 0.5) * 0.08
    pts.push([
      cx + Math.cos(a) * rx * bump,
      cy + Math.sin(a) * ry * bump * (Math.sin(a) > 0 ? 0.8 : 1),
    ])
  }
  return pts
}

export const rainforestB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const base = y + h
  const out: SvgNode[] = []
  const rows = Math.max(1, Math.round(num(p, 'rows', 3)))
  const emergent = Math.round(num(p, 'emergent', 3))
  type T = { trunk: boolean; cx: number; cy: number; rx: number; ry: number; floor: number }
  const trees: T[] = []
  for (let r = 0; r < rows; r++) {
    const f = r / Math.max(1, rows - 1)
    const rx = 9 + f * 8
    const floor = y + h * (0.72 + 0.28 * f)
    for (
      let cx = x + rx * (1.15 + rand() * 0.3);
      cx < x + w - rx * 1.0;
      cx += rx * (1.4 + rand() * 0.5)
    )
      trees.push({
        trunk: r === rows - 1,
        cx,
        cy: floor - rx * (1.1 + rand() * 0.6) - 4 - (1 - f) * 6,
        rx: rx * (0.8 + rand() * 0.4),
        ry: rx * (0.7 + rand() * 0.25),
        floor,
      })
  }
  for (let e = 0; e < emergent; e++) {
    const rx = 12 + rand() * 5
    const cx = Math.min(
      x + w - rx * 1.1,
      Math.max(x + rx * 1.1, x + w * ((e + 0.5) / emergent) + (rand() - 0.5) * w * 0.12),
    )
    trees.push({
      trunk: true,
      cx,
      cy: y + rx * 0.9 + rand() * h * 0.12,
      rx,
      ry: rx * 0.8,
      floor: base - 4,
    })
  }
  trees.sort((a, b) => a.floor - b.floor + (a.cy - b.cy) * 0.0)
  for (const t of trees) {
    const trunkTop = t.cy + t.ry * 0.6
    const tx = t.cx + (rand() - 0.5) * 2
    const trunk: Pt[] = [
      [tx - 1.4, trunkTop],
      [tx + 1.4, trunkTop],
      [tx + 1.8, t.floor],
      [tx - 1.8, t.floor],
    ]
    if (t.trunk) out.push(occlude(trunk), stroke('hair', trunk.slice(0, 4)))
    const poly = crown(t.cx, t.cy, t.rx, t.ry, rand)
    out.push(occlude(poly, { halo: 0.8 }), stroke('line', poly, true))
    const shade: Pt[] = poly.filter(([px, py]) => px + py * 0.6 > t.cx + t.cy * 0.6 - t.rx * 0.15)
    if (shade.length > 4)
      out.push(...toneFill(shade, 'T4', { angle: 80, gap: 1.8, weight: 'fine', inset: 0.5 }))
  }
  return out
}
