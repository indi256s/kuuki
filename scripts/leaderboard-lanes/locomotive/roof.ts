// Roof equipment: two pantographs (one raised, one folded) on insulators, the roof container with its breaker, the
// high-voltage run between them, hatches and intake hoods, the cab-end horns and an antenna.
import type { V3 } from '../airliner/surface'
import { rect, type Ctx } from './parts'
import { BOGIES, LENGTH, MID, ROOF, at, body, bodyU, roofV } from './model'

/** A post insulator: ribbed porcelain on a vertical axis from z0 up by h. */
function insulator(c: Ctx, a: number, y: number, z0: number, h: number, r = 0.055) {
  const { lathe } = c
  const ribs: [number, number, number?][] = [[0, r * 1.5]]
  const n = Math.max(2, Math.round(h / 0.05))
  for (let i = 0; i < n; i++) {
    const s = (h * (i + 0.5)) / n
    ribs.push(
      [s - h / n / 2 + 0.004, r],
      [s - h / n / 2 + 0.012, r * 1.6],
      [s + h / n / 2 - 0.012, r * 1.6],
      [s + h / n / 2 - 0.004, r],
    )
  }
  ribs.push([h, r * 1.2])
  lathe(at(a, y, z0), at(a, y, z0 + h), ribs, 'metal', 0.2, 14)
}

function pantograph(c: Ctx, b: number, raised: boolean, dir: 1 | -1) {
  const { box, rod, lathe } = c
  // Base frame on four insulators.
  for (const y of [-0.52, 0.52]) for (const dx of [-0.5, 0.5]) insulator(c, b + dx, y, ROOF, 0.3)
  box(b - 0.62, b + 0.62, -0.6, -0.44, ROOF + 0.3, ROOF + 0.37, 'rubber', 0.25)
  box(b - 0.62, b + 0.62, 0.44, 0.6, ROOF + 0.3, ROOF + 0.37, 'rubber', 0.25)
  box(b - 0.52, b - 0.4, -0.6, 0.6, ROOF + 0.3, ROOF + 0.37, 'rubber', 0.25)
  box(b + 0.4, b + 0.52, -0.6, 0.6, ROOF + 0.3, ROOF + 0.37, 'rubber', 0.25)
  const z0 = ROOF + 0.37
  const H: V3 = at(b - dir * 0.4, 0, z0 + 0.06)
  const K: V3 = raised ? at(b + dir * 0.95, 0, z0 + 0.98) : at(b + dir * 1.25, 0, z0 + 0.22)
  const T: V3 = raised ? at(b - dir * 0.12, 0, z0 + 1.7) : at(b - dir * 0.05, 0, z0 + 0.3)
  // Hinge blocks, the air bellows that lifts the arm, lower arm (twin tubes), upper arm and the balance rod.
  box(b - dir * 0.4 - 0.08, b - dir * 0.4 + 0.08, -0.12, 0.12, z0, z0 + 0.1, 'metal', 0.2)
  lathe(
    at(b + dir * 0.18, 0, z0),
    at(b + dir * 0.18, 0, z0 + 0.3),
    [
      [0, 0.1],
      [0.03, 0.12, 1],
      [0.08, 0.12],
      [0.11, 0.09],
      [0.16, 0.12, 1],
      [0.22, 0.12],
      [0.3, 0.09],
    ],
    'rubber',
    0.2,
    16,
  )
  for (const y of [-0.09, 0.09]) rod([H[0], y, H[2]], [K[0], y, K[2]], 0.04, 'metal', 0.2)
  rod(K, T, 0.036, 'metal', 0.2)
  rod(
    at(b + dir * 0.05, 0, z0 + 0.12),
    raised ? at(b - dir * 0.12 + dir * 0.3, 0, z0 + 1.56) : at(b + dir * 0.6, 0, z0 + 0.34),
    0.02,
    'metal',
    0.14,
  )
  // Contact head: cross tubes, two carbon strips and the curled horns.
  const Ta = T[0] + LENGTH
  rod([T[0], -0.96, T[2]], [T[0], 0.96, T[2]], 0.03, 'metal', 0.2)
  for (const dx of [-0.17, 0.17])
    box(Ta + dx - 0.035, Ta + dx + 0.035, -0.98, 0.98, T[2] + 0.02, T[2] + 0.07, 'void', 0.25)
  for (const y of [-1, 1]) {
    rod([T[0], y * 0.96, T[2]], [T[0], y * 1.08, T[2] - 0.12], 0.026, 'metal', 0.16)
    rod(
      [T[0] + 0.17, y * 0.96, T[2] + 0.04],
      [T[0] - 0.17, y * 0.96, T[2] + 0.04],
      0.018,
      'metal',
      0.12,
    )
  }
}

