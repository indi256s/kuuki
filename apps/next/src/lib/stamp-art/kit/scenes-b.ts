import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
} from '../grid'
import { type KitModule } from './util'
import { palm } from './palm'

export const elminaB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const wall: Pt[] = [
    [x, y + h],
    [x + w * 0.04, y + h * 0.6],
    [x + w * 0.85, y + h * 0.6],
    [x + w, y + h * 0.8],
    [x + w, y + h],
    [x, y + h],
  ]
  out.push(
    ...body(wall),
    ...hatchPoly(
      [
        [x + w * 0.85, y + h * 0.6],
        [x + w, y + h * 0.8],
        [x + w, y + h],
        [x + w * 0.85, y + h],
      ],
      { angle: 90, gap: 2.4, weight: 'hair' },
    ),
  )
  out.push(...body(rectPts(x + w * 0.1, y + h * 0.32, w * 0.58, h * 0.28)))
  out.push(...body(rectPts(x + w * 0.17, y + h * 0.1, w * 0.2, h * 0.5)))
  out.push(...body(rectPts(x + w * 0.18, y, w * 0.18, h * 0.13), 'hair'))
  for (let i = 0; i < 7; i++)
    out.push(...body(rectPts(x + w * (0.4 + i * 0.065), y + h * 0.55, w * 0.035, h * 0.07), 'hair'))
  for (let i = 0; i < 6; i++) out.push(fill(rectPts(x + w * (0.14 + i * 0.11), y + h * 0.42, 4, 5)))
  out.push(fill(rectPts(x + w * 0.51, y + h * 0.74, 6, h * 0.24)))
  return out
}

export const shoebillB: KitModule = ([x, y, w, h]) => {
  const at = (a: number, b: number): Pt => [x + w * a, y + h * b],
    out: SvgNode[] = []
  for (const f of [0.06, 0.22, 0.82, 0.95]) {
    out.push(stroke('hair', [at(f, 1), at(f - 0.02, 0.43)]))
    for (const d of [-0.09, -0.045, 0, 0.045, 0.09])
      out.push(stroke('hair', quad(at(f - 0.02, 0.43), at(f + d, 0.25), at(f + d, 0.45), 6)))
  }
  const bird = [
    at(0.35, 0.77),
    at(0.37, 0.44),
    at(0.48, 0.29),
    at(0.49, 0.1),
    at(0.59, 0.04),
    at(0.69, 0.08),
    at(0.71, 0.18),
    at(0.64, 0.29),
    at(0.64, 0.49),
    at(0.72, 0.69),
    at(0.65, 0.8),
  ]
  out.push(
    ...body(bird),
    ...hatchPoly([at(0.53, 0.43), at(0.64, 0.49), at(0.72, 0.69), at(0.65, 0.8), at(0.45, 0.77)], {
      angle: 64,
      gap: 2.6,
      weight: 'hair',
    }),
  )
  const bill = [at(0.67, 0.12), at(0.87, 0.13), at(0.91, 0.21), at(0.87, 0.27), at(0.64, 0.25)]
  out.push(...body(bill), ...hatchPoly(bill, { angle: 0, gap: 2.3, weight: 'hair' }))
  out.push(fill(rectPts(x + w * 0.65, y + h * 0.1, 2.5, 2.5)))
  for (const f of [0.44, 0.59]) out.push(stroke('line', [at(f, 0.79), at(f, 1), at(f - 0.08, 1)]))
  out.push(stroke('hair', [at(0.42, 0.64), at(0.56, 0.69), at(0.65, 0.76)]))
  return out
}

export const thousandHillsB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  for (let row = 0; row < 6; row++) {
    const edge: Pt[] = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      edge.push([x + w * t, y + h * (0.18 + row * 0.14) + Math.sin(t * 7 + row * 1.9) * h * 0.11])
    }
    const poly: Pt[] = [...edge, [x + w, y + h + 1], [x, y + h + 1]]
    out.push(
      occlude(poly),
      ...hatchPoly(poly, {
        angle: 0,
        gap: row < 3 ? 6 : 4.8,
        weight: 'fine',
      }),
    )
    out.push(stroke('hair', edge))
    for (const d of [5, 10])
      out.push(
        stroke(
          'fine',
          edge.map(([px, py]): Pt => [px, Math.min(y + h, py + d)]),
        ),
      )
    if (row === 2)
      out.push(
        occlude([
          ...edge.map(([px, py]): Pt => [px, py + 8]),
          ...edge.map(([px, py]): Pt => [px, py + 13]).reverse(),
        ]),
      )
  }
  return out
}

// Low motu seen from the lagoon: no aerial ring or closed ellipse.
export const motuB: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const strip: Pt[] = [
    [x, y + h],
    [x + w * 0.07, y + h * 0.82],
    [x + w * 0.34, y + h * 0.76],
    [x + w * 0.7, y + h * 0.8],
    [x + w, y + h],
    [x + w, y + h + 5],
    [x, y + h + 5],
  ]
  out.push(...body(strip, p.centred ? 'line' : 'hair'))
  const count = typeof p.palms === 'number' ? p.palms : p.centred ? 3 : 5
  for (let i = 0; i < count; i++) {
    const pw = w * 0.24,
      ph = h * (0.75 + (i % 2) * 0.2)
    out.push(
      ...palm([x + w * (0.13 + i * 0.16) - pw / 2, y + h - ph, pw, ph], {
        seed: i + 3,
        lean: (i % 2 ? 1 : -1) * 0.3,
        frond: 0.62,
      }),
    )
  }
  return out
}

