// A Bo'Bo' bogie of the locomotive: wheel sets with their lightening holes and hubs, axle boxes with coil springs and
// dampers, the inboard side beam between the wheels, brake units and the air springs under the body.
import { dot, type V3 } from '../airliner/surface'
import { ellipse } from './parts'
import type { Ctx } from './parts'
import { AXLE_OFF, TREAD, WHEEL_R, WHEEL_Y, Z0, at } from './model'

/** A coil spring on a vertical axis: a core with the helix on its front half, every turn ending on the limb. */
export function coil(
  c: Ctx,
  a: number,
  y: number,
  z0: number,
  z1: number,
  r: number,
  turns: number,
) {
  const { rod, line, cam } = c
  rod(at(a, y, z0), at(a, y, z1), r, 'metal', 0.18)
  const run: V3[][] = [[]]
  const n = Math.round(turns * 24)
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      th = 2 * Math.PI * turns * t
    const nrm: V3 = [Math.cos(th), Math.sin(th), 0]
    const visible = dot(nrm, cam.V) > 0.02
    const p = at(a + (r + 0.002) * Math.cos(th), y + (r + 0.002) * Math.sin(th), z0 + (z1 - z0) * t)
    if (visible) run[run.length - 1].push(p)
    else if (run[run.length - 1].length) run.push([])
  }
  for (const r2 of run) if (r2.length > 1) line(r2, 'seam', 0.16)
}

function wheel(c: Ctx, a: number, sg: number) {
  const { G, P, kitSolid, out, fill } = c
  const yc = sg * WHEEL_Y
  const F = G.frameAlong(at(a, yc, WHEEL_R), [0, 1, 0])
  const R = WHEEL_R,
    w = TREAD / 2
  // The face the viewer sees is +s: the outer face of a near wheel, the inner face (flange side) of a far one.
  const flange = sg > 0 ? -1 : 1
  out.push(
    kitSolid(
      G.ringBand(
        flange > 0 ? w - 0.032 : -w,
        flange > 0 ? w : -w + 0.032,
        R * 0.84,
        R + 0.034,
        F,
        P,
        {
          steps: 56,
        },
      ),
      'metal',
      [],
      0.3,
    ),
  )
  out.push(kitSolid(G.ringBand(-w, w, R * 0.84, R, F, P, { steps: 56 }), 'metal', [], 0.4))
  out.push(kitSolid(G.disc(-w * 0.45, w * 0.35, R * 0.86, F, P, { steps: 56 }), 'metal', [], 0.3))
  const face = w * 0.35 + 0.002
  const pt = (x: number, z: number, s = face): V3 => at(a + x, yc + s, R + z)
  // Six lightening holes in the web, a thin ring where the tyre meets it, the hub boss with its bolts.
  for (let i = 0; i < 6; i++) {
    const t = (2 * Math.PI * i) / 6 + 0.2
    const cx = R * 0.5 * Math.cos(t),
      cz = R * 0.5 * Math.sin(t)
    const pts = ellipse(0, 0, 0.085, 0.052, 14).map(([u, v]): V3 => {
      // u along the radial direction, v along the tangent.
      const x = cx + u * Math.cos(t) - v * Math.sin(t),
        z = cz + u * Math.sin(t) + v * Math.cos(t)
      return pt(x, z)
    })
    fill(pts, 'void', 'seam', 0.14)
  }
  out.push(
    kitSolid(
      G.ringBand(w * 0.35, w * 0.55, R * 0.27, R * 0.34, F, P, { steps: 28 }),
      'metal',
      [],
      0.25,
    ),
  )
  out.push(kitSolid(G.disc(w * 0.35, w * 0.75, R * 0.27, F, P, { steps: 28 }), 'metal', [], 0.3))
  for (let i = 0; i < 8; i++) {
    const t = (2 * Math.PI * i) / 8
    fill(
      ellipse(R * 0.2 * Math.cos(t), R * 0.2 * Math.sin(t), 0.012, 0.012, 8).map(([x, z]) =>
        pt(x, z, w * 0.75 + 0.003),
      ),
      'void',
    )
  }
}

export function bogie(c: Ctx, b: number, sg: 1 | -1) {
  const { box, prismY, rod, lathe, line } = c
  const ya = sg > 0 ? 0.44 : -0.6,
    yb = sg > 0 ? 0.6 : -0.44
  // Inboard side beam, dipping between the axles, and the transom between the two side beams.
  prismY(
    [
      [b - 2.15, 0.85],
      [b - 1.9, 0.66],
      [b - 0.75, 0.46],
      [b + 0.75, 0.46],
      [b + 1.9, 0.66],
      [b + 2.15, 0.85],
      [b + 2.15, 1.2],
      [b - 2.15, 1.2],
    ],
    ya,
    yb,
    'rubber',
    0.3,
  )
  if (sg < 0) box(b - 0.24, b + 0.24, -0.6, 0.6, 0.5, 0.95, 'rubber', 0.3)
  // Brake units on the beam and their pistons.
  for (const dx of [-0.58, 0.58]) {
    box(b + dx - 0.15, b + dx + 0.15, sg * 0.5, sg * 0.66, 0.52, 0.82, 'void', 0.25)
    rod(at(b + dx, sg * 0.66, 0.67), at(b + dx, sg * 0.74, 0.67), 0.055, 'metal', 0.2)
  }
  for (const o of [-AXLE_OFF, AXLE_OFF]) wheel(c, b + o, sg)
  if (sg < 0) return
  // Outboard of each near wheel: axle box and its cover, the spring plate, the coil spring and the damper.
  for (const o of [-AXLE_OFF, AXLE_OFF]) {
    const a = b + o
    box(a - 0.21, a + 0.21, 0.84, 1.02, 0.45, 0.8, 'metal', 0.3)
    box(a - 0.21, a + 0.21, 0.6, 1.02, 1.02, 1.18, 'rubber', 0.3)
    lathe(
      at(a, 1.02, WHEEL_R),
      at(a, 1.1, WHEEL_R),
      [
        [0, 0.115],
        [0.03, 0.115],
        [0.06, 0.09],
      ],
      'metal',
      0.25,
    )
    line([at(a - 0.14, 1.025, 0.45 + 0.045), at(a + 0.14, 1.025, 0.45 + 0.045)], 'faint', 0.14)
    coil(c, a, 0.93, 0.8, 1.02, 0.085, 3.5)
    rod(at(a + 0.27, 0.99, 0.6), at(a + 0.43, 0.99, 1.1), 0.026, 'metal', 0.16)
    box(a + 0.23, a + 0.31, 0.95, 1.03, 0.54, 0.62, 'rubber', 0.15)
  }
  // Air springs of the secondary suspension, on outriggers either side of the bogie centre.
  for (const dx of [-0.58, 0.58]) {
    box(b + dx - 0.2, b + dx + 0.2, 0.6, 1.02, 1.12, 1.18, 'rubber', 0.25)
    const h = Z0 - 1.18
    const f = h / 0.2
    lathe(
      at(b + dx, 0.84, 1.18),
      at(b + dx, 0.84, Z0),
      (
        [
          [0, 0.12],
          [0.03, 0.15, 1],
          [0.07, 0.15],
          [0.09, 0.12],
          [0.12, 0.15, 1],
          [0.15, 0.15],
          [0.18, 0.13],
        ] as [number, number, number?][]
      ).map(([s, r, k]) => [s * f, r, k] as [number, number, number?]),
      'rubber',
      0.25,
    )
  }
}
