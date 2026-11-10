// The locomotive's body: shell, livery, cab doors and windows, machine-room grilles and doors, the cab front with its
// screen, lamps and wipers, the underframe, and the two ends (buffer beam, buffers, coupler, hoses, pilot, rails).
import type { Pt, V3 } from '../airliner/surface'
import { ellipse, rect, rrect, sample, shrink, type Ctx } from './parts'
import { BODY0, BODY1, HW, LENGTH, MID, RS, Z0, at, body, cap, roofAt, topOfY } from './model'

/** `a` for a point `t` m in from the buffer face of end `e` (0 tail, 1 nose). */
const T = (e: 0 | 1, t: number) => (e ? LENGTH - t : t)
/** An a-range [t0, t1] in from end e, ordered. */
const span = (e: 0 | 1, t0: number, t1: number): [number, number] =>
  e ? [LENGTH - t1, LENGTH - t0] : [t0, t1]

export function underframe(c: Ctx) {
  const { box, fill, line } = c
  // The dark underframe the shell stands on, visible as a shadow line under the floor.
  box(BODY0, BODY1, -1.42, 1.42, 1.4, Z0, 'rubber', 0.3)
  // Transformer tank slung between the bogies with its cooling fins, and the battery boxes.
  box(MID - 2.15, MID + 2.15, -1.2, 1.2, 0.86, 1.4, 'rubber', 0.3)
  box(MID - 2.55, MID - 2.25, -1.08, 1.08, 0.9, 1.4, 'metal', 0.3)
  box(MID + 2.25, MID + 2.55, -1.08, 1.08, 0.9, 1.4, 'metal', 0.3)
  for (let i = 0; i < 14; i++) {
    const a = MID - 1.95 + i * 0.3
    fill(
      [at(a, 1.204, 0.92), at(a + 0.1, 1.204, 0.92), at(a + 0.1, 1.204, 1.34), at(a, 1.204, 1.34)],
      'metal',
      'faint',
      0.12,
    )
  }
  line([at(MID - 2.15, 1.204, 1.13), at(MID + 2.15, 1.204, 1.13)], 'faint', 0.12)
}

export function shell(c: Ctx) {
  const { solid, out } = c
  out.push(solid(cap(false), 'body', [], 0.3))
  out.push(solid(body, 'body', [], 0.5))
  out.push(solid(cap(true), 'body', [], 0.3))
}

