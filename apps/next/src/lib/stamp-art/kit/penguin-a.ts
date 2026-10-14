// Gentoo profiles: dark backs, long stiff tails and clear white eye patches.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import type { KitModule } from './util'

export function penguinProfile(
  cx: number,
  base: number,
  h: number,
  dir: number,
  king = false,
): SvgNode[] {
  const P = (a: number, b: number): Pt => [cx + dir * a * h, base + b * h]
  const outline = [
    P(-0.18, 0),
    P(-0.27, -0.22),
    P(-0.24, -0.58),
    P(-0.14, -0.8),
    P(-0.13, -0.93),
    P(-0.04, -1),
    P(0.09, -0.99),
    P(0.17, -0.91),
    P(0.15, -0.8),
    P(0.2, -0.6),
    P(0.22, -0.3),
    P(0.12, -0.04),
  ]
  const back = [
    P(-0.18, 0),
    P(-0.27, -0.22),
    P(-0.24, -0.58),
    P(-0.14, -0.8),
    P(-0.04, -0.8),
    P(-0.13, -0.6),
    P(-0.16, -0.3),
    P(-0.13, -0.04),
  ]
  const out: SvgNode[] = [...body(outline, 'hair'), fill(back)]
  // The eye patch is a real gap between the cap and cheek fills, not white paint.
  out.push(
    fill([
      P(-0.14, -0.8),
      P(-0.13, -0.93),
      P(-0.04, -1),
      P(0.09, -0.99),
      P(0.17, -0.91),
      P(0.09, -0.95),
      P(-0.01, -0.94),
      P(-0.03, -0.87),
    ]),
  )
  out.push(fill([P(-0.03, -0.87), P(0.08, -0.89), P(0.16, -0.86), P(0.15, -0.8), P(-0.04, -0.8)]))
  out.push(fill([P(0.14, -0.91), P(0.32, -0.88), P(0.14, -0.84)]))
  out.push(fill([P(-0.18, -0.2), P(-0.42, -0.05), P(-0.13, -0.06)]))
  out.push(fill([P(-0.02, -0.68), P(0.06, -0.61), P(0.32, -0.33), P(0.25, -0.3), P(0.02, -0.48)]))
  out.push(fill([P(-0.14, 0), P(0.23, 0.02), P(0.16, -0.04)]))
  if (king) out.push(stroke('fine', [P(0.11, -0.78), P(0.14, -0.62)]))
  return out
}

export const penguinA: KitModule = ([x, y, w, h]) => {
  const ground = rectPts(x, y + h * 0.8, w, h * 0.2)
  const out: SvgNode[] = [occlude(ground), ...toneFill(ground, 'T1', { gap: 4.2, weight: 'fine' })]
  for (const [u, s, dir] of [
    [0.27, 0.88, 1],
    [0.58, 1, -1],
    [0.82, 0.72, 1],
  ]) {
    out.push(...penguinProfile(x + w * u, y + h - 2, h * 0.82 * s, dir))
  }
  for (const tx of [x + 4, x + w * 0.45, x + w - 2]) {
    for (let k = 0; k < 5; k++)
      out.push(
        stroke('hair', [
          [tx, y + h - 3],
          [tx + (k - 2) * 2, y + h - 12 - (k % 2) * 3],
        ]),
      )
  }
  out.push(hline('hair', x, x + w, y + h))
  return out
}
