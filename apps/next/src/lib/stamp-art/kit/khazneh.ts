// Al-Khazneh, Petra: a two-storey rock-hewn facade cut into a sandstone gorge wall. Lower order of
// six columns under a central pediment and a dark doorway; upper storey with a round tholos (cone
// roof and urn) between two half-pediments. The box is the whole scene (cliff included), the
// bottom is the gorge floor; the facade takes the central `facade` share of the width.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num, str } from './util'

export const khazneh: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const base = y + h
  const fw = w * num(p, 'facade', 0.5)
  const fx = x + (w - fw) / 2
  const fy = y + h * 0.1
  const fh = base - fy
  const u = (t: number) => fx + fw * t
  const v = (s: number) => fy + fh * s
  const part = str(p, 'part', ['both', 'cliff', 'facade'] as const, 'both')
  const out: SvgNode[] = []

  // Gorge walls: a jagged crown that dips to both ends, hatched along the fall line.
  const crown: [number, number][] = [
    [0, 0.66],
    [0.1, 0.34],
    [0.22, 0.12],
    [0.34, 0.05],
    [0.5, 0.02],
    [0.66, 0.05],
    [0.78, 0.1],
    [0.9, 0.32],
    [1, 0.62],
  ]
  const top: Pt[] = []
  for (let i = 0; i + 1 < crown.length; i++) {
    const [t0, s0] = crown[i],
      [t1, s1] = crown[i + 1]
    const n = 6
    for (let k = 0; k < n; k++) {
      const t = k / n
      top.push([
        x + w * (t0 + (t1 - t0) * t),
        y + h * (s0 + (s1 - s0) * t) + (k === 0 ? 0 : (rand() - 0.5) * 2.4),
      ])
    }
  }
  top.push([x + w, y + h * crown[crown.length - 1][1]])
  const cliff: Pt[] = [[x, base], ...top, [x + w, base]]
  const cliffNodes: SvgNode[] = [occlude(cliff)]
  cliffNodes.push(...toneFill(cliff, 'T4', { angle: 87, gap: 2.8, weight: 'hair', inset: 0.5 }))
  cliffNodes.push(stroke('line', top))
  // Bedding ticks, lit and sparse.
  for (let k = 0; k < 7; k++) {
    const yy = y + h * (0.28 + 0.1 * k)
    for (let sx = x + 3 + rand() * 8; sx < x + w - 6; sx += 15 + rand() * 12) {
      if (sx > fx - 4 && sx < fx + fw + 4) continue
      cliffNodes.push(hline('hair', sx, sx + 4 + rand() * 5, yy + (rand() - 0.5)))
    }
  }
  if (part !== 'facade') out.push(...cliffNodes)

  if (part === 'cliff') return out

  // The recess the facade is cut into.
  const plate: Pt[] = [
    [u(0.02), base],
    [u(0.02), v(0.19)],
    [u(0.3), v(0.19)],
    [u(0.3), v(0.06)],
    [u(0.7), v(0.06)],
    [u(0.7), v(0.19)],
    [u(0.98), v(0.19)],
    [u(0.98), base],
  ]
  out.push(...body(plate, 'line'))

  // Upper wings: half-pediments sloping down toward the outside, hatched, with lit columns.
  for (const s of [-1, 1]) {
    const m = (t: number) => (s < 0 ? t : 1 - t)
    const wing: Pt[] = [
      [u(m(0.06)), v(0.47)],
      [u(m(0.06)), v(0.33)],
      [u(m(0.32)), v(0.2)],
      [u(m(0.32)), v(0.47)],
    ]
    out.push(...body(wing, 'line'))
    const sliver: Pt[] = [
      [u(m(0.06)), v(0.33)],
      [u(m(0.32)), v(0.2)],
      [u(m(0.32)), v(0.29)],
      [u(m(0.06)), v(0.4)],
    ]
    out.push(...toneFill(sliver, 'T4', { gap: 3.4, weight: 'fine', inset: 0.5 }))
    for (const c of [0.12, 0.25]) {
      const cx = u(m(c)) - 1.6
      out.push(...body(rectPts(cx, v(0.35), 3.2, fh * 0.12), 'hair'))
    }
  }
  // Tholos: drum, cone roof, urn.
  const dl = u(0.36),
    dr = u(0.64)
  const drum: Pt[] = rectPts(dl, v(0.27), dr - dl, fh * 0.2)
  const roof: Pt[] = [
    [dl - 1.2, v(0.27)],
    ...quad([dl - 1.2, v(0.27)], [u(0.45), v(0.2)], [u(0.5), v(0.1)], 8),
    ...quad([u(0.5), v(0.1)], [u(0.55), v(0.2)], [dr + 1.2, v(0.27)], 8),
  ]
  out.push(...body(drum, 'line'))
  out.push(...body(roof, 'line'))
  out.push(
    ...toneFill(
      [
        [u(0.5), v(0.1)],
        [dr + 1.2, v(0.27)],
        [u(0.5), v(0.27)],
      ],
      'T4',
      { angle: 70, gap: 3.6, weight: 'fine', inset: 0.3 },
    ),
  )
  out.push(
    stroke('bold', [
      [dl - 1.4, v(0.27)],
      [dr + 1.4, v(0.27)],
    ]),
  )
  // Urn.
  out.push(
    ...body(
      [
        [u(0.5) - 1, v(0.1)],
        [u(0.5) - 2.2, v(0.06)],
        [u(0.5) - 1.2, v(0.03)],
        [u(0.5) + 1.2, v(0.03)],
        [u(0.5) + 2.2, v(0.06)],
        [u(0.5) + 1, v(0.1)],
      ],
      'line',
    ),
  )
  // Tholos columns and the dark doorway.
  for (const c of [0.4, 0.6]) out.push(...body(rectPts(u(c) - 1.5, v(0.3), 3, fh * 0.17), 'hair'))
  out.push(fill(rectPts(u(0.5) - 3.4, v(0.31), 6.8, fh * 0.16)))

  // Lower storey: entablature, central pediment, six columns, dark doors.
  out.push(...body(rectPts(u(0.04), v(0.53), fw * 0.92, fh * 0.07), 'line'))
  out.push(
    stroke('bold', [
      [u(0.04), v(0.53)],
      [u(0.96), v(0.53)],
    ]),
  )
  const ped: Pt[] = [
    [u(0.26), v(0.53)],
    [u(0.5), v(0.44)],
    [u(0.74), v(0.53)],
  ]
  out.push(...body(ped, 'line'))
  out.push(
    ...toneFill(
      [
        [u(0.34), v(0.52)],
        [u(0.5), v(0.465)],
        [u(0.66), v(0.52)],
      ],
      'T4',
      { angle: 0, gap: 1.6, weight: 'fine' },
    ),
  )
  const cols = [0.14, 0.284, 0.428, 0.572, 0.716, 0.86]
  for (const c of cols) {
    out.push(
      stroke('line', [
        [u(c), v(0.6)],
        [u(c), v(0.91)],
      ]),
    )
    out.push(
      hline('line', u(c) - 3.2, u(c) + 3.2, v(0.615)),
      hline('hair', u(c) - 2.8, u(c) + 2.8, v(0.9)),
    )
  }
  out.push(fill(rectPts(u(0.5) - 3.6, v(0.72), 7.2, fh * 0.19)))
  for (const c of [0.214, 0.786]) out.push(fill(rectPts(u(c) - 2, v(0.78), 4, fh * 0.13)))
  // Steps and the gorge floor.
  out.push(hline('line', u(0.02), u(0.98), v(0.915)), hline('hair', u(0.0), u(1.0), v(0.955)))
  return out
}
