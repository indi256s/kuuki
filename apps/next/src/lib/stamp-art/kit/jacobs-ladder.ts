// Jacob's Ladder (Saint Helena): one long straight stair from the Jamestown roofs at the lower
// left to Ladder Hill at the upper right. The steep barren hill face fills the right two thirds:
// lit paper with sparse diagonals left of the stair, T4 hatching right of it, T3 talus at its
// foot. The stair is a paper strip with two solid rails and fine treads. The box bottom is the
// ground (the sea).
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke, toneFill } from '../grid'
import { clipPoly, rough } from './rock-b'
import { type KitModule, num } from './util'

export const jacobsLadder: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 31)))
  const base = y + h
  const at = (u: number, v: number): Pt => [x + w * u, y + h * v]
  const edge: Pt[] = [
    at(0.15, 1),
    at(0.25, 0.7),
    at(0.4, 0.4),
    at(0.58, 0.2),
    at(0.76, 0.09),
    at(0.92, 0.07),
    at(1, 0.07),
  ]
  const jag = rough(edge, rand, 0.9, 6)
  const crest = jag.slice(
    0,
    jag.findIndex(
      ([px, py]) => px === edge[edge.length - 1][0] && py === edge[edge.length - 1][1],
    ) + 1,
  )
  const hill: Pt[] = [...crest, [x + w, base], [x + w * 0.15, base]]
  const out: SvgNode[] = [occlude(hill, { halo: 1.4 })]

  // The stair line from the foot (town end) to the crest.
  const A = at(0.2, 0.99)
  const B = at(0.8, 0.13)
  const dx = B[0] - A[0],
    dy = B[1] - A[1]
  const len = Math.hypot(dx, dy)
  const ux = dx / len,
    uy = dy / len
  // Signed distance to the stair line: positive on the right (down-right) side.
  const side = ([px, py]: Pt) => (px - A[0]) * -uy + (py - A[1]) * ux

  // Right of the stair: T4 hatching leaning off the vertical, T3 talus at the foot.
  const rightPart = clipPoly(hill, (q) => side(q))
  out.push(...toneFill(rightPart, 'T4', { angle: 68, gap: 3.4, weight: 'hair', inset: 0.2 }))
  // Left of the stair: lit rock, sparse diagonals closing towards the foot.
  const leftPart = clipPoly(hill, (q) => -side(q))
  out.push(
    ...toneFill(leftPart, 'T2', { angle: -58, gap: [5.2, 3.4], weight: 'fine', ramp: [y, base] }),
  )
  out.push(stroke('line', crest))
  // Bedding ledges: paper breaks across the dark face, so the T4 stacks as strata.
  for (const f of [0.34, 0.52, 0.7]) {
    const ly = y + h * f
    const lx0 = A[0] + (ly - A[1]) / (dy / dx) + 6
    out.push(
      occlude(
        [
          [lx0, ly - 0.7],
          [x + w, ly - 0.9],
          [x + w, ly + 0.9],
          [lx0 + rand() * 10, ly + 0.9],
        ],
        { halo: 0 },
      ),
      stroke('fine', [
        [lx0 + 8 + rand() * 8, ly + 0.9],
        [x + w, ly + 0.9],
      ]),
    )
  }
  // Gullies: three paper streaks in the dark face, wandering and uneven.
  for (const [f, wid, ln] of [
    [0.42, 2.6, 0.42],
    [0.62, 2, 0.34],
    [0.84, 3, 0.5],
  ] as const) {
    const sx = x + w * f
    const sy = y + h * 0.16
    const pts: Pt[] = []
    for (let k = 0; k <= 5; k++)
      pts.push([sx - k * 1.6 + Math.sin(k * 2 + f * 9) * 0.8, sy + (h * ln * k) / 5])
    const strip: Pt[] = [
      ...pts.map(([px, py]): Pt => [px - wid / 2, py]),
      ...pts.map(([px, py]): Pt => [px + wid / 2, py]).reverse(),
    ]
    out.push(
      occlude(strip, { halo: 0 }),
      stroke(
        'fine',
        pts.map(([px, py]): Pt => [px + wid / 2, py]),
      ),
    )
  }

  // Stair: a paper band, two solid rails, fine treads between them.
  const nx = -uy * 2.6,
    ny = ux * 2.6
  const band: Pt[] = [
    [A[0] + nx, A[1] + ny],
    [B[0] + nx, B[1] + ny],
    [B[0] - nx, B[1] - ny],
    [A[0] - nx, A[1] - ny],
  ]
  out.push(occlude(band, { halo: 1.4 }))
  out.push(stroke('line', [band[0], band[1]]), stroke('line', [band[3], band[2]]))
  for (let d = 2.4; d < len - 1; d += 2.5) {
    const px = A[0] + ux * d,
      py = A[1] + uy * d
    out.push(
      stroke('fine', [
        [px + nx * 0.8, py + ny * 0.8],
        [px - nx * 0.8, py - ny * 0.8],
      ]),
    )
  }

  // Ladder Hill: a short fort wall with merlons on the crest at the stair's head.
  const fx = x + w * 0.74,
    fy = y + h * 0.085
  const fw = w * 0.24
  out.push(
    occlude(rectPts(fx, fy - 9, fw, 9), { halo: 1 }),
    ...body(rectPts(fx, fy - 6, fw, 6), 'line'),
  )
  for (let mx = fx + 1; mx < fx + fw - 3; mx += 5)
    out.push(...body(rectPts(mx, fy - 9, 2.8, 3), 'hair'))

  // Jamestown roofs at the foot: small walls under solid slate roofs.
  for (const [u, bw, bh] of [
    [0.0, 14, 8],
    [0.1, 11, 11],
    [0.19, 12, 7],
  ] as const) {
    const bx = x + w * u
    out.push(occlude(rectPts(bx - 1, base - bh - 4, bw + 2, bh + 4), { halo: 1 }))
    out.push(...body(rectPts(bx, base - bh, bw, bh), 'line'))
    out.push(
      fill([
        [bx - 1, base - bh],
        [bx + bw / 2, base - bh - 4],
        [bx + bw + 1, base - bh],
      ]),
    )
  }
  return out
}