/** Near flank: livery, gutter, seams, grilles, doors, plate. */
export function flankDetails(c: Ctx) {
  const { flank, flankLine } = c
  const wallTop = (a: number) => roofAt(a) - RS
  // Livery stripe: low along the machine room, lifting round both cabs.
  flank(
    [
      [BODY0, Z0],
      [BODY1, Z0],
      [BODY1, 2.5],
      [LENGTH - 2.9, 2.5],
      [LENGTH - 3.7, 2.1],
      [3.7, 2.1],
      [2.9, 2.5],
      [BODY0, 2.5],
    ],
    'livery',
    'seam',
    0.12,
  )
  // Sill: the dark gap between shell and underframe, and the gutter where the wall turns into the shoulder.
  flank(rect(BODY0, BODY1, Z0, Z0 + 0.07), 'rubber', 'seam', 0.12)
  flankLine(
    Array.from({ length: 81 }, (_, i): Pt => {
      const a = BODY0 + ((BODY1 - BODY0) * i) / 80
      return [a, wallTop(a)]
    }),
    'faint',
    0.14,
  )
  // Vertical panel joints, each running from the sill to the gutter.
  for (const o of [0.76, 2.45, 3.75, 5.42, 6.85])
    for (const sg of [-1, 1]) {
      const a = MID + sg * o
      flankLine(
        [
          [a, Z0 + 0.07],
          [a, wallTop(a)],
        ],
        'faint',
        0.12,
      )
    }

  // Machine room, laid out about the centre: a double door, hatches, access doors, louvred intakes.
  const mr = (o: number) => MID + o
  const grille = (a0: number, a1: number, z0: number, z1: number) => {
    flank(rrect(a0, a1, z0, z1, 0.04), 'rubber', 'seam', 0.24)
    flank(rrect(a0 + 0.05, a1 - 0.05, z0 + 0.05, z1 - 0.05, 0.02), 'void', 'faint', 0.1)
    const n = 8
    for (let i = 0; i < n; i++) {
      const z = z0 + 0.09 + ((z1 - z0 - 0.18) * i) / (n - 0.4)
      flank(rect(a0 + 0.09, a1 - 0.09, z, z + 0.034), 'metal', 'faint', 0.09, 0.006)
    }
  }
  const hatch = (a0: number, a1: number, z0: number, z1: number) => {
    flankLine(rrect(a0, a1, z0, z1, 0.04), 'seam', 0.2, true)
    flankLine(rrect(a0 + 0.06, a1 - 0.06, z0 + 0.06, z1 - 0.06, 0.03), 'faint', 0.11, true)
    flank(
      rect(a1 - 0.2, a1 - 0.1, (z0 + z1) / 2 - 0.02, (z0 + z1) / 2 + 0.02),
      'metal',
      'faint',
      0.1,
      0.006,
    )
  }
  const door = (a0: number, a1: number, z0: number, z1: number, hingeLeft: boolean) => {
    flankLine(rrect(a0, a1, z0, z1, 0.05), 'seam', 0.26, true)
    const hx = hingeLeft ? a0 : a1
    for (const z of [z0 + 0.25, (z0 + z1) / 2, z1 - 0.25])
      flank(rect(hx - 0.02, hx + 0.02, z - 0.05, z + 0.05), 'rubber', 'faint', 0.1, 0.006)
    const lx = hingeLeft ? a1 - 0.14 : a0 + 0.14
    flank(
      rrect(lx - 0.045, lx + 0.045, (z0 + z1) / 2 - 0.12, (z0 + z1) / 2 + 0.06, 0.02),
      'metal',
      'faint',
      0.1,
      0.006,
    )
    flank(ellipse(lx, (z0 + z1) / 2 - 0.19, 0.016, 0.016, 8), 'void', undefined, 0.1, 0.006)
  }
  // Centre double door.
  door(mr(-0.62), mr(0), 1.64, 3.3, true)
  door(mr(0), mr(0.62), 1.64, 3.3, false)
  for (const sg of [-1, 1]) {
    const s = (a: number, b: number): [number, number] =>
      sg > 0 ? [mr(a), mr(b)] : [mr(-b), mr(-a)]
    const [h0, h1] = s(0.9, 2.3)
    hatch(h0, h1, 2.4, 3.3)
    hatch(h0, h1, 1.66, 2.3)
    const [d0, d1] = s(2.6, 3.6)
    door(d0, d1, 1.64, 3.3, sg < 0)
    const [g0, g1] = s(3.9, 5.3)
    grille(g0, g1, 2.4, 3.3)
    hatch(g0, g1, 1.66, 2.3)
    const [k0, k1] = s(5.55, 6.65)
    grille(k0, k1, 2.4, 3.3)
    hatch(k0, k1, 1.66, 2.3)
  }
  // Jacking pads under the sill at the bogie ends, and marker lamps at the cab corners.
  for (const bg of [MID - 4.75, MID + 4.75])
    for (const o of [-2.15, 2.15])
      c.box(bg + o - 0.14, bg + o + 0.14, 1.32, 1.5, Z0 - 0.16, Z0, 'metal', 0.22)
  for (const e of [0, 1] as const) {
    const [m0, m1] = span(e, 0.72, 0.86)
    flank(rrect(m0, m1, 1.58, 1.76, 0.03), 'glass', 'seam', 0.14, 0.006)
  }
  // Number plate.
  flank(rrect(MID - 0.45, MID + 0.45, 1.72, 1.85, 0.02), 'metal', 'seam', 0.14, 0.006)
}

