// Charyn Canyon (Kazakhstan): a wide river canyon cut into layered sandstone. Both walls descend
// in benches (a cliff face, then a ledge), the rim is crowned with eroded fins, the lit left wall
// carries horizontal strata, the right wall is shaded. A flat far mesa shows down the valley and a
// dark tree band follows the river. The box bottom is the valley floor.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const charyn: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const base = y + h
  const floor = y + h * 0.9
  const cx = x + w * num(p, 'axis', 0.5)
  const rim = w * num(p, 'rim', 0.38)
  const foot = w * num(p, 'foot', 0.1)
  const benches = Math.round(num(p, 'benches', 5))
  const top = y + 6
  const out: SvgNode[] = []
  const stair = (s: -1 | 1): Pt[] => {
    const pts: Pt[] = []
    const dy = (floor - top) / benches
    for (let k = 0; k < benches; k++) {
      const g0 = foot + (rim - foot) * (1 - k / benches) ** 1.15
      const g1 = foot + (rim - foot) * (1 - (k + 1) / benches) ** 1.15
      const ty = top + dy * k + (rand() - 0.5) * 1.2
      pts.push(
        [cx + s * g0, ty],
        [cx + s * g0, ty + dy * 0.82],
        [cx + s * g1, ty + dy * 0.82 + 1.6],
      )
    }
    pts.push([cx + s * foot, floor], [cx + s * foot * 1.6, base])
    return pts
  }
  // Far mesa down the valley.
  const mesaTop = y + h * 0.5
  const mesa: Pt[] = [
    [cx - rim * 0.8, floor],
    [cx - rim * 0.62, mesaTop + 3],
    [cx - rim * 0.5, mesaTop],
    [cx + rim * 0.5, mesaTop + 1],
    [cx + rim * 0.64, mesaTop + 4],
    [cx + rim * 0.8, floor],
  ]
  out.push(occlude(mesa), ...toneFill(mesa, 'T2', { inset: 0.6 }), stroke('hair', mesa.slice(1, 5)))
  const wall = (s: -1 | 1) => {
    const edge = stair(s)
    const outerX = s < 0 ? x : x + w
    // Rim: eroded fins rising from a gently falling plateau line.
    const ridge: Pt[] = []
    const fins = [0.06, 0.2, 0.36].map((u) => u + (rand() - 0.5) * 0.05)
    for (let i = 0; i <= 40; i++) {
      const u = i / 40
      let ry = top + h * num(p, 'drop', 0.42) * u
      for (const c of fins) ry -= 8 * Math.max(0, 1 - Math.abs(u - c) / 0.035) ** 1.2
      ridge.push([edge[0][0] + (outerX - edge[0][0]) * u, ry + (rand() - 0.5) * 0.8])
    }
    const poly: Pt[] = [[outerX, base], ...ridge.slice().reverse(), ...edge]
    out.push(occlude(poly))
    return { edge, ridge, outerX }
  }
  const L = wall(-1)
  const R = wall(1)
  // Strata: horizontal ticks across both walls, from the circle-safe outer limit to each face.
  const yOnRidge = (r: Pt[], px: number) => {
    for (let i = 0; i + 1 < r.length; i++) {
      const [a, b] = [r[i], r[i + 1]]
      if ((a[0] - px) * (b[0] - px) <= 0)
        return a[1] + ((px - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
    }
    return r[r.length - 1][1]
  }
  const edgeX = (edge: Pt[], yy: number) => {
    for (let i = 0; i + 1 < edge.length; i++) {
      const [a, b] = [edge[i], edge[i + 1]]
      if ((a[1] - yy) * (b[1] - yy) <= 0 && a[1] !== b[1])
        return a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
    }
    return edge[edge.length - 1][0]
  }
  const safe = num(p, 'safe', 66)
  const lit = (
    s: -1 | 1,
    W: { edge: Pt[]; ridge: Pt[]; outerX: number },
    from: number,
    to: number,
  ) => {
    for (let yy = top + 7; yy < floor - 2; yy += 3.6) {
      const chord = Math.sqrt(Math.max(0, safe * safe - (yy - 100) ** 2))
      const xe = edgeX(W.edge, yy)
      const x1 = s < 0 ? Math.max(W.outerX + 3, 100 - chord + 2) : xe + (W.outerX - xe) * from
      const x2 = s < 0 ? xe - 1.5 : Math.min(xe + (W.outerX - xe) * to, 100 + chord - 2)
      if (x2 - x1 < 4) continue
      const ry = yOnRidge(W.ridge, s < 0 ? x1 : x2)
      if (yy < ry + 3) continue
      out.push(
        stroke('fine', [
          [x1, yy],
          [x2, yy + (rand() - 0.5) * 0.8],
        ]),
      )
    }
  }
  lit(-1, L, 0, 1)
  lit(1, R, 0.5, 1)
  // Shaded right wall: dark close to the canyon edge.
  const reach = 0.5
  const shade: Pt[] = [
    ...R.edge,
    [R.edge[R.edge.length - 1][0] + (R.outerX - cx) * reach, base],
    [R.edge[0][0] + (R.outerX - R.edge[0][0]) * reach, top + h * 0.08],
    ...R.ridge.filter((q) => q[0] <= R.edge[0][0] + (R.outerX - R.edge[0][0]) * reach).reverse(),
  ]
  out.push(...toneFill(shade, 'T4', { inset: 0.5, gap: [2.3, 2.3] }))
  out.push(
    stroke('line', [...L.ridge, ...L.edge.slice(0, -1)]),
    stroke('line', [...R.ridge, ...R.edge.slice(0, -1)]),
  )
  // Ledge lines.
  for (const W of [L, R]) {
    for (let k = 0; k < benches; k++) {
      const a = W.edge[k * 3 + 1]
      const b = W.edge[k * 3 + 2]
      out.push(
        stroke('bold', [
          [a[0], a[1]],
          [b[0], b[1]],
        ]),
      )
    }
  }
  // River tree band and the valley baseline.
  const bank: Pt[] = [[cx - foot * 1.6, floor - 1]]
  for (let i = 0; i <= 10; i++)
    bank.push([cx - foot * 1.6 + (foot * 3.2 * i) / 10, floor - 2.5 - rand() * 1.5])
  bank.push(
    [cx + foot * 1.6, floor - 1],
    [cx + foot * 1.6, floor + 1],
    [cx - foot * 1.6, floor + 1],
  )
  out.push(occlude(bank), ...toneFill(bank, 'T4', { inset: 0.3, gap: [2, 2] }))
  out.push(hline('bold', x, x + w, base))
  return out
}
