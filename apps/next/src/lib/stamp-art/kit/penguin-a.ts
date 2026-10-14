// Two gentoo penguins on a low rock with tussac tufts. The box is the whole group: rock at the
// foot, birds upright on it, the left bird taller and facing right, the right bird facing left.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatch, occlude, quad, stroke } from '../grid'
import { type KitModule, num } from './util'

function bird(cx: number, base: number, H: number, dir: 1 | -1): SvgNode[] {
  const half: Pt[] = [
    [0, -1],
    [0.09, -0.98],
    [0.13, -0.9],
    [0.14, -0.8],
    [0.21, -0.6],
    [0.23, -0.4],
    [0.2, -0.18],
    [0.13, -0.04],
    [0.09, 0],
  ]
  const pts: Pt[] = [
    ...half.map(([fx, fy]): Pt => [cx + fx * H, base + fy * H]),
    ...half
      .slice()
      .reverse()
      .map(([fx, fy]): Pt => [cx - fx * H, base + fy * H]),
  ]
  const out: SvgNode[] = [...body(pts, 'line')]
  const P = (fx: number, fy: number): Pt => [cx + dir * fx * H, base + fy * H]
  // Dark back: the side away from the facing direction, head to tail.
  const back: Pt[] = [
    P(-0.0, -1),
    P(-0.09, -0.98),
    P(-0.13, -0.9),
    P(-0.14, -0.8),
    P(-0.21, -0.6),
    P(-0.23, -0.4),
    P(-0.2, -0.18),
    P(-0.13, -0.04),
    P(-0.1, 0),
    P(-0.14, -0.2),
    P(-0.17, -0.5),
    P(-0.11, -0.78),
    P(-0.07, -0.88),
    P(0, -0.93),
  ]
  out.push(fill(back))
  // Head cap (dark) with a paper eye patch, then the bill.
  const cap: Pt[] = [
    P(-0.09, -0.98),
    P(0, -1),
    P(0.09, -0.98),
    P(0.13, -0.9),
    P(0.12, -0.86),
    P(-0.12, -0.86),
  ]
  out.push(fill(cap))
  const eye = P(0.05, -0.92)
  out.push(
    ...body(
      [
        [eye[0] - 1, eye[1] - 0.9],
        [eye[0] + 1, eye[1] - 0.9],
        [eye[0] + 1, eye[1] + 0.9],
        [eye[0] - 1, eye[1] + 0.9],
      ],
      'hair',
    ),
  )
  out.push(...body([P(0.12, -0.87), P(0.27, -0.84), P(0.12, -0.8)], 'line'))
  // Flipper hanging on the near side.
  const fl: Pt[] = [P(0.02, -0.64), P(-0.01, -0.44), P(0.03, -0.32), P(0.09, -0.4), P(0.1, -0.6)]
  out.push(fill(fl))
  // Feet.
  out.push(fill([P(-0.14, 0.01), P(0.0, 0.01), P(0.03, -0.03), P(-0.12, -0.03)]))
  out.push(fill([P(0.02, 0.01), P(0.17, 0.01), P(0.14, -0.03), P(0.0, -0.03)]))
  return out
}

export const penguinA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const rockH = h * num(p, 'rock', 0.2)
  const out: SvgNode[] = []
  // Rock: a low rounded mound across the box.
  const rock: Pt[] = [[x, base]]
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    rock.push([
      x + w * t,
      base - rockH * Math.pow(Math.sin(Math.PI * t), 0.6) * (0.75 + 0.25 * Math.sin(t * 9)),
    ])
  }
  rock.push([x + w, base])
  out.push(...body(rock, 'line'))
  out.push(...hatch(rock, 'v', 2.6, 'hair', 0.6, 0.3))
  const topAt = (px: number) => {
    const t = (px - x) / w
    return (
      base -
      rockH *
        Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.6) *
        (0.75 + 0.25 * Math.sin(t * 9))
    )
  }
  const H1 = (h - rockH) * 0.98
  const H2 = H1 * 0.84
  const x1 = x + w * 0.4
  const x2 = x + w * 0.64
  out.push(...bird(x1, topAt(x1) + 1, H1, 1))
  out.push(...bird(x2, topAt(x2) + 1, H2, -1))
  // Tussac tufts left and right: fans of curved blades.
  for (const tx of [x + w * 0.08, x + w * 0.86, x + w * 0.95]) {
    const ty = topAt(tx) + 2
    out.push(
      occlude([
        [tx - 6, ty],
        [tx, ty - 11],
        [tx + 6, ty],
      ]),
    )
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + i * 0.3
      const len = 8 + rand() * 4
      out.push(
        stroke(
          'hair',
          quad(
            [tx, ty],
            [tx + Math.sin(a) * len * 0.3, ty - len * 0.8],
            [tx + Math.sin(a) * len, ty - len * 0.6],
            5,
          ),
        ),
      )
    }
  }
  return out
}
