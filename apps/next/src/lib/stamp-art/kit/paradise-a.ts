// Papua New Guinea: a Raggiana bird-of-paradise perched on a branch, in profile facing left. The
// body is solid (T5) with a lit head and beak; long flank plumes cascade down and right as lit
// ribbons with fine barbs and a shaded edge, over rainforest in T2. A branch with a few big leaves
// carries it. The module draws its own rainforest as backdrop hatching; the box is the window.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

/** A ribbon along a quadratic centreline: lit paper, outlined, barbed, shaded on its lower edge. */
function ribbon(a: Pt, c: Pt, b: Pt, wid: number): SvgNode[] {
  const n = 18
  const cl = quad(a, c, b, n)
  const L: Pt[] = [],
    R: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const prev = cl[Math.max(0, i - 1)],
      next = cl[Math.min(n, i + 1)]
    const dx = next[0] - prev[0],
      dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    const wt = wid * Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)) ** 0.7 * (1 - 0.35 * t)
    L.push([cl[i][0] - (dy / len) * wt, cl[i][1] + (dx / len) * wt])
    R.push([cl[i][0] + (dy / len) * wt, cl[i][1] - (dx / len) * wt])
  }
  const poly: Pt[] = [...L, ...R.reverse()]
  const out: SvgNode[] = [occlude(poly, { halo: 1.2 }), stroke('hair', poly, true)]
  // Barbs: short strokes leaning away from the centreline toward the tip, on the lit side.
  for (let i = 3; i < n - 1; i += 2) {
    const [px, py] = cl[i]
    const prev = cl[i - 1],
      next = cl[i + 1]
    const dx = next[0] - prev[0],
      dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    out.push(
      stroke('fine', [
        [px, py],
        [
          L[i][0] * 0.75 + px * 0.25 + (dx / len) * 1.6,
          L[i][1] * 0.75 + py * 0.25 + (dy / len) * 1.6,
        ],
      ]),
    )
  }
  return out
}

/** Backdrop rainforest: T2 diagonal hatching over the whole window box. */
export const rainforestA: KitModule = ([x, y, w, h], p) =>
  toneFill(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    'T2',
    { gap: num(p, 'gap', 2.1) },
  )

export const paradiseA: KitModule = (_box, p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const out: SvgNode[] = []
  // Branch: a tapering limb from the left, rising slightly, with bark ticks.
  const top = quad([27, 100], [90, 96], [170, 84], 20)
  const bot = quad([27, 107], [90, 104], [170, 89], 20)
  const limb: Pt[] = [...top, ...bot.slice().reverse()]
  out.push(...body(limb, 'line'))
  for (let i = 2; i < 20; i += 2) {
    out.push(
      stroke('fine', [
        [top[i][0], top[i][1] + 1.8],
        [top[i][0] + 2, bot[i][1] - 1.2],
      ]),
    )
  }
  // Leaves: big pointed blades hanging off the branch.
  const leaf = (bx: number, by: number, len: number, ang: number, wd: number): SvgNode[] => {
    const dx = Math.cos(ang),
      dy = Math.sin(ang)
    const pts: Pt[] = []
    const n = 10
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const wt = wd * Math.sin(Math.PI * t) ** 0.8
      pts.push([bx + dx * len * t - dy * wt, by + dy * len * t + dx * wt])
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n
      const wt = wd * Math.sin(Math.PI * t) ** 0.8
      pts.push([bx + dx * len * t + dy * wt, by + dy * len * t - dx * wt])
    }
    return [
      occlude(pts, { halo: 1.2 }),
      stroke('hair', pts, true),
      stroke('fine', [
        [bx, by],
        [bx + dx * len * 0.95, by + dy * len * 0.95],
      ]),
    ]
  }
  out.push(
    ...leaf(40, 104, 30, 0.9, 6),
    ...leaf(150, 90, 28, 1.1, 5.5),
    ...leaf(60, 98, 24, -0.9, 5),
  )
  // Plumes cascading from the flank, back to front.
  const tips: Pt[] = [
    [158, 108],
    [152, 128],
    [140, 142],
    [124, 148],
    [106, 146],
    [90, 138],
    [78, 126],
  ]
  tips.forEach((t, i) => {
    out.push(
      ...ribbon([98 + i * 3, 78], [96 + i * 8 + (t[0] - 100) * 0.5, 84], t, 6 + rand() * 1.4),
    )
  })
  // Body: solid, a lit head with a dark beak and eye.
  const bodyPts: Pt[] = [
    [63, 62],
    [68, 55],
    [76, 56],
    [86, 61],
    [102, 67],
    [118, 76],
    [124, 86],
    [112, 88],
    [96, 88],
    [82, 83],
    [70, 76],
    [64, 69],
  ]
  out.push(occlude(bodyPts, { halo: 1.6 }), fill(bodyPts))
  const head: Pt[] = [
    [56, 56],
    [60, 49],
    [67, 46],
    [74, 48],
    [76, 55],
    [72, 60],
    [64, 60],
  ]
  out.push(...body(head, 'line'))
  out.push(
    fill([
      [56, 56],
      [47, 58.5],
      [57, 60.5],
    ]),
  )
  out.push(
    fill([
      [64.5, 52],
      [67, 52],
      [67, 54.4],
      [64.5, 54.4],
    ]),
  )
  // Feet on the branch.
  out.push(
    stroke('line', [
      [90, 88],
      [90, 96],
    ]),
    stroke('line', [
      [98, 88],
      [99, 95],
    ]),
  )
  return out
}
