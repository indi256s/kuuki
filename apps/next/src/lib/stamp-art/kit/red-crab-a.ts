// Christmas Island red crab (lane A, `-a` until consolidated), front-high view: a wide carapace on
// four splayed legs a side, eye stalks, two arms raised to open pincers. The box is the crab with
// its feet on the bottom; `rock` (fraction of the height) sits it on a T4 boulder. Lit shapes with
// outlines throughout, dark only in the pincer notches, eyes and the boulder.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatchPoly, occlude, quad, stroke } from '../grid'
import { type KitModule, num } from './util'

const CLAW: Pt[] = [
  [-5, 0],
  [-9, -7],
  [-9.5, -14],
  [-6.5, -20],
  [-3, -25],
  [-1.2, -18],
  [1, -12.5],
  [3, -19],
  [3.8, -26],
  [7, -21],
  [9.5, -14],
  [9, -7],
  [5, 0],
]

export const redCrabA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const out: SvgNode[] = []
  const rock = num(p, 'rock', 0)
  const base = y + h
  const rockH = rock * h
  const feet = base - rockH + 1
  const ch = feet - y
  const cx = x + w / 2
  const sc = w / 72 // claw and leg weights are tuned for a 72-wide crab
  const bodyY = y + ch * 0.64
  const rx = w * 0.27
  const ry = ch * 0.21
  const weightLeg = w < 40 ? 'hair' : 'line'
  if (rockH > 0) {
    const rw = w * 0.62
    const dome = quad([cx - rw, base], [cx, base - rockH * 2.1], [cx + rw, base], 14)
    const poly: Pt[] = [...dome, [cx + rw, base + 1], [cx - rw, base + 1]]
    out.push(
      occlude(poly),
      ...hatchPoly(poly, { angle: 90, gap: 2.8, weight: 'hair', inset: 0.3 }),
      stroke('line', dome),
    )
    out.push(
      stroke('bold', [
        [cx - rw - 2, base + 1],
        [cx + rw + 2, base + 1],
      ]),
    )
  }
  // Legs: four a side, knee out and slightly up, foot down and out.
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 4; i++) {
      const a = 0.25 + i * 0.3
      const ax = cx + side * rx * Math.cos(a) * 0.95
      const ay = bodyY + ry * Math.sin(a) * 0.9
      const reach = (0.17 + 0.03 * Math.sin(i * 1.3) + 0.01 * i) * w
      const kx = ax + side * reach
      const ky = ay - (0.05 - 0.035 * i) * ch
      const fx = kx + side * (0.05 + 0.01 * i) * w
      const fy = Math.min(feet, ky + (0.22 + 0.04 * i + rand() * 0.02) * ch)
      out.push(
        stroke(weightLeg, [
          [ax, ay],
          [kx, ky],
          [fx, fy],
        ]),
      )
    }
  }
  // Arms and claws (behind the carapace edge).
  for (const side of [-1, 1] as const) {
    const sx = cx + side * rx * 0.82
    const sy = bodyY - ry * 0.55
    const ex = cx + side * (rx + 0.1 * w)
    const ey = bodyY - ry * 1.55
    const wx = cx + side * (rx + 0.03 * w)
    const wy = bodyY - ry * 2.5
    const arm: Pt[] = [
      ...quad([sx, sy - 3 * sc], [ex + side * 3 * sc, ey], [wx - 3.4 * sc, wy], 8),
      ...quad([wx + 3.4 * sc, wy], [ex + side * 3 * sc + 4 * sc, ey + 2], [sx, sy + 3 * sc], 8),
    ]
    out.push(...body(arm, weightLeg === 'line' ? 'line' : 'hair'))
    const ang = side * 0.32
    const cs = Math.cos(ang),
      sn = Math.sin(ang)
    const claw = CLAW.map(([px, py]): Pt => {
      const qx = px * sc * 1.12,
        qy = py * sc * 1.12
      return [wx + qx * cs - qy * sn, wy + qx * sn + qy * cs]
    })
    out.push(...body(claw, weightLeg === 'line' ? 'line' : 'hair'))
    const nt = [CLAW[5], CLAW[6], CLAW[7]].map(([px, py]): Pt => {
      const qx = px * sc * 1.12,
        qy = py * sc * 1.12
      return [wx + qx * cs - qy * sn, wy + qx * sn + qy * cs]
    })
    out.push(fill(nt))
  }
  // Carapace: a wide superellipse, lit, with two shell grooves.
  const shell: Pt[] = []
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * Math.PI * 2
    const c = Math.cos(t),
      s = Math.sin(t)
    shell.push([
      cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 0.8),
      bodyY + ry * Math.sign(s) * Math.pow(Math.abs(s), 0.9) * (s < 0 ? 0.85 : 1),
    ])
  }
  out.push(...body(shell, weightLeg === 'line' ? 'line' : 'hair'))
  out.push(
    stroke(
      'fine',
      quad(
        [cx - rx * 0.6, bodyY - ry * 0.3],
        [cx - rx * 0.25, bodyY + ry * 0.2],
        [cx - rx * 0.1, bodyY + ry * 0.7],
        6,
      ),
    ),
    stroke(
      'fine',
      quad(
        [cx + rx * 0.6, bodyY - ry * 0.3],
        [cx + rx * 0.25, bodyY + ry * 0.2],
        [cx + rx * 0.1, bodyY + ry * 0.7],
        6,
      ),
    ),
  )
  // Eyes on short stalks.
  for (const side of [-1, 1] as const) {
    const ex = cx + side * rx * 0.28
    const ey = bodyY - ry * 0.92
    out.push(
      stroke('hair', [
        [ex, ey + 1],
        [ex + side * 0.8, ey - 3.2 * sc],
      ]),
    )
    const r = Math.max(1.3, 1.8 * sc)
    out.push(
      fill([
        [ex + side * 0.8 - r, ey - 3.2 * sc],
        [ex + side * 0.8, ey - 3.2 * sc - r],
        [ex + side * 0.8 + r, ey - 3.2 * sc],
        [ex + side * 0.8, ey - 3.2 * sc + r],
      ]),
    )
  }
  return out
}
