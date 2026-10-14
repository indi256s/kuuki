import { type Pt, type SvgNode, body, fill, hatchPoly, hline, quad, rectPts, stroke } from '../grid'
import { type KitModule } from './util'
import { drumB } from './drum-b'

export const fasilB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  out.push(...body(rectPts(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.7)))
  out.push(
    ...hatchPoly(rectPts(x + w * 0.68, y + h * 0.3, w * 0.12, h * 0.7), {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
    }),
  )
  for (const f of [0.22, 0.43, 0.65])
    out.push(...body(rectPts(x + w * f, y + h * 0.25, w * 0.1, h * 0.07), 'hair'))
  for (const f of [0.06, 0.78]) {
    const bx = x + w * f,
      bw = w * 0.17,
      by = y + h * 0.15
    out.push(
      ...drumB([bx, by, bw, h * 0.85], {
        merlons: 0,
        crownH: 0.04,
        crownW: 1,
        bands: 2,
        slits: 2,
        shade: 0.34,
      }),
    )
    out.push(...body(quad([bx, by], [bx + bw * 0.5, y - h * 0.05], [bx + bw, by], 12)))
  }
  out.push(fill(rectPts(x + w * 0.44, y + h * 0.65, w * 0.12, h * 0.35)))
  for (const f of [0.32, 0.6]) out.push(fill(rectPts(x + w * f, y + h * 0.42, 4, 6)))
  return out
}

export const brokenColumnsB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  for (const [f, s] of [
    [0.05, 0.8],
    [0.3, 0.46],
    [0.58, 1],
    [0.82, 0.63],
  ]) {
    const bx = x + w * f,
      bw = w * 0.1,
      base = y + h,
      top = base - h * s
    const shaft: Pt[] = [
      [bx, base],
      [bx + bw * 0.1, top + 2],
      [bx + bw * 0.4, top],
      [bx + bw * 0.6, top + 3],
      [bx + bw * 0.9, top + 1],
      [bx + bw, base],
    ]
    out.push(
      ...body(shaft, 'hair'),
      stroke('fine', [
        [bx + bw * 0.65, top + 4],
        [bx + bw * 0.65, base],
      ]),
    )
    out.push(...body(rectPts(bx - 3, base - 8, bw + 6, 8), 'line'))
    if (s > 0.7) out.push(...body(rectPts(bx - 3, top + 2, bw + 6, 7), 'hair'))
  }
  out.push(hline('hair', x, x + w, y + h + 2))
  return out
}

export const coastArcadeB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  out.push(
    ...body(
      [
        [x, y + h],
        [x + w * 0.08, y + h * 0.3],
        [x + w * 0.85, y],
        [x + w, y + h * 0.3],
        [x + w, y + h],
      ],
      'hair',
    ),
  )
  out.push(
    ...hatchPoly(
      [
        [x, y + h],
        [x + w * 0.08, y + h * 0.5],
        [x + w, y + h * 0.45],
        [x + w, y + h],
      ],
      { angle: 0, gap: 3, weight: 'fine' },
    ),
  )
  const wall = rectPts(x + w * 0.05, y + h * 0.02, w * 0.65, h * 0.5)
  out.push(...body(wall, 'hair'))
  for (let i = 0; i < 6; i++) {
    const ax = x + w * (0.09 + i * 0.1),
      ay = y + h * 0.5,
      aw = w * 0.065,
      ah = h * 0.36
    const arch: Pt[] = [
      [ax, ay],
      [ax, ay - ah + aw * 0.5],
      ...quad(
        [ax, ay - ah + aw * 0.5],
        [ax + aw * 0.5, ay - ah - aw * 0.3],
        [ax + aw, ay - ah + aw * 0.5],
        8,
      ),
      [ax + aw, ay],
    ]
    out.push(fill(arch))
  }
  return out
}
