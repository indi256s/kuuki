// Great Zimbabwe: the long dry-stone Great Enclosure wall with its chevron band under the coping,
// and the solid conical tower standing in front. Courses are drawn as slightly bowed lines.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const greatZimbabwe: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const out: SvgNode[] = []
  const wallTop = y + h * num(p, 'wallTop', 0.42)
  const sag = (px: number): number => Math.sin(((px - x) / w) * Math.PI) * -3
  // Enclosure wall: a long coursed mass, lit on the left, shaded to the right end.
  const top: Pt[] = []
  for (let px = x; px <= x + w + 0.01; px += 6)
    top.push([px, wallTop + sag(px) + (rand() - 0.5) * 0.8])
  const wall: Pt[] = [...top, [x + w, base], [x, base]]
  out.push(occlude(wall, { halo: 1 }))
  for (let cy = wallTop + 3.4, k = 0; cy < base - 2; cy += 3.4 + k * 0.05, k++) {
    if (k === 1 || k === 2) continue
    const line: Pt[] = []
    for (let px = x; px <= x + w + 0.01; px += 8)
      line.push([px, cy + sag(px) * 0.8 + (rand() - 0.5) * 0.5])
    out.push(stroke('fine', line))
  }
  // Chevron band: two opposed zig-zags between courses 1 and 3.
  const zig = (y0: number, dir: number): Pt[] => {
    const pts: Pt[] = []
    for (let px = x, i = 0; px <= x + w + 0.01; px += 2.6, i++)
      pts.push([px, y0 + sag(px) * 0.9 + (i % 2 ? dir * 1.5 : -dir * 1.5)])
    return pts
  }
  out.push(stroke('fine', zig(wallTop + 6.2, 1)), stroke('fine', zig(wallTop + 8.2, -1)))
  // Shaded right end of the wall.
  const shade: Pt[] = [
    [x + w * 0.78, wallTop + sag(x + w * 0.78)],
    ...top.filter((q) => q[0] > x + w * 0.78),
    [x + w, base],
    [x + w * 0.74, base],
  ]
  out.push(...toneFill(shade, 'T4', { angle: 60, gap: 3.2, weight: 'fine', inset: 0.5 }))
  out.push(
    stroke('line', top),
    stroke(
      'hair',
      top.map(([px, py]) => [px, py + 1.8] as Pt),
    ),
  )
  // Loose boulders along the wall foot.
  for (const [bx, bw] of [
    [x + w * 0.1, 7],
    [x + w * 0.82, 9],
    [x + w * 0.93, 6],
  ]) {
    const r: Pt[] = quad([bx - bw, base], [bx, base - bw * 1.1], [bx + bw, base], 8)
    out.push(
      occlude(r, { halo: 0.8 }),
      stroke('hair', r, true),
      stroke('fine', [
        [bx - 1, base - bw * 0.5],
        [bx + bw * 0.6, base - bw * 0.35],
      ]),
    )
  }
  // Conical tower in front.
  const tx = x + w * num(p, 'towerAt', 0.4)
  const bw = w * 0.115,
    tw = w * 0.08,
    tTop = y + 9
  const L = (t: number): Pt => [tx - (bw + (tw - bw) * t), base - t * (base - tTop - 6)]
  const R = (t: number): Pt => [tx + (bw + (tw - bw) * t), base - t * (base - tTop - 6)]
  const left: Pt[] = Array.from({ length: 9 }, (_, i) => L(i / 8))
  const right: Pt[] = Array.from({ length: 9 }, (_, i) => R(i / 8))
  const cap: Pt[] = quad(R(1), [tx, tTop - 5], L(1), 12)
  const body: Pt[] = [...left, ...cap, ...right.slice().reverse()]
  out.push(occlude(body, { halo: 1.6 }))
  for (let t = 0.08; t < 0.97; t += 0.075) {
    const a = L(t),
      b = R(t)
    out.push(stroke('fine', quad(a, [tx, a[1] + 1.8], b, 8)))
  }
  const inner = (t: number): Pt => [tx + (bw + (tw - bw) * t) * 0.2, L(t)[1]]
  const lit: Pt[] = Array.from({ length: 9 }, (_, i) => inner(i / 8))
  const shaded: Pt[] = [...lit, ...right.slice().reverse()]
  out.push(...toneFill(shaded, 'T4', { angle: 84, gap: 2.2, weight: 'hair', inset: 0.3 }))
  out.push(stroke('line', [...left, ...cap, ...right.slice().reverse()]))
  out.push(hline('bold', tx - bw - 2, tx + bw + 2, base))
  return out
}