export const basaltTablesB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const ridge: Pt[] = [
    [x, y + h],
    [x + w * 0.07, y + h * 0.44],
    [x + w * 0.2, y + h * 0.44],
    [x + w * 0.2, y + h * 0.24],
    [x + w * 0.47, y + h * 0.24],
    [x + w * 0.47, y],
    [x + w * 0.73, y],
    [x + w * 0.73, y + h * 0.2],
    [x + w * 0.87, y + h * 0.2],
    [x + w, y + h * 0.7],
    [x + w, y + h],
  ]
  out.push(...body(ridge, 'hair'), ...hatchPoly(ridge, { angle: 90, gap: 3, weight: 'fine' }))
  for (let i = 1; i < 6; i++)
    out.push(hline('hair', x + w * 0.22, x + w * 0.8, y + h * (0.3 + i * 0.1)))
  for (let i = 0; i < 3; i++) {
    const bx = x + w * (0.25 + i * 0.16),
      by = y + h * 0.88
    out.push(
      ...body(rectPts(bx, by, w * 0.12, h * 0.12), 'hair'),
      fill(rectPts(bx + 3, by + 3, 3, 4)),
    )
  }
  return out
}

export const fogoB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const rim: Pt[] = [
    [x, y + h],
    [x, y + h * 0.4],
    [x + w * 0.14, y + h * 0.25],
    [x + w * 0.27, y + h * 0.63],
    [x + w * 0.8, y + h * 0.72],
    [x + w, y + h * 0.53],
    [x + w, y + h],
  ]
  out.push(...body(rim, 'hair'), ...hatchPoly(rim, { angle: 55, gap: 3, weight: 'fine' }))
  const cone: Pt[] = [
    [x + w * 0.23, y + h],
    [x + w * 0.55, y + h * 0.05],
    [x + w * 0.58, y],
    [x + w * 0.63, y + h * 0.07],
    [x + w * 0.96, y + h],
  ]
  out.push(...body(cone), ...hatchPoly(cone, { angle: 70, gap: 2.7, weight: 'hair' }))
  for (const s of [0.3, 0.6])
    out.push(
      stroke('fine', [
        [x + w * (0.56 + s * 0.08), y + h * 0.2],
        [x + w * (0.45 + s * 0.5), y + h * 0.93],
      ]),
    )
  out.push(hline('hair', x + w * 0.08, x + w * 0.9, y + h * 0.96))
  return out
}

export const falajB: KitModule = ([x, y, w, h]) => {
  const channel: Pt[] = [
    [x + w * 0.65, y],
    [x + w * 0.7, y],
    [x + w * 0.2, y + h],
    [x, y + h],
  ]
  return [
    occlude(channel, { halo: 0.4 }),
    stroke('hair', [channel[0], channel[3]]),
    stroke('hair', [channel[1], channel[2]]),
  ]
}

export const bananaB: KitModule = ([x, y, w, h]) => {
  const cx = x + w * 0.5,
    cy = y + h * 0.46,
    out: SvgNode[] = []
  out.push(
    stroke('bold', [
      [cx, y + h],
      [cx, cy],
    ]),
  )
  for (const [a, b, c] of [
    [0, 0.2, -0.25],
    [1, 0.15, 0.25],
    [0.12, 0.02, -0.08],
    [0.92, 0.4, 0.1],
  ]) {
    const tip: Pt = [x + w * a, y + h * b],
      edge = quad([cx, cy], [cx + w * c, y + h * 0.05], tip, 10)
    const back = quad(tip, [cx + w * c, y + h * 0.5], [cx + 2, cy + 5], 10)
    out.push(fill([...edge, ...back.slice(1)]))
  }
  return out
}

export const cliffOverhangB: KitModule = ([x, y, w, h]) => {
  const rim: Pt[] = [
    [x, y + h * 0.3],
    [x + w * 0.2, y],
    [x + w * 0.55, y + h * 0.12],
    [x + w, y],
    [x + w, y + h * 0.6],
    [x + w * 0.1, y + h],
  ]
  return [fill(rim)]
}

export const distantBaobabB: KitModule = ([x, y, w, h]) => {
  const trunk: Pt[] = [
    [x + w * 0.35, y + h],
    [x + w * 0.43, y + h * 0.4],
    [x + w * 0.57, y + h * 0.4],
    [x + w * 0.66, y + h],
  ]
  const crown = quad([x, y + h * 0.35], [x + w * 0.5, y - h * 0.16], [x + w, y + h * 0.3], 16)
  return [
    occlude([...crown, [x + w, y + h * 0.5], [x, y + h * 0.5]]),
    ...hatchPoly([...crown, [x + w, y + h * 0.5], [x, y + h * 0.5]], {
      angle: 55,
      gap: 2.4,
      weight: 'fine',
    }),
    ...body(trunk, 'hair'),
    stroke('hair', [
      [x + w * 0.5, y + h * 0.5],
      [x + w * 0.2, y + h * 0.25],
    ]),
    stroke('hair', [
      [x + w * 0.5, y + h * 0.5],
      [x + w * 0.8, y + h * 0.22],
    ]),
  ]
}
