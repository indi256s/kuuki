import { type Pt, type SvgNode, body, fill, hatchPoly, hline, rectPts, stroke, quad } from '../grid'
import { type KitModule, bool } from './util'
import { mulberry32 } from '../hash'

// The lane recedes to a sea opening; the door and projecting lattice bay carry the foreground.
export const sidiLaneB: KitModule = ([x, y, w, h]) => {
  const at = (a: number, b: number): Pt => [x + w * a, y + h * b]
  const out: SvgNode[] = []
  const left = [at(0, 1), at(0, 0), at(0.36, 0.12), at(0.43, 0.68), at(0.38, 1)]
  const right = [at(0.7, 0.65), at(0.76, 0.12), at(1, 0), at(1, 1), at(0.64, 1)]
  out.push(...body(left), ...body(right))
  out.push(
    ...hatchPoly([at(0.87, 0.08), at(1, 0), at(1, 1), at(0.87, 1)], {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
    }),
  )
  for (let i = 0; i < 7; i++) {
    const t = i / 7
    out.push(stroke('hair', [at(0.38 + t * 0.06, 1 - t * 0.32), at(0.64 + t * 0.06, 1 - t * 0.32)]))
  }
  const dx = x + w * 0.12,
    dy = y + h * 0.48,
    dw = w * 0.2,
    dh = h * 0.43
  const arch: Pt[] = [
    [dx, dy + dh],
    [dx, dy + dw * 0.5],
    ...quad([dx, dy + dw * 0.5], [dx + dw * 0.5, dy - dw * 0.35], [dx + dw, dy + dw * 0.5], 12),
    [dx + dw, dy + dh],
  ]
  out.push(...body(arch, 'bold'), ...hatchPoly(arch, { angle: 90, gap: 2.8, weight: 'hair' }))
  out.push(
    stroke('line', [
      [dx + dw * 0.5, dy + dw * 0.12],
      [dx + dw * 0.5, dy + dh],
    ]),
  )
  for (let r = 0; r < 4; r++)
    for (const c of [0.25, 0.75])
      out.push(fill(rectPts(dx + dw * c - 1.2, dy + dh * (0.35 + r * 0.15), 2.4, 2.4)))
  const bay = rectPts(x + w * 0.06, y + h * 0.15, w * 0.35, h * 0.3)
  out.push(
    ...body(bay, 'bold'),
    ...hatchPoly(bay, { angle: 90, gap: 10, weight: 'line' }),
    ...hatchPoly(bay, { angle: 0, gap: 10, weight: 'line' }),
  )
  for (let i = 0; i < 3; i++)
    out.push(...body(rectPts(x + w * 0.81, y + h * (0.35 + i * 0.15), w * 0.1, h * 0.1), 'hair'))
  return out
}

// Overlapping blocks follow a sloped skyline rather than a row of equal extruded boxes.
export const casbahB: KitModule = ([x, y, w, h], p) => {
  const ruin = bool(p, 'ruin', false),
    rand = mulberry32(ruin ? 37 : 12)
  const out: SvgNode[] = []
  for (let row = 0; row < (ruin ? 4 : 5); row++) {
    const count = 5 + row
    for (let i = 0; i < count; i++) {
      const bw = (w / count) * (0.8 + rand() * 0.3),
        bx = x + (i * w) / count + (rand() - 0.5) * 4
      const by = y + h * (0.12 + row * 0.16) + h * 0.16 * (i / count),
        bh = h * (0.21 + rand() * 0.16)
      const top: Pt[] = ruin
        ? [
            [bx, by + 2],
            [bx + bw * 0.2, by],
            [bx + bw * 0.43, by + 4],
            [bx + bw * 0.67, by + 1],
            [bx + bw, by + 3],
          ]
        : [
            [bx, by],
            [bx + bw, by],
          ]
      const poly: Pt[] = [...top, [bx + bw, by + bh], [bx, by + bh]]
      out.push(...body(poly, 'hair'))
      out.push(
        ...hatchPoly(rectPts(bx + bw * 0.72, by + 4, bw * 0.28, bh - 4), {
          angle: 90,
          gap: 2.6,
          weight: 'hair',
        }),
      )
      if (ruin && row === 0) {
        out.push(
          stroke('hair', [
            [bx, by + 3],
            [bx + bw * 0.65, by + 7],
            [bx + bw, by + 3],
          ]),
        )
        for (let j = 0; j < 3; j++)
          out.push(hline('fine', bx + 1, bx + bw * 0.45, by + bh * (0.3 + j * 0.23)))
      }
      out.push(fill(rectPts(bx + bw * 0.24, by + bh * 0.52, Math.max(3, bw * 0.18), bh * 0.3)))
    }
  }
  return out
}

export const meroeB: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  for (const [f, s, b, broken] of [
    [0.06, 0.4, 0.75, 1],
    [0.85, 0.44, 0.76, 0],
    [0.7, 0.64, 0.86, 1],
    [0.32, 0.82, 0.92, 0],
    [0.5, 0.56, 0.96, 1],
    [0.14, 0.7, 1, 0],
  ]) {
    const ph = h * s,
      bw = ph * 0.42,
      cx = x + w * f,
      base = y + h * b,
      top = base - ph
    const poly: Pt[] = [
      [cx - bw / 2, base],
      [cx - 2, top + broken * 4],
      [cx + 2, top + broken * 3],
      [cx + bw / 2, base],
    ]
    out.push(
      ...body(poly),
      ...hatchPoly(
        [
          [cx + 2, top + broken * 3],
          [cx + bw / 2, base],
          [cx, base],
        ],
        { angle: 75, gap: 2.4, weight: 'hair' },
      ),
    )
    if (b > 0.9) {
      out.push(
        ...body(rectPts(cx - bw * 0.33, base - 10, bw * 0.66, 12), 'hair'),
        fill(rectPts(cx - 2, base - 7, 4, 9)),
      )
    }
  }
  return out
}