/** One cab flank: door with its window, hinges and handle, the grab rails and two steps. */
export function cabSide(c: Ctx, e: 0 | 1) {
  const { flank, flankLine, rod, box, fill } = c
  const [d0, d1] = span(e, 1.55, 2.45)
  flankLine(rrect(d0, d1, 1.64, 3.3, 0.06), 'seam', 0.28, true)
  const [w0, w1] = span(e, 1.7, 2.3)
  const win = rrect(w0, w1, 2.4, 3.15, 0.05)
  flank(win, 'rubber', 'seam', 0.28, 0.006)
  flank(shrink(win, 0.86), 'glass', 'faint', 0.12, 0.008)
  // A sliding pane's top rail and the reflection.
  flankLine(
    [
      [w0 + 0.06, 2.78],
      [w1 - 0.06, 2.78],
    ],
    'faint',
    0.12,
    false,
    0.01,
  )
  flank(
    [
      [w0 + 0.1, 2.5],
      [w0 + 0.22, 2.5],
      [w1 - 0.1, 3.05],
      [w1 - 0.22, 3.05],
    ],
    'metal',
    'faint',
    0.08,
    0.01,
  )
  const hx = e === 0 ? d0 : d1
  for (const z of [1.9, 2.5, 3.05])
    flank(rect(hx - 0.02, hx + 0.02, z - 0.05, z + 0.05), 'rubber', 'faint', 0.1, 0.006)
  const lx = e === 0 ? d1 - 0.12 : d0 + 0.12
  flank(rrect(lx - 0.045, lx + 0.045, 2.05, 2.23, 0.02), 'metal', 'faint', 0.1, 0.006)
  flank(ellipse(lx, 1.97, 0.016, 0.016, 8), 'void', undefined, 0.1, 0.006)
  // Grab rails either side of the door, on stand-off brackets.
  for (const t of [1.38, 2.62]) {
    const a = T(e, t)
    rod(at(a, HW + 0.07, 1.8), at(a, HW + 0.07, 3.05), 0.028, 'metal', 0.18)
    for (const z of [1.8, 3.05]) rod(at(a, HW, z), at(a, HW + 0.07, z), 0.02, 'metal', 0.12)
  }
  // Cab mirror: an arm off the wall carrying a camera pod.
  const ma = T(e, 1.25)
  rod(at(ma, HW, 2.86), at(ma, HW + 0.3, 2.9), 0.02, 'metal', 0.14)
  box(ma - 0.08, ma + 0.08, HW + 0.28, HW + 0.4, 2.82, 3.02, 'rubber', 0.22)
  flank(
    [
      [ma - 0.05, 2.86],
      [ma + 0.05, 2.86],
      [ma + 0.05, 2.98],
      [ma - 0.05, 2.98],
    ],
    'glass',
    undefined,
    0.1,
    0.41,
  )
  // Two steps down from the door sill: tread plates with their slots, and the stringers that carry them.
  const [s0, s1] = span(e, 1.5, 2.5)
  for (const [z, y0] of [
    [1.2, 1.08],
    [0.78, 1.16],
  ] as const) {
    box(s0 - 0.05, s0, y0, 1.46, z - 0.4, Z0, 'rubber', 0.25)
    box(s1, s1 + 0.05, y0, 1.46, z - 0.4, Z0, 'rubber', 0.25)
    box(s0, s1, y0, 1.46, z - 0.045, z, 'metal', 0.3)
    for (let i = 0; i < 6; i++) {
      const a = s0 + 0.08 + i * ((s1 - s0 - 0.2) / 5)
      fill(
        [
          at(a, y0 + 0.05, z + 0.003),
          at(a + 0.07, y0 + 0.05, z + 0.003),
          at(a + 0.07, 1.41, z + 0.003),
          at(a, 1.41, z + 0.003),
        ],
        'void',
        undefined,
        0.1,
      )
    }
  }
}

