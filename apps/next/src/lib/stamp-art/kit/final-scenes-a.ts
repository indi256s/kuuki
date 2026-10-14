// Country-specific finishing details for lane A's final art rounds.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatch,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
  vline,
} from '../grid'
import type { KitModule } from './util'
import { penguinProfile } from './penguin-a'
import { steppedPyramid } from './pyramid'

export const avenueA: KitModule = ([x, y, w, h]) => {
  const cx = x + w * 0.5
  const out: SvgNode[] = []
  const road: Pt[] = [
    [cx - 5, y],
    [cx + 5, y],
    [x + w * 0.8, y + h],
    [x + w * 0.2, y + h],
  ]
  out.push(occlude(road), ...hatch(road, 'h', 5, 'fine', 1))
  for (const side of [-1, 1]) {
    out.push(
      stroke('line', [
        [cx + side * 5, y],
        [cx + side * w * 0.3, y + h],
      ]),
    )
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 5
      const tx = cx + side * (w * 0.07 + w * 0.32 * t)
      const base = y + h * t
      const tw = 4 + 9 * t
      const crown: Pt[] = [
        [tx - tw, base],
        [tx - tw * 0.8, base - tw],
        [tx, base - tw * 1.5],
        [tx + tw * 0.7, base - tw],
        [tx + tw, base],
      ]
      out.push(occlude(crown), ...toneFill(crown, 'T2', { gap: 3.2, weight: 'fine' }))
    }
  }
  return out
}

export const clockCupolaA: KitModule = ([x, y, w, h]) => {
  const cx = x + w / 2
  const out: SvgNode[] = [...body(rectPts(x + w * 0.15, y + h * 0.35, w * 0.7, h * 0.65), 'hair')]
  out.push(
    ...toneFill(rectPts(cx + w * 0.15, y + h * 0.36, w * 0.2, h * 0.64), 'T4', {
      gap: 3.4,
      weight: 'fine',
    }),
  )
  const top = y + h * 0.24
  out.push(...body(rectPts(x, top, w, h * 0.13), 'hair'))
  const dome = quad([x, top], [cx, y - h * 0.2], [x + w, top], 12)
  out.push(occlude(dome), fill(dome), vline('hair', cx, y, y - 3))
  const cy = y + h * 0.58
  const r = w * 0.2
  const face: Pt[] = Array.from({ length: 16 }, (_, i) => [
    cx + Math.cos((i * Math.PI) / 8) * r,
    cy + Math.sin((i * Math.PI) / 8) * r,
  ])
  out.push(
    ...body(face, 'hair'),
    stroke('hair', [
      [cx, cy - r * 0.65],
      [cx, cy],
      [cx + r * 0.55, cy + r * 0.25],
    ]),
  )
  out.push(hline('bold', x + w * 0.1, x + w * 0.9, y + h))
  return out
}

export const sandA: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  for (let k = 0; k < 2; k++) {
    const crest: Pt[] = [
      [x, y + h * (0.35 + k * 0.28)],
      [x + w * (0.3 + k * 0.2), y + h * (0.08 + k * 0.33)],
      [x + w, y + h * (0.44 + k * 0.22)],
    ]
    const poly: Pt[] = [...crest, [x + w, y + h], [x, y + h]]
    out.push(
      occlude(poly),
      ...toneFill(poly, 'T1', { gap: 4.4, weight: 'fine' }),
      stroke('hair', crest),
    )
    const lee: Pt[] = [crest[1], crest[2], [x + w, y + h], [crest[1][0] + w * 0.12, y + h]]
    out.push(...toneFill(lee, 'T4', { gap: 4.4, weight: 'fine' }))
  }
  if (p.fence === true) {
    const fy = y + h * 0.25
    out.push(hline('hair', x, x + w, fy))
    for (let px = x + 3; px < x + w; px += 9) out.push(vline('hair', px, fy - 4, fy + 3))
  }
  return out
}

