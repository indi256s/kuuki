// Layered rock mass (lane A, `-a` until consolidated): a cliff or massif whose top edge is a
// `profile` of [x, y] fractions of the box, foot on the box bottom. The lit side is bare paper (or
// diagonal T2 with `lit: "T2"`) with broken horizontal strata and a few fracture zigzags; the shaded
// zones `shade: [[x0, x1], ...]` are T4 verticals that stop at every stratum, so the dark side reads
// as stacked ledges and never as a curtain. One bold ledge line closes the foot.
import { mulberry32 } from '../hash'
import { clipStrokeOutside } from '../geom'
import { type Pt, type StrokeNode, type SvgNode, hatchPoly, occlude, stroke } from '../grid'
import { type KitModule, num, nums, pairs, str } from './util'

/** Highest y of a polyline (sorted by x ascending) at x. */
function topAt(line: Pt[], px: number): number {
  let best = Infinity
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (px >= Math.min(a[0], b[0]) && px <= Math.max(a[0], b[0])) {
      const yy =
        a[0] === b[0] ? Math.min(a[1], b[1]) : a[1] + ((px - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
      if (yy < best) best = yy
    }
  }
  return best === Infinity ? line[line.length - 1][1] : best
}

export const cliffA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const crag = num(p, 'crag', 1)
  const coarse = pairs(p, 'profile', [
    [0, 1],
    [0.1, 0.1],
    [0.9, 0],
    [1, 1],
  ]).map(([fx, fy]): Pt => [x + w * fx, y + h * fy])
  const top: Pt[] = [coarse[0]]
  for (let i = 1; i < coarse.length; i++) {
    const a = coarse[i - 1],
      b = coarse[i]
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6))
    for (let k = 1; k < steps; k++) {
      const t = k / steps
      top.push([
        a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * 1.4 * crag,
        a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 2 * crag,
      ])
    }
    top.push(b)
  }
  const poly: Pt[] = [...top, [top[top.length - 1][0], base], [top[0][0], base]]
  const out: SvgNode[] = [occlude(poly)]
  const gap = num(p, 'strata', 7)
  // Stratum levels (y), wavering slightly with x so the ledges are not ruled lines.
  const levelAt = (k: number, px: number) =>
    base - (k + 1) * gap + Math.sin(px * 0.045 + k * 2.1) * 1.1
  const shade = nums(p, 'shade', [])
  const inShade = (px: number) => {
    for (let i = 0; i + 1 < shade.length; i += 2)
      if (px >= x + w * shade[i] && px <= x + w * shade[i + 1]) return true
    return false
  }
  const acc: StrokeNode[] = []
  // Lit hatch (optional T2 diagonals) over the whole mass; shaded zones overwrite by occlusion later.
  const lit = str(p, 'lit', ['paper', 'T2'] as const, 'paper')
  if (lit === 'T2') {
    let hat: StrokeNode[] = hatchPoly(poly, {
      angle: -58,
      gap: num(p, 'litGap', 3),
      weight: 'fine',
      inset: 0.5,
    })
    for (let i = 0; i + 1 < shade.length; i += 2) {
      const x0 = x + w * shade[i],
        x1 = x + w * shade[i + 1]
      const sp: Pt[] = [
        [x0, base + 1],
        [x0, topAt(top, x0) - 1],
        ...top.filter(([tx]) => tx > x0 && tx < x1),
        [x1, topAt(top, x1) - 1],
        [x1, base + 1],
      ]
      hat = hat.flatMap((n) => clipStrokeOutside(n, sp))
    }
    acc.push(...hat)
  }
  // Shaded zones: T4 verticals broken at each stratum.
  const colGap = num(p, 'shadeGap', 2.4)
  for (let px = x + 1; px < x + w; px += colGap) {
    if (!inShade(px)) continue
    const ty = topAt(top, px) + 1.6
    const cuts: number[] = []
    for (let k = 0; ; k++) {
      const ly = levelAt(k, px)
      if (ly <= ty + 2) break
      cuts.push(ly)
    }
    const ys = [ty, ...cuts.slice().reverse(), base]
    for (let i = 0; i + 1 < ys.length; i++) {
      const a = ys[i] + (i === 0 ? 0 : 0.9)
      const b = ys[i + 1] - (i + 1 === ys.length - 1 ? 0 : 0.9)
      if (b - a > 1.6)
        acc.push(
          stroke('hair', [
            [px, a],
            [px, b],
          ]),
        )
    }
  }
  // Strata on the lit side: broken horizontal ticks following each ledge level.
  for (let k = 0; k < Math.ceil(h / gap); k++) {
    let px = x + 2 + rand() * 6
    while (px < x + w - 3) {
      const len = 5 + rand() * 13
      const ly = levelAt(k, px)
      if (!inShade(px) && !inShade(px + len) && ly > topAt(top, px + len / 2) + 4) {
        acc.push(
          stroke('fine', [
            [px, ly],
            [px + len, levelAt(k, px + len)],
          ]),
        )
      }
      px += len + 3 + rand() * 9
    }
  }
  // Fracture zigzags on the lit side.
  const fractures = Math.round(num(p, 'fractures', 3))
  for (let f = 0; f < fractures; f++) {
    const fx = x + w * (0.1 + rand() * 0.8)
    if (inShade(fx)) continue
    const fy0 = topAt(top, fx) + 6 + rand() * 6
    if (fy0 > base - 14) continue
    const pts: Pt[] = [[fx, fy0]]
    for (let i = 1; i <= 3; i++)
      pts.push([fx + (rand() - 0.5) * 5, Math.min(base - 3, fy0 + i * (4 + rand() * 4))])
    acc.push(stroke('hair', pts))
  }
  out.push(...acc)
  if (num(p, 'outline', 1)) out.push(stroke('line', top))
  out.push(
    stroke('bold', [
      [x, base],
      [x + w, base],
    ]),
  )
  return out
}
