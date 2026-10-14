// Qasr al-Farid, Hegra: a single free-standing sandstone block in the desert with a Nabataean tomb
// facade carved high in its face: four pilasters under an entablature and a pediment, a central
// doorway. The lower third is left as raw rock. The block's right flank is shaded in vertical
// hatching, low outcrops flank its foot. The box is the block; the bottom is the desert floor.
import { mulberry32 } from '../hash'
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
import { type KitModule, num } from './util'

const CROWN: [number, number][] = [
  [0.0, 1],
  [0.0, 0.52],
  [0.04, 0.32],
  [0.1, 0.22],
  [0.13, 0.13],
  [0.3, 0.11],
  [0.34, 0.05],
  [0.62, 0.04],
  [0.66, 0.1],
  [0.86, 0.13],
  [0.9, 0.28],
  [0.98, 0.42],
  [1.0, 1],
]

export const qasrFarid: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 8)))
  const base = y + h
  const out: SvgNode[] = []
  // Low outcrops behind the block's feet (drawn first so the block occludes them).
  for (const [t0, t1, s] of [
    [-0.12, 0.14, 0.15],
    [0.86, 1.1, 0.13],
  ] as const) {
    const m: Pt[] = [[x + w * t0, base]]
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      m.push([
        x + w * (t0 + (t1 - t0) * t),
        base - h * s * Math.sin(Math.PI * t) ** 0.7 + (rand() - 0.5) * 1.2,
      ])
    }
    m.push([x + w * t1, base])
    out.push(...body(m, 'line'))
    out.push(...toneFill(m, 'T4', { gap: 2.4, weight: 'fine', inset: 0.5 }))
  }
  // The block: jagged crown, vertical flanks.
  const top: Pt[] = []
  for (let i = 0; i + 1 < CROWN.length; i++) {
    const [t0, s0] = CROWN[i],
      [t1, s1] = CROWN[i + 1]
    for (let k = 0; k < 4; k++) {
      const t = k / 4
      top.push([
        x + w * (t0 + (t1 - t0) * t),
        y + h * (s0 + (s1 - s0) * t) + (k ? (rand() - 0.5) * 1.6 : 0),
      ])
    }
  }
  top.push([x + w, base])
  const block: Pt[] = [...top]
  out.push(...body(block, 'line'))
  // Shaded right flank and a lit left rim of bedding ticks.
  const flank: Pt[] = block.filter(([px]) => px >= x + w * 0.8)
  out.push(
    ...toneFill(
      [[x + w * 0.8, base], ...flank.slice(0, -1), [x + w, base]].filter(
        (_, i, a) => i < a.length,
      ) as Pt[],
      'T4',
      { gap: 2.4, weight: 'fine', inset: 0.6 },
    ),
  )
  for (let k = 0; k < 6; k++) {
    const yy = y + h * (0.3 + 0.11 * k)
    out.push(hline('fine', x + w * (0.05 + rand() * 0.04), x + w * (0.14 + rand() * 0.06), yy))
  }
  // Facade recess.
  const fw = w * 0.56
  const fx = x + w * 0.2
  const fy = y + h * 0.26
  const u = (t: number) => fx + fw * t
  const v = (s: number) => fy + (base - fy) * s
  out.push(...body(rectPts(u(0), v(0.18), fw, (base - fy) * 0.66), 'line'))
  // Pediment and entablature.
  const ped: Pt[] = [
    [u(-0.04), v(0.2)],
    [u(0.5), v(-0.05)],
    [u(1.04), v(0.2)],
  ]
  out.push(...body(ped, 'line'))
  out.push(
    ...toneFill(
      [
        [u(0.2), v(0.17)],
        [u(0.5), v(0.05)],
        [u(0.8), v(0.17)],
      ],
      'T4',
      { angle: 0, gap: 1.8, weight: 'fine' },
    ),
  )
  out.push(hline('bold', u(-0.04), u(1.04), v(0.2)))
  out.push(hline('line', u(0), u(1), v(0.3)))
  // Four pilasters, doorway between the middle pair.
  for (const c of [0.05, 0.31, 0.57, 0.83]) {
    out.push(...body(rectPts(u(c), v(0.32), fw * 0.12, (base - fy) * 0.5), 'hair'))
  }
  out.push(fill(rectPts(u(0.44) + 0.4, v(0.5), fw * 0.12, (base - fy) * 0.34)))
  out.push(hline('hair', u(0.4), u(0.6), v(0.47)))
  // Step and the rough, uncarved plinth.
  out.push(hline('line', u(0.02), u(0.98), v(0.86)))
  out.push(hline('hair', u(-0.06), u(1.06), v(0.92)))
  // Floor rubble in front.
  const rub: Pt[] = [[x - 2, base + 1]]
  for (let t = 0; t <= 1.001; t += 0.05)
    rub.push([x - 2 + (w + 4) * t, base - 2 + Math.sin(t * 15) * 1.4])
  rub.push([x + w + 2, base + 1])
  out.push(occlude(rub), ...toneFill(rub, 'T4', { gap: 2.6, weight: 'hair', inset: 0.4 }))
  out.push(stroke('bold', rub.slice(1, -1)))
  return out
}