export const iceArchA: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const poly: Pt[] = [
    [x, base],
    [x + w * 0.03, y + h * 0.3],
    [x + w * 0.12, y + 7],
    [x + w * 0.27, y + 3],
    [x + w * 0.35, y + 6],
    [x + w * 0.45, y],
    [x + w * 0.57, y + 4],
    [x + w * 0.68, y + 2],
    [x + w * 0.85, y + 10],
    [x + w, base],
    [x + w * 0.72, base],
    [x + w * 0.66, y + h * 0.34],
    [x + w * 0.5, y + h * 0.23],
    [x + w * 0.34, y + h * 0.36],
    [x + w * 0.27, base],
  ]
  const out: SvgNode[] = [...body(poly, 'hair')]
  for (const node of toneFill(poly, 'T4', { gap: 2.6 })) {
    if (node.kind === 'stroke' && node.pts[0][0] > x + w * 0.7) out.push(node)
  }
  out.push(
    stroke('hair', [
      [x + w * 0.58, y + 5],
      [x + w * 0.66, y + h * 0.2],
    ]),
  )
  for (const f of [0.08, 0.14, 0.2, 0.78, 0.86, 0.93])
    out.push(
      stroke('fine', [
        [x + w * f, y + h * 0.35],
        [x + w * (f + 0.02), base - 4],
      ]),
    )
  out.push(
    ...toneFill(
      [
        [x, base],
        [x + w * 0.04, y + h * 0.35],
        [x + w * 0.2, y + h * 0.4],
        [x + w * 0.27, base],
      ],
      'T2',
      { gap: 2.8, weight: 'fine' },
    ),
  )
  out.push(...hatch(rectPts(x + 3, base + 3, w - 6, 9), 'h', 4.5, 'fine', 2))
  return out
}

export const polarCoastA: KitModule = ([x, y, w, h]) => {
  const base = y + h * 0.82
  const ridge: Pt[] = [
    [x, base],
    [x + w * 0.12, y + h * 0.3],
    [x + w * 0.2, y + h * 0.5],
    [x + w * 0.34, y],
    [x + w * 0.45, y + h * 0.38],
    [x + w * 0.6, y + h * 0.12],
    [x + w * 0.7, y + h * 0.46],
    [x + w * 0.84, y + h * 0.08],
    [x + w, base],
  ]
  const out: SvgNode[] = [occlude(ridge), stroke('hair', ridge.slice(1, -1))]
  for (const [u, v] of [
    [0.34, 0.45],
    [0.6, 0.7],
    [0.84, 1],
  ]) {
    const top = ridge.find((q) => Math.abs(q[0] - (x + w * u)) < 0.1)!
    out.push(
      ...toneFill([top, [x + w * v, base], [x + w * (u + 0.02), base]], 'T4', {
        gap: 2.5,
        weight: 'fine',
      }),
    )
  }
  for (const [u, v, peak] of [
    [0.02, 0.3, 0.12],
    [0.23, 0.52, 0.34],
    [0.49, 0.76, 0.6],
    [0.7, 0.98, 0.84],
  ]) {
    const snow: Pt[] = [
      [x + w * u, base],
      [x + w * peak, y + h * 0.43],
      [x + w * (peak + 0.04), y + h * 0.58],
      [x + w * v, base],
    ]
    out.push(...toneFill(snow, 'T2', { gap: 2.7, weight: 'fine', angle: 58 }))
    out.push(
      stroke('hair', [
        [x + w * peak, y + h * 0.43],
        [x + w * (peak + 0.04), y + h * 0.58],
        [x + w * v, base],
      ]),
    )
  }
  const glacier: Pt[] = [
    [x + w * 0.34, y + h * 0.36],
    [x + w * 0.55, y + h * 0.5],
    [x + w * 0.74, base],
    [x + w * 0.25, base],
  ]
  out.push(occlude(glacier), ...toneFill(glacier, 'T1', { gap: 4.6, weight: 'fine' }))
  for (let i = 0; i < 5; i++)
    out.push(
      stroke('hair', [
        [x + w * (0.34 + i * 0.05), y + h * (0.5 + i * 0.035)],
        [x + w * (0.32 + i * 0.08), base - 1],
      ]),
    )
  out.push(hline('bold', x, x + w, base))
  for (const [u, size] of [
    [0.12, 0.15],
    [0.22, 0.17],
    [0.32, 0.13],
    [0.43, 0.16],
    [0.54, 0.12],
  ])
    out.push(...penguinProfile(x + w * u, y + h, h * size, 1, true))
  return out
}

