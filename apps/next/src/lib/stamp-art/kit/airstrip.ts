// Funafuti airstrip seen from the lagoon end, eye level (lane A rebuild). Part `sea` is a backdrop:
// the lagoon on the left in sparse T1 lines, the ocean on the right in denser T3 lines with a surf
// dash, both closing on the horizon. Part `land` is the subject: the strip as a receding paper
// trapezoid with a centreline that vanishes at the horizon, grassy shoulders with palms shrinking
// into the distance, and a small twin-prop on short final seen from behind.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatchPoly, hline, rectPts, stroke } from '../grid'
import { type KitModule, num, str } from './util'
import { palm } from './palm'

export const airstrip: KitModule = ([x, y, w, h], p) => {
  const part = str(p, 'part', ['sea', 'land'] as const, 'land')
  const vy = num(p, 'horizonY', y + h * 0.6)
  const cx = x + w / 2
  const bottom = y + h
  // Receding edges: [x at the horizon, x at the near end y=bottom-6] for pavement and shoulder.
  const nearY = bottom - 8
  const edge = (x0: number, x1: number, yy: number) => x0 + ((x1 - x0) * (yy - vy)) / (nearY - vy)
  const padL = (yy: number) => edge(cx - 3.5, cx - 38, yy)
  const padR = (yy: number) => edge(cx + 3.5, cx + 38, yy)
  const shL = (yy: number) => edge(cx - 6.5, cx - 52, yy)
  const shR = (yy: number) => edge(cx + 6.5, cx + 52, yy)

  if (part === 'sea') {
    const out: SvgNode[] = []
    const left: Pt[] = [
      [x - 2, vy],
      [shL(vy), vy],
      [shL(bottom + 2), bottom + 2],
      [x - 2, bottom + 2],
    ]
    const right: Pt[] = [
      [shR(vy), vy],
      [x + w + 2, vy],
      [x + w + 2, bottom + 2],
      [shR(bottom + 2), bottom + 2],
    ]
    out.push(...hatchPoly(left, { angle: 0, gap: [3.4, 4.6], weight: 'fine', ramp: [vy, bottom] }))
    out.push(...hatchPoly(right, { angle: 0, gap: [3.4, 2.4], weight: 'hair', ramp: [vy, bottom] }))
    const rand = mulberry32(5)
    // Surf: short bright dashes breaking the ocean lines just off the shoulder.
    for (let yy = vy + 8; yy < bottom - 3; yy += 4.4) {
      const sx = shR(yy) + 5 + rand() * 3
      out.push(hline('fine', sx, sx + 8 + (yy - vy) * 0.12, yy))
    }
    out.push({ ...hline('bold', x, x + w, vy), late: true })
    return out
  }

  const out: SvgNode[] = []
  const land: Pt[] = [
    [shL(vy), vy],
    [shR(vy), vy],
    [shR(nearY), nearY],
    [shL(nearY), nearY],
  ]
  // Trees behind the strip: a tiny crown line at the far end.
  for (const [fx, fh] of [
    [-17, 8],
    [-9, 11],
    [10, 10],
    [19, 7],
  ] as [number, number][])
    out.push(
      ...palm([cx + fx - fh / 2, vy - fh + 1.5, fh, fh], {
        lean: fx < 0 ? -0.2 : 0.2,
        fronds: 6,
        frond: 0.6,
        seed: 4 + Math.abs(fx),
      }),
    )
  out.push(...body(land, 'hair'))
  // Grass ticks on the shoulders.
  for (const side of [-1, 1] as const) {
    const pEdge = side < 0 ? padL : padR
    const sEdge = side < 0 ? shL : shR
    for (let yy = vy + 4; yy < nearY - 1; yy += 3.2) {
      const t = (yy - vy) / (nearY - vy)
      const a = pEdge(yy) + side * 1.8
      const b = sEdge(yy) - side * 1.2
      for (let k = 0; k < 2 + Math.round(t * 2); k++) {
        const gx = a + (b - a) * ((k + 0.5) / (2 + Math.round(t * 2)))
        out.push(
          stroke('fine', [
            [gx, yy],
            [gx, yy - 1.2 - t * 1.4],
          ]),
        )
      }
    }
  }
  // Pavement: paper trapezoid with a bold edge, threshold bars and a vanishing centreline.
  const pad: Pt[] = [
    [padL(vy), vy],
    [padR(vy), vy],
    [padR(nearY), nearY],
    [padL(nearY), nearY],
  ]
  out.push(...body(pad, 'line'))
  for (let t = 0.1; t < 0.97; t += 0.1) {
    const yy = vy + (nearY - vy) * Math.pow(t, 1.15)
    const t2 = Math.min(0.97, t + 0.06)
    const y2 = vy + (nearY - vy) * Math.pow(t2, 1.15)
    const wd = 0.6 + (yy - vy) * 0.05
    out.push(
      ...body(
        [
          [cx - wd, yy],
          [cx + wd, yy],
          [cx + wd * 1.1, y2],
          [cx - wd * 1.1, y2],
        ],
        'hair',
      ).slice(1),
    )
    out.push(
      fill([
        [cx - wd, yy],
        [cx + wd, yy],
        [cx + wd * 1.1, y2],
        [cx - wd * 1.1, y2],
      ]),
    )
  }
  for (const [t, hs] of [
    [0.93, 5.5],
    [0.8, 4],
  ] as [number, number][]) {
    const yy = vy + (nearY - vy) * t
    for (const s of [-1, 1] as const)
      for (let k = 1; k <= 3; k++) {
        const bx = cx + s * (6 + k * 8 * t)
        out.push(fill(rectPts(bx - 1.2, yy - hs * 0.4, 2.4, hs * 0.4)))
      }
  }
  // Palms along both shoulders, big near, small far.
  for (const [yy, ph, side] of [
    [nearY - 2, 44, -1],
    [nearY - 2, 38, 1],
    [vy + 24, 26, -1],
    [vy + 22, 24, 1],
    [vy + 11, 14, -1],
    [vy + 10, 13, 1],
  ] as [number, number, -1 | 1][]) {
    const sx = (side < 0 ? shL : shR)(yy) + side * (ph > 30 ? -7 : -3)
    out.push(
      ...palm([sx - ph * 0.4, yy - ph, ph * 0.8, ph], {
        lean: side * 0.25,
        fronds: 8,
        frond: 0.62,
        seed: Math.round(ph),
      }),
    )
  }
  // Twin-prop on short final, from behind: high wing, two nacelles, fin and tail plane.
  const px = cx + 1
  const py = y + h * 0.3
  out.push(
    ...body(
      [
        [px - 22, py],
        [px + 22, py],
        [px + 20, py + 3.4],
        [px - 20, py + 3.4],
      ],
      'line',
    ),
  )
  out.push(
    ...body(
      [
        [px - 3, py + 3.4],
        [px + 3, py + 3.4],
        [px + 2, py + 12],
        [px - 2, py + 12],
      ],
      'line',
    ),
  )
  out.push(
    ...body(
      [
        [px - 8, py + 8],
        [px + 8, py + 8],
        [px + 8, py + 10],
        [px - 8, py + 10],
      ],
      'line',
    ),
  )
  out.push(
    ...body(
      [
        [px - 1.2, py + 3.4],
        [px + 1.2, py + 3.4],
        [px + 1.2, py - 8],
        [px - 1.2, py - 8],
      ],
      'line',
    ),
  )
  for (const s of [-1, 1] as const) {
    out.push(...body(rectPts(px + s * 10.5 - 2, py + 3.4, 4, 6), 'line'))
    out.push(
      stroke('fine', [
        [px + s * 10.5 - 6, py + 6.4],
        [px + s * 10.5 + 6, py + 6.4],
      ]),
    )
  }
  return out
}