/** The nose end's face: livery panel, lamps, plate, the raked screen, wipers and visor. */
export function cabFront(c: Ctx) {
  const { fill, line, G, P, kitSolid, out, ring, circle } = c
  const A = BODY1 + 0.004
  const front = (y: number, z: number): V3 => at(A, y, z)
  // Livery panel across the lower face, as the flank's stripe wraps round the nose.
  fill([front(-HW, Z0), front(HW, Z0), front(HW, 1.98), front(-HW, 1.98)], 'livery', 'seam', 0.12)
  // Headlamps (two low, one on the roof) with tail lamps outboard of them.
  for (const sg of [-1, 1]) {
    const F = G.frameAlong(front(sg * 0.95, 1.74), [1, 0, 0])
    out.push(kitSolid(G.disc(0, 0.02, 0.17, F, P, { steps: 28 }), 'rubber', [], 0.2))
    out.push(kitSolid(G.disc(0.02, 0.035, 0.13, F, P, { steps: 28 }), 'metal', [], 0.2))
    ring(F, 0.036, 0.1, 'glass', 'seam', 0.14)
    circle(F, 0.037, 0.055, 'faint', 0.1)
    const F2 = G.frameAlong(front(sg * 1.33, 1.74), [1, 0, 0])
    out.push(kitSolid(G.disc(0, 0.02, 0.085, F2, P, { steps: 20 }), 'rubber', [], 0.18))
    ring(F2, 0.022, 0.06, 'glass', 'seam', 0.12)
  }
  // Number plate between the lamps.
  fill(
    [front(-0.32, 1.6), front(0.32, 1.6), front(0.32, 1.76), front(-0.32, 1.76)],
    'metal',
    'seam',
    0.14,
  )
  // Panel line where the livery panel meets the upper face, and door-handle-style lifting eyes.
  line([front(-HW, 1.98), front(HW, 1.98)], 'faint', 0.12)
  const zt = roofAt(BODY1)
  line(
    sample(30, (t) => front(-HW + 2 * HW * t, topOfY(zt, -HW + 2 * HW * t) - 0.35)),
    'faint',
    0.12,
  )
  // The raked screen: seal, two panes with the pillar between, and the visor above.
  const slope = (e: number, y: number, off = 0.004): V3 => at(BODY1 - e, y, roofAt(BODY1 - e) + off)
  const poly = (e0: number, e1: number, y0: number, y1: number): V3[] => [
    ...sample(6, (t) => slope(e0, y0 + (y1 - y0) * t)),
    ...sample(14, (t) => slope(e0 + (e1 - e0) * t, y1)),
    ...sample(6, (t) => slope(e1, y1 + (y0 - y1) * t)),
    ...sample(14, (t) => slope(e1 + (e0 - e1) * t, y0)),
  ]
  fill(poly(0.05, 0.62, -0.92, 0.92), 'rubber', 'seam', 0.26)
  fill(poly(0.09, 0.58, -0.86, -0.03), 'glass', 'faint', 0.12)
  fill(poly(0.09, 0.58, 0.03, 0.86), 'glass', 'faint', 0.12)
  fill(poly(0.66, 0.74, -0.92, 0.92), 'rubber', 'seam', 0.2)
  // Reflections.
  fill(
    [
      slope(0.15, 0.4, 0.006),
      slope(0.15, 0.52, 0.006),
      slope(0.5, 0.78, 0.006),
      slope(0.5, 0.66, 0.006),
    ],
    'metal',
    'faint',
    0.08,
  )
  // Wipers parked on the lower seal: arm from the pivot, blade carried on its end.
  for (const sg of [-1, 1]) {
    line([slope(0.1, sg * 0.78, 0.008), slope(0.24, sg * 0.6, 0.008)], 'line', 0.2)
    line([slope(0.24, sg * 0.6, 0.008), slope(0.5, sg * 0.24, 0.008)], 'line', 0.3)
  }
  // Roof headlamp above the visor.
  fill(
    ellipse(0, 0, 0.2, 0.07, 20).map(([y, e]) => slope(0.88 + e, y, 0.005)),
    'rubber',
    'seam',
    0.2,
  )
  fill(
    ellipse(0, 0, 0.15, 0.045, 20).map(([y, e]) => slope(0.88 + e, y, 0.007)),
    'glass',
    'faint',
    0.1,
  )
}