export const cottagesA: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const hill: Pt[] = [
    [x, y + h],
    [x, y + h * 0.6],
    [x + w * 0.25, y],
    [x + w * 0.52, y + h * 0.42],
    [x + w * 0.78, y + h * 0.12],
    [x + w, y + h * 0.65],
    [x + w, y + h],
  ]
  out.push(occlude(hill), ...toneFill(hill, 'T1', { gap: 5.2, weight: 'fine' }))
  for (const u of [0.2, 0.42, 0.72, 0.87]) {
    const cx = x + w * u
    const base = y + h * (u < 0.5 ? 0.7 : 0.85)
    out.push(...body(rectPts(cx - 8, base - 9, 16, 9), 'hair'))
    out.push(
      ...body(
        [
          [cx - 8, base - 7],
          [cx, base - 13],
          [cx + 8, base - 7],
        ],
        'hair',
      ),
    )
    out.push(fill(rectPts(cx - 1.2, base - 4, 2.4, 4)))
  }
  return out
}

export const copanStairA: KitModule = (box, p) => {
  const out = steppedPyramid(box, p)
  const [x, y, w, h] = box
  for (let r = 0; r < 8; r++) {
    const t = r / 8
    const yy = y + h * (0.35 + t * 0.6)
    const half = w * (0.1 + 0.04 * t)
    for (let c = -1; c <= 1; c++) {
      const px = x + w * 0.47 + c * half * 0.65
      out.push(
        stroke('hair', [
          [px - 1.6, yy],
          [px - 1.6, yy + 2],
          [px + 1.6, yy + 2],
        ]),
      )
    }
  }
  return out
}

export const theatreArchesA: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = [
    ...body(
      [
        [x, y + h],
        [x, y + 5],
        [x + w * 0.15, y],
        [x + w * 0.32, y + 4],
        [x + w * 0.5, y + 1],
        [x + w * 0.68, y + 5],
        [x + w, y + 3],
        [x + w, y + h],
      ],
      'hair',
    ),
  ]
  for (let i = 0; i < 3; i++) {
    const cx = x + (w * (i + 0.5)) / 3
    const hw = w * 0.09
    const top = y + h * 0.36
    const arch = quad([cx - hw, top + 3], [cx, top - 4], [cx + hw, top + 3], 8)
    out.push(fill([...arch, [cx + hw, y + h], [cx - hw, y + h]]))
  }
  return out
}

export const earthenHouseA: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const eave = y + h * 0.53
  const wall: Pt[] = [
    [x + w * 0.12, base],
    [x + w * 0.16, eave],
    [x + w * 0.86, eave],
    [x + w * 0.9, base],
  ]
  const roof: Pt[] = [
    [x, eave],
    [x + w * 0.35, y],
    [x + w * 0.7, y + h * 0.06],
    [x + w, eave],
  ]
  const out: SvgNode[] = [
    ...body(wall, 'hair'),
    ...toneFill([wall[2], wall[3], [x + w * 0.73, base], [x + w * 0.7, eave]], 'T4'),
  ]
  out.push(...body(rectPts(x + w * 0.56, eave + h * 0.14, w * 0.16, h * 0.15), 'hair'))
  out.push(fill(rectPts(x + w * 0.3, eave + h * 0.1, w * 0.16, h * 0.37)))
  out.push(...body(roof, 'hair'), ...toneFill(roof, 'T3', { angle: 65, gap: 3.2, weight: 'fine' }))
  out.push(hline('fine', x + w * 0.15, x + w * 0.3, eave + h * 0.24))
  out.push(vline('hair', x + w * 0.64, eave + h * 0.14, eave + h * 0.29))
  out.push(hline('bold', x, x + w, eave), hline('hair', x + 3, x + w - 3, base))
  return out
}