export function roof(c: Ctx) {
  const { box, rod, line, fill, lathe, out } = c
  // Panel joints across the flat roof, each running shoulder to shoulder; intake hoods either side of the container.
  for (const a of [2.1, 3.8, 5.7, 13.28, 15.18, 16.2]) {
    const [v0, v1] = roofV(a)
    out.push({
      kind: 'lines',
      lines: c.d.seam(body, 48, (t) => [bodyU(a), v0 + (v1 - v0) * t], 'faint', 0.14),
    })
  }
  // Items sit far to near, tail to nose.
  for (const a of [3.0, LENGTH - 3.0]) {
    box(a - 0.45, a + 0.45, -0.5, 0.5, ROOF, ROOF + 0.07, 'body', 0.3)
    for (let i = 0; i < 5; i++) {
      const aa = a - 0.3 + i * 0.15
      line([at(aa, -0.4, ROOF + 0.073), at(aa, 0.4, ROOF + 0.073)], 'faint', 0.12)
    }
    box(a - 0.04, a + 0.04, 0.3, 0.46, ROOF + 0.07, ROOF + 0.1, 'metal', 0.2)
  }
  pantograph(c, BOGIES[0], true, 1)
  for (const sg of [-1, 1]) {
    const a0 = sg < 0 ? MID - 3.9 : MID + 2.7
    box(a0, a0 + 1.2, -0.66, 0.66, ROOF, ROOF + 0.11, 'body', 0.3)
    for (let i = 0; i < 6; i++) {
      const a = a0 + 0.12 + i * 0.17
      fill(
        rect(a, a + 0.07, -0.54, 0.54).map(([x, y]) => at(x, y, ROOF + 0.114)),
        'rubber',
        undefined,
        0.1,
      )
    }
  }
  // Roof container between the pantographs, the breaker on top and the high-voltage run.
  box(MID - 1.9, MID + 1.9, -0.8, 0.8, ROOF, ROOF + 0.2, 'body', 0.35)
  fill(
    [
      at(MID - 1.8, -0.7, ROOF + 0.202),
      at(MID + 1.8, -0.7, ROOF + 0.202),
      at(MID + 1.8, 0.7, ROOF + 0.202),
      at(MID - 1.8, 0.7, ROOF + 0.202),
    ],
    'body',
    'faint',
    0.14,
  )
  for (let i = 0; i < 10; i++) {
    const a = MID - 1.62 + i * 0.36
    if (Math.abs(a - MID) < 0.9) continue
    fill(
      rect(a, a + 0.1, -0.5, 0.5).map(([x, y]) => at(x, y, ROOF + 0.204)),
      'rubber',
      undefined,
      0.1,
    )
  }
  insulator(c, MID - 0.62, 0, ROOF + 0.2, 0.42, 0.06)
  insulator(c, MID + 0.62, 0, ROOF + 0.2, 0.42, 0.06)
  rod(at(MID - 0.62, 0, ROOF + 0.62), at(MID + 0.62, 0, ROOF + 0.62), 0.05, 'metal', 0.2)
  lathe(
    at(MID - 0.3, 0, ROOF + 0.62),
    at(MID + 0.3, 0, ROOF + 0.62),
    [
      [0, 0.1],
      [0.6, 0.1],
    ],
    'metal',
    0.22,
    20,
  )
  // HV cable from each pantograph base to the breaker.
  for (const [b, o] of [
    [BOGIES[0], 1],
    [BOGIES[1], -1],
  ] as const) {
    const a1 = b + o * 0.52,
      a2 = MID - o * 0.62
    rod(at(a1, 0, ROOF + 0.37), at(a1, 0, ROOF + 0.55), 0.022, 'rubber', 0.12)
    rod(at(a1, 0, ROOF + 0.55), at(a2, 0, ROOF + 0.55), 0.022, 'rubber', 0.12)
    rod(at(a2, 0, ROOF + 0.55), at(a2, 0, ROOF + 0.62), 0.022, 'rubber', 0.12)
  }
  pantograph(c, BOGIES[1], false, -1)
  // Cab-end horns and a roof antenna.
  for (const y of [-0.42, 0.42]) {
    box(LENGTH - 2.25, LENGTH - 1.95, y - 0.09, y + 0.09, ROOF, ROOF + 0.06, 'metal', 0.2)
    lathe(
      at(LENGTH - 2.25, y, ROOF + 0.09),
      at(LENGTH - 1.65, y, ROOF + 0.09),
      [
        [0, 0.03],
        [0.12, 0.045],
        [0.35, 0.09],
        [0.5, 0.15],
      ],
      'metal',
      0.22,
      18,
    )
  }
  lathe(
    at(2.1, 0.5, ROOF),
    at(2.1, 0.5, ROOF + 0.07),
    [
      [0, 0.1],
      [0.07, 0.08],
    ],
    'rubber',
    0.2,
    16,
  )
  rod(at(2.1, 0.5, ROOF + 0.07), at(2.1, 0.5, ROOF + 0.5), 0.012, 'metal', 0.12)
}
