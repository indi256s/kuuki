// Cliff castle (lane C): a compact castle with a hip-roofed keep, a gabled hall and a curtain wall
// on a sheer rock face that drops into the water (Bled Castle, SI). The box base is the waterline.
import { type Pt, type SvgNode, body, fill, hatchPoly, occlude, rectPts, stroke } from '../grid'
import { mulberry32 } from '../hash'
import { type KitModule, num } from './util'
import { archPts } from './windows'

export const cliffCastle: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 11)))
  const X = (f: number) => x + f * w
  const Y = (f: number) => y + f * h
  const out: SvgNode[] = []
  // rock: sheer on the right, stepped slope on the left
  const prof: [number, number][] = [
    [0.04, 1],
    [0.12, 0.84],
    [0.16, 0.7],
    [0.2, 0.6],
    [0.32, 0.56],
    [0.5, 0.55],
    [0.7, 0.56],
    [0.76, 0.66],
    [0.74, 0.8],
    [0.78, 1],
  ]
  const edge: Pt[] = []
  prof.forEach(([fx, fy], i) => {
    const n = i === 0 ? 1 : 3
    const [px, py] = i === 0 ? prof[0] : prof[i - 1]
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const jag = k < n ? (rand() - 0.5) * 3 : 0
      edge.push([X(px + (fx - px) * t) + jag, Y(py + (fy - py) * t)])
    }
  })
  const rock: Pt[] = [...edge]
  out.push(occlude(rock), stroke('line', edge))
  const shade: Pt[] = edge.filter(([px]) => px > X(0.46))
  const shadePoly: Pt[] = [[X(0.46), Y(0.55)], ...shade, [X(0.78), Y(1)], [X(0.46), Y(1)]]
  out.push(...hatchPoly(shadePoly, { angle: 90, gap: 2.8, weight: 'hair' }))
  // bedding ticks on the lit side
  for (let i = 0; i < 9; i++) {
    const ty = Y(0.66 + i * 0.04)
    const tx = X(0.14 + rand() * 0.14)
    out.push(
      stroke('hair', [
        [tx, ty],
        [tx + 5 + rand() * 6, ty + 1.2],
      ]),
    )
  }
  const base = Y(0.55)
  // curtain wall
  const wallTop = base - h * 0.12
  out.push(...body(rectPts(X(0.2), wallTop, X(0.7) - X(0.2), base - wallTop + 1), 'line'))
  for (let mx = X(0.2); mx < X(0.7) - 3; mx += 5)
    out.push(...body(rectPts(mx, wallTop - 2.2, 3, 2.2), 'hair'))
  // hall with gable roof
  const hx = X(0.3)
  const hw = X(0.56) - X(0.3)
  const hTop = wallTop - h * 0.16
  out.push(...body(rectPts(hx, hTop, hw, wallTop - hTop + 1), 'line'))
  const roof: Pt[] = [
    [hx - 1.5, hTop],
    [hx + 3, hTop - h * 0.13],
    [hx + hw - 3, hTop - h * 0.13],
    [hx + hw + 1.5, hTop],
  ]
  out.push(occlude(roof), fill(roof))
  for (let i = 0; i < 3; i++) out.push(fill(archPts(hx + 4 + i * (hw / 3.2), hTop + 3, 3, 6)))
  // keep: tall square tower with a hip cap
  const kx = X(0.58)
  const kw = X(0.68) - X(0.58)
  const kTop = Y(0.2)
  out.push(...body(rectPts(kx, kTop, kw, wallTop - kTop + 1), 'line'))
  out.push(
    ...hatchPoly(rectPts(kx + kw * 0.62, kTop + 1, kw * 0.38, wallTop - kTop - 1), {
      angle: 90,
      gap: 2.2,
      weight: 'hair',
    }),
  )
  const cap: Pt[] = [
    [kx - 1.6, kTop],
    [kx + kw / 2 - 1, y + 2],
    [kx + kw / 2 + 1, y + 2],
    [kx + kw + 1.6, kTop],
  ]
  out.push(occlude(cap), fill(cap))
  out.push(
    fill(archPts(kx + kw * 0.2, kTop + 5, 3, 7)),
    fill(archPts(kx + kw * 0.2, kTop + 20, 3, 7)),
  )
  // west tower with a cone
  const tx = X(0.2)
  const tw = 9
  const tTop = Y(0.38)
  out.push(...body(rectPts(tx, tTop, tw, wallTop - tTop + 1), 'line'))
  const cone: Pt[] = [
    [tx - 1.4, tTop],
    [tx + tw / 2, tTop - tw * 1.1],
    [tx + tw + 1.4, tTop],
  ]
  out.push(occlude(cone), fill(cone))
  out.push(fill(rectPts(tx + 3.5, tTop + 5, 2, 5)))
  return out
}
