// Machu Picchu terraces: a ridge saddle stepped into stone terrace walls that follow the slope,
// a paper stair cutting down through them and small roofed trapezoid-doored huts along the
// ridge. The box is the whole hillside; the bottom is the ground line. `huts` lists hut x
// fractions, `stairX` the stair position.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatch, occlude, stroke, toneFill } from '../grid'
import { type KitModule, nums, num, weight } from './util'

function yAtX(line: Pt[], x: number): number {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (a[0] <= x && x <= b[0])
      return b[0] === a[0] ? a[1] : a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
  }
  return x < line[0][0] ? line[0][1] : line[line.length - 1][1]
}

export const terracesA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const base = y + h
  const tiers = Math.max(3, Math.round(num(p, 'tiers', 4)))
  const ridge: Pt[] = [
    [x, y + h * 0.5],
    [x + w * 0.25, y + h * 0.32],
    [x + w * 0.6, y + h * 0.26],
    [x + w, y + h * 0.4],
  ]
  const tierH = (base - (y + h * 0.42)) / tiers
  const wallH = tierH * 0.6
  const stairX = x + w * num(p, 'stairX', 0.52)
  const out: SvgNode[] = []
  const xs: number[] = []
  for (let px = x; px <= x + w + 0.1; px += 3) xs.push(px)
  // Hillside body above the first wall.
  const hill: Pt[] = [...ridge, [x + w, base], [x, base]]
  out.push(occlude(hill))
  out.push(stroke('line', ridge))
  for (let t = 0; t < tiers; t++) {
    const off = (px: number) => yAtX(ridge, px) + 4 + t * tierH + Math.sin(px * 0.11 + t) * 0.8
    const topL = xs.map((px): Pt => [px, off(px)])
    const botL = xs.map((px): Pt => [px, off(px) + wallH]).reverse()
    const band: Pt[] = [...topL, ...botL]
    // Flat: horizontal fine hatching up to the next wall; wall face: vertical hair, bold top.
    out.push(occlude(band))
    out.push(...hatch(band, 'v', 4.2, 'fine', 0.6, 0.3))
    out.push(stroke(weight(p, 'wallWeight', 'bold'), topL))
  }
  // Stair: a paper strip descending along the whole slope with step ticks.
  const sTop = yAtX(ridge, stairX)
  const lean = 5
  const stair: Pt[] = [
    [stairX - 2.6, sTop + 3],
    [stairX + 2.6, sTop + 3],
    [stairX + 2.6 + lean, base],
    [stairX - 2.6 + lean, base],
  ]
  out.push(
    occlude(stair),
    stroke('hair', [stair[0], stair[3]]),
    stroke('hair', [stair[1], stair[2]]),
  )
  for (let sy = sTop + 6; sy < base - 1; sy += 2.8) {
    const f = (sy - sTop - 3) / (base - sTop - 3)
    out.push(
      stroke('hair', [
        [stairX - 2.6 + lean * f, sy],
        [stairX + 2.6 + lean * f, sy],
      ]),
    )
  }
  // Huts on the ridge: battered trapezoid walls, a dark trapezoid door, steep thatched gable.
  const huts = nums(p, 'huts', [0.18, 0.36, 0.7, 0.86])
  huts.forEach((hf, i) => {
    const hw = 11 + (i % 2) * 4
    const hx = x + w * hf - hw / 2
    const gy = yAtX(ridge, hx + hw / 2) + 3
    const wh = 6 + (i % 2) * 1.6
    const wall: Pt[] = [
      [hx, gy],
      [hx + 1, gy - wh],
      [hx + hw - 1, gy - wh],
      [hx + hw, gy],
    ]
    const roof: Pt[] = [
      [hx - 1.4, gy - wh + 0.4],
      [hx + hw / 2, gy - wh - hw * 0.55],
      [hx + hw + 1.4, gy - wh + 0.4],
    ]
    out.push(...body(wall, 'line'), ...body(roof, 'line'))
    out.push(...toneFill(roof, 'T4', { gap: 1.9, inset: 0.5 }))
    const dx = hx + hw / 2
    out.push(
      fill([
        [dx - 1.9, gy],
        [dx - 1.2, gy - wh * 0.7],
        [dx + 1.2, gy - wh * 0.7],
        [dx + 1.9, gy],
      ]),
    )
  })
  // A touch of rubble along the foot.
  for (let i = 0; i < 6; i++) {
    const px = x + 4 + rand() * (w - 8)
    out.push(
      stroke('hair', [
        [px, base - 1],
        [px + 3 + rand() * 3, base - 1],
      ]),
    )
  }
  return out
}
