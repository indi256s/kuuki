// Darvaza gas crater (Turkmenistan): a round collapse pit in flat desert, seen from slightly
// above. A raised, cracked rim of lit sand, the far inner wall in shadow, the near inner wall lit,
// a dark floor with concentric rings, and a few fallen rim blocks. No flames are drawn: the fire
// is being put out. The box bottom is the near sand.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 36): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]
  })

export const darvaza: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const cx = x + w / 2
  const cy = y + h * 0.55
  const rx = w * 0.46
  const ry = h * 0.34
  const out: SvgNode[] = []
  // Rim: a bulging ring of sand around the pit.
  const outer = ellipse(cx, cy, rx * 1.08, ry * 1.2)
  const rimPts: Pt[] = outer.map(([px, py], i): Pt => [
    px + (rand() - 0.5) * 1.4,
    py + (rand() - 0.5) * 1 + (i > 18 ? 1 : 0),
  ])
  out.push(occlude(rimPts), stroke('line', rimPts, true))
  // Inner edge and pit.
  const edge = ellipse(cx, cy, rx * 0.9, ry * 0.92).map(([px, py]): Pt => [
    px + (rand() - 0.5) * 1.8,
    py + (rand() - 0.5) * 1.2,
  ])
  out.push(occlude(edge), stroke('line', edge, true))
  // Far inner wall in shadow: the upper crescent of the pit.
  const crescent: Pt[] = [
    ...edge.filter(([, py]) => py <= cy + ry * 0.1),
    ...ellipse(cx, cy + ry * 0.28, rx * 0.5, ry * 0.4)
      .filter(([, py]) => py <= cy + ry * 0.28)
      .reverse(),
  ]
  out.push(...toneFill(crescent, 'T4', { inset: 0.6, gap: [3.4, 3.4] }))
  // Floor.
  const floor = ellipse(cx, cy + ry * 0.28, rx * 0.5, ry * 0.4)
  out.push(occlude(floor), fill(floor))
  for (const k of [0.78, 0.5]) {
    const ring = ellipse(cx, cy + ry * 0.28, rx * 0.5 * k, ry * 0.4 * k)
    out.push(occlude(ring, {}), stroke('hair', ring, true))
  }
  // Fallen blocks on the near rim.
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 5)) + (rand() - 0.5) * 0.15
    const bx = cx + Math.cos(a) * rx * 1.0
    const by = cy + Math.sin(a) * ry * 1.12
    const s = 2.4 + rand() * 2
    out.push(
      occlude([
        [bx - s, by + s * 0.6],
        [bx - s * 0.6, by - s * 0.6],
        [bx + s, by - s * 0.4],
        [bx + s * 0.8, by + s * 0.6],
      ]),
    )
    out.push(
      stroke(
        'hair',
        [
          [bx - s, by + s * 0.6],
          [bx - s * 0.6, by - s * 0.6],
          [bx + s, by - s * 0.4],
          [bx + s * 0.8, by + s * 0.6],
        ],
        true,
      ),
    )
  }
  // Cracks on the lit near rim.
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.05 + 0.9 * rand())
    const r0 = 0.94 + rand() * 0.04
    out.push(
      stroke('fine', [
        [cx + Math.cos(a) * rx * r0, cy + Math.sin(a) * ry * r0 * 1.0],
        [cx + Math.cos(a) * rx * (r0 + 0.1), cy + Math.sin(a) * ry * (r0 + 0.14)],
      ]),
    )
  }
  return out
}
