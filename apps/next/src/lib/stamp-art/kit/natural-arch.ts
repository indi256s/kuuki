// Ennedi sandstone arch: a massive eroded pier-and-span with a flat-ish top, bedding lines
// across the face, a shaded right pier and a skirt of sand. The opening shows the backdrop.
// The box bottom is the sand line.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const naturalArch: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const holeL = x + w * num(p, 'holeL', 0.3)
  const holeR = x + w * num(p, 'holeR', 0.66)
  const holeTop = y + h * num(p, 'holeTop', 0.4)
  const tower = (t: number, c: number, wd: number) => Math.max(0, 1 - Math.abs(t - c) / wd) ** 0.4
  const topAt = (t: number) =>
    y +
    h *
      (0.2 +
        0.04 * Math.sin(t * 7) -
        0.07 * tower(t, 0.14, 0.08) -
        0.16 * tower(t, 0.5, 0.25) -
        0.05 * tower(t, 0.86, 0.08))
  const outer: Pt[] = [
    [x, base - 2],
    [x + w * 0.05, y + h * 0.62],
    [x + w * 0.04, y + h * 0.4],
  ]
  for (let i = 0; i <= 40; i++)
    outer.push([x + w * (0.05 + (0.9 * i) / 40), topAt(0.05 + (0.9 * i) / 40) + (rand() - 0.5)])
  outer.push([x + w * 0.95, y + h * 0.4], [x + w * 0.96, y + h * 0.65], [x + w, base - 2])
  outer.push([x + w, base], [holeR + 3, base])
  const inner: Pt[] = [
    [holeR + 2, base - 5],
    [holeR - 1, holeTop + h * 0.3],
    ...quad(
      [holeR, holeTop + h * 0.15],
      [holeR - 3, holeTop - 2],
      [(holeL + holeR) / 2 + 2, holeTop - 4],
      8,
    ),
    ...quad(
      [(holeL + holeR) / 2 + 2, holeTop - 4],
      [holeL + 2, holeTop - 3],
      [holeL, holeTop + h * 0.2],
      8,
    ),
    [holeL - 2, base - 5],
  ]
  const poly: Pt[] = [...outer, ...inner, [holeL - 3, base], [x, base]]
  const out: SvgNode[] = [occlude(poly)]
  out.push(stroke('line', outer.slice(0, outer.length - 2)))
  out.push(stroke('line', inner))
  // Bedding lines across both piers and the span.
  for (let k = 1; k < 8; k++) {
    const yy = y + h * (0.22 + 0.09 * k)
    const segs: [number, number][] =
      yy > holeTop + 2
        ? [
            [x + 3, holeL - 2],
            [holeR + 2, x + w - 3],
          ]
        : [[x + 3, x + w - 3]]
    for (const [a, b] of segs)
      for (let sx = a + rand() * 6; sx < b - 4; sx += 14 + rand() * 12)
        out.push(hline('hair', sx, Math.min(b, sx + 8 + rand() * 12), yy + (rand() - 0.5) * 1.2))
  }
  // Shaded right pier and the underside of the span.
  const shade: Pt[] = [
    [holeR + 3, holeTop + h * 0.12],
    [x + w * 0.95, y + h * 0.4],
    [x + w * 0.96, y + h * 0.65],
    [x + w, base - 2],
    [holeR + 2, base - 5],
  ]
  out.push(...toneFill(shade, 'T4', { angle: 86, gap: 2.2, weight: 'fine', inset: 0.5 }))
  const under: Pt[] = quad(
    [holeL, holeTop + 2],
    [(holeL + holeR) / 2, holeTop - 6],
    [holeR, holeTop + 2],
    10,
  )
  out.push(
    ...toneFill([...under, [holeR - 2, holeTop - 6], [holeL + 2, holeTop - 6]], 'T4', {
      gap: 1.8,
      weight: 'fine',
    }),
  )
  // Sand skirt with wind ripples.
  for (let k = 0; k < 4; k++)
    for (let sx = x + rand() * 6; sx < x + w - 6; sx += 10 + rand() * 10)
      out.push(hline('hair', sx, sx + 5 + rand() * 8, base - 1 - k * 2.2))
  return out
}
