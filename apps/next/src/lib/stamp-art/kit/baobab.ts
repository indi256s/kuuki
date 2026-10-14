// Avenue of the Baobabs: two receding rows of swollen bottle trunks with sparse crowns, a dirt road
// running to the vanishing point on the axis. The box spans the whole window height; the horizon
// sits at `hz` of it, trees are placed in one-point perspective and drawn far to near.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, occlude, stroke, toneFill } from '../grid'
import { type KitModule, nums, num } from './util'

type Tree = { x: number; base: number; s: number; seed: number }

function trunk(t: Tree, out: SvgNode[], rand: () => number): void {
  const { x, base, s } = t
  const H = 74 * s
  const hw = (u: number): number => 10.4 * s * (1.12 - 0.62 * u ** 1.15 + 0.1 * Math.sin(u * 3.2))
  const L: Pt[] = [],
    R: Pt[] = []
  for (let i = 0; i <= 10; i++) {
    const u = i / 10
    L.push([x - hw(u) + (rand() - 0.5) * 0.4 * s, base - u * H])
    R.push([x + hw(u) + (rand() - 0.5) * 0.4 * s, base - u * H])
  }
  const body: Pt[] = [...L, ...R.slice().reverse()]
  out.push(occlude(body, { halo: 1.4 * Math.max(0.5, s) }))
  // Shaded right third in verticals, lit left with a few bark streaks.
  const inner: Pt[] = L.map(([lx, ly], i) => [lx + (R[i][0] - lx) * 0.68, ly])
  out.push(
    ...toneFill([...inner, ...R.slice().reverse()], 'T4', {
      angle: 90,
      gap: 2 * Math.max(0.6, s),
      weight: s > 0.45 ? 'hair' : 'fine',
      inset: 0.1,
    }),
  )
  if (s > 0.4)
    for (let k = 0; k < 4; k++) {
      const f = 0.12 + k * 0.14
      const a = 0.1 + rand() * 0.2
      out.push(
        stroke('fine', [
          [L[1][0] + (R[1][0] - L[1][0]) * f, base - a * H],
          [L[6][0] + (R[6][0] - L[6][0]) * f, base - (a + 0.35 + rand() * 0.25) * H],
        ]),
      )
    }
  out.push(stroke(s > 0.45 ? 'line' : 'hair', [...L, ...R.slice().reverse()].slice(0, 22)))
  // Crown: short stubby branches ending in dark tufts.
  const tx = x,
    ty = base - H
  const branches = [-0.9, -0.35, 0.25, 0.8]
  for (const [i, a] of branches.entries()) {
    const len = (10 + rand() * 6) * s * (i % 2 ? 1 : 1.2)
    const ex = tx + Math.sin(a) * len * 1.4
    const ey = ty - Math.cos(a) * len * 0.9 - 2 * s
    out.push(
      stroke(s > 0.45 ? 'line' : 'hair', [
        [tx + a * 2.4 * s, ty + 1.5 * s],
        [ex, ey],
      ]),
    )
    const rx = (6 + rand() * 1.6) * s,
      ry = 2.4 * s
    out.push(
      fill(
        Array.from({ length: 12 }, (_, k): Pt => [
          ex + Math.cos((k / 12) * Math.PI * 2) * rx,
          ey - ry * 0.4 + Math.sin((k / 12) * Math.PI * 2) * ry,
        ]),
      ),
    )
  }
}

export const baobab: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 17)))
  const cx = x + w / 2
  const hy = y + h * num(p, 'hz', 0.63)
  const bottom = y + h
  const out: SvgNode[] = []
  // Road: a paper wedge to the vanishing point with two ruts.
  const half = num(p, 'road', 30)
  const road: Pt[] = [
    [cx - 1, hy],
    [cx + 1, hy],
    [cx + half, bottom],
    [cx - half, bottom],
  ]
  out.push(occlude(road, { halo: 0 }))
  for (const k of [-0.42, 0.42])
    out.push(
      stroke('hair', [
        [cx + k * 2, hy + 1],
        [cx + k * half * 1.02, bottom],
      ]),
    )
  out.push(
    stroke('fine', [
      [cx - 1, hy],
      [cx - half, bottom],
    ]),
    stroke('fine', [
      [cx + 1, hy],
      [cx + half, bottom],
    ]),
  )
  const zs = nums(p, 'depths', [7, 4.9, 3.4, 2.35, 1.6, 1.12])
  const trees: Tree[] = []
  for (const z of zs) {
    const s = 1 / z
    const off = 46 * s + 3
    for (const side of [-1, 1])
      trees.push({
        x: cx + side * off + (rand() - 0.5) * 2 * s,
        base: hy + 30 * s + 1,
        s,
        seed: rand(),
      })
  }
  trees.sort((a, b) => a.s - b.s)
  for (const t of trees) trunk(t, out, rand)
  return out
}