/** One end's structure: headstock, buffers, coupler, air hoses, handrails and the pilot. */
export function end(c: Ctx, e: 0 | 1) {
  const { box, prismY, rod, lathe, G, P, kitSolid, out, circle } = c
  const o = e ? 1 : -1
  const face = e ? BODY1 : BODY0
  const tip = e ? LENGTH : 0
  const lo = (a: number, b: number): [number, number] => (a < b ? [a, b] : [b, a])
  // Pilot below the headstock: a wedge down to rail height.
  prismY(
    [
      [face - o * 0.2, 0.3],
      [face + o * 0.1, 0.3],
      [face + o * 0.36, 0.98],
      [face - o * 0.2, 0.98],
    ],
    -1.2,
    1.2,
    'rubber',
    0.3,
  )
  const [h0, h1] = lo(face, face + o * 0.14)
  box(h0, h1, -1.46, 1.46, 0.95, 1.4, 'rubber', 0.35)
  // Buffers: guide plate, stock and dished head; the coupler between them.
  for (const y of [-0.875, 0.875]) {
    const [b0, b1] = lo(face + o * 0.14, face + o * 0.2)
    box(b0, b1, y - 0.17, y + 0.17, 1.01, 1.35, 'metal', 0.25)
    rod(at(face + o * 0.2, y, 1.18), at(tip - o * 0.1, y, 1.18), 0.095, 'metal', 0.22)
    lathe(
      at(tip - o * 0.1, y, 1.18),
      at(tip + o * 0.5, y, 1.18),
      [
        [0, 0.17],
        [0.025, 0.2],
        [0.07, 0.2],
        [0.1, 0.18],
      ].map(([s, r]) => [s, r] as [number, number]),
      'metal',
      0.28,
      28,
    )
    if (e) {
      const F = G.frameAlong(at(tip, y, 1.18), [1, 0, 0])
      circle(F, 0.001, 0.12, 'faint', 0.12)
    }
  }
  // Screw coupler: draw hook, its link and the hook's shank.
  rod(at(face + o * 0.14, 0, 1.12), at(tip - o * 0.22, 0, 1.12), 0.05, 'rubber', 0.25)
  const [k0, k1] = lo(tip - o * 0.3, tip - o * 0.12)
  box(k0, k1, -0.075, 0.075, 1.0, 1.24, 'metal', 0.25)
  const F = G.frameAlong(at(tip - o * 0.32, 0, 0.86), [0, 1, 0])
  out.push(kitSolid(G.ringBand(-0.02, 0.02, 0.065, 0.11, F, P, { steps: 24 }), 'metal', [], 0.2))
  rod(at(tip - o * 0.32, 0, 0.97), at(tip - o * 0.3, 0, 1.06), 0.02, 'metal', 0.12)
  // Air hoses: pipe, hose and the angle cock, either side of the coupler.
  for (const y of [-0.42, 0.42]) {
    rod(at(face + o * 0.1, y, 0.96), at(face + o * 0.1, y, 0.8), 0.03, 'metal', 0.15)
    rod(at(face + o * 0.1, y, 0.8), at(face + o * 0.24, y, 0.7), 0.026, 'rubber', 0.15)
    rod(at(face + o * 0.24, y, 0.7), at(face + o * 0.26, y, 0.62), 0.04, 'metal', 0.15)
  }
  // Handrails on the end face, either side, on stand-off brackets.
  for (const y of [-1.3, 1.3]) {
    for (const z of [1.55, 2.4]) rod(at(face, y, z), at(face + o * 0.07, y, z), 0.02, 'metal', 0.12)
    rod(at(face + o * 0.07, y, 1.55), at(face + o * 0.07, y, 2.4), 0.028, 'metal', 0.18)
  }
}
export { body }
