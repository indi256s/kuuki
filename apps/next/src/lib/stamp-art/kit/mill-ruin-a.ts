// Sugar-mill ruin (lane A, `-a` until consolidated): a round tapered stone tower with a ragged
// broken crown, rough stone courses, a shaded right flank, an arched door, empty window openings,
// one snapped sail beam and rubble at the foot. The box bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatch, hline, stroke } from '../grid'
import { type KitModule, num } from './util'

export const millRuinA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const base = y + h
  const cx = x + w / 2
  const topW = w * 0.62
  const halfAt = (yy: number): number => {
    const t = (base - yy) / h
    return (w / 2) * (1 - t) + (topW / 2) * t
  }
  const out: SvgNode[] = []
  // Broken crown: a high jagged left edge falling to a low gap at the right.
  const crown: Pt[] = []
  const n = 7
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const hh = h * (0.99 - 0.17 * f * f - (i % 2) * 0.05 - rand() * 0.04) - (i === 5 ? h * 0.09 : 0)
    crown.push([cx - topW / 2 + topW * f, base - hh])
  }
  const left: Pt = [cx - w / 2, base]
  const right: Pt = [cx + w / 2, base]
  const shell: Pt[] = [left, ...crown, right]
  out.push(...body(shell, 'line'))
  // Shaded flank on the right, hatched along the wall.
  const shadeX = cx + w * 0.1
  const flank: Pt[] = [
    [shadeX, base],
    [shadeX + (crown[3][0] - cx) * 0.0 + w * 0.02, crown[3][1] + 1],
    ...crown.slice(4),
    right,
  ]
  out.push(...hatch(flank, 'v', 2.4, 'hair', 0.5))
  // Courses: staggered rough joints following the taper.
  const rows = 8
  for (let r = 1; r < rows; r++) {
    const ly = base - ((h * r) / rows) * 0.97
    const hf = halfAt(ly) - 1
    let sx = cx - hf
    while (sx < cx + hf - 1) {
      const ex = Math.min(cx + hf, sx + 6 + rand() * 7)
      out.push(hline('hair', sx, ex - 0.8, ly))
      sx = ex
    }
  }
  // Arched door at the foot.
  const dw = w * 0.2
  const dh = h * 0.3
  out.push(
    fill([
      [cx - dw / 2 - 2, base],
      [cx - dw / 2 - 2, base - dh * 0.7],
      [cx - dw * 0.25, base - dh],
      [cx + dw * 0.25, base - dh],
      [cx + dw / 2 - 2, base - dh * 0.7],
      [cx + dw / 2 - 2, base],
    ]),
  )
  // Empty openings, narrowing upward.
  for (const [fy, fx] of [
    [0.52, -0.1],
    [0.7, 0.04],
  ] as const) {
    const wy = base - h * fy
    const ww = w * 0.09
    const wh = h * 0.12
    const wx = cx + w * fx
    out.push(
      ...body(
        [
          [wx - ww / 2, wy + wh],
          [wx - ww / 2, wy],
          [wx, wy - ww * 0.5],
          [wx + ww / 2, wy],
          [wx + ww / 2, wy + wh],
        ],
        'hair',
      ),
    )
    out.push(
      fill([
        [wx - ww / 2 + 0.8, wy + wh - 0.4],
        [wx - ww / 2 + 0.8, wy + 0.6],
        [wx, wy - ww * 0.5 + 1.2],
        [wx + ww / 2 - 0.8, wy + 0.6],
        [wx + ww / 2 - 0.8, wy + wh - 0.4],
      ]),
    )
  }
  // Snapped sail beam leaning from the broken top.
  const hub: Pt = [cx + w * 0.02, base - h * 0.94]
  const tip: Pt = [hub[0] - w * 0.42, hub[1] - h * 0.13]
  out.push(stroke('line', [hub, tip]))
  out.push(
    stroke('hair', [
      [hub[0] - w * 0.08, hub[1] - h * 0.035],
      [tip[0] + w * 0.05, tip[1] + h * 0.035],
    ]),
  )
  for (let i = 1; i < 5; i++) {
    const t = 0.3 + i * 0.14
    const bx = hub[0] + (tip[0] - hub[0]) * t
    const by = hub[1] + (tip[1] - hub[1]) * t
    out.push(
      stroke('fine', [
        [bx - 0.5, by - 5],
        [bx + 0.5, by + 5],
      ]),
    )
  }
  // Rubble.
  for (let i = 0; i < 7; i++) {
    const rx = cx - w * 0.68 + w * 0.2 * i + rand() * 4
    const s = 2.2 + rand() * 2.6
    out.push(
      ...body(
        [
          [rx, base + 0.5],
          [rx + 1, base - s],
          [rx + s * 1.4, base - s * 0.6],
          [rx + s * 1.8, base + 0.5],
        ],
        'hair',
      ),
    )
  }
  return out
}
