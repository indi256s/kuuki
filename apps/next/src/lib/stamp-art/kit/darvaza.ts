import { clipPoly } from './rock-b'
// Darvaza gas crater (Turkmenistan), seen at eye level on a night desert. The crater is a thin dark
// lens cut into flat ground: a lit near rim (T0, bold lip), a dark lens with the far inner wall in
// T4 above it and a lit far rim. Seven pointed flame tongues (T0) rise out of the lens into a solid glow.
// The box is the whole scene: bottom = near rim, top = flame tip, the near rim.
import { type Pt, type SvgNode, cubic, fill, hatchPoly, occlude, quad, stroke } from '../grid'

/** Polygon with the given winding (1 or -1 by shoelace sign), so fills can cut holes. */
const orient = (pts: Pt[], dir: 1 | -1): Pt[] => {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.sign(a) === dir ? pts : [...pts].reverse()
}
import type { KitModule } from './util'

export const darvaza: KitModule = ([x, y, w, h]) => {
  const cx = x + w / 2
  const base = y + h
  const lensY = base - 9
  const out: SvgNode[] = []

  // Flame tongues: S-curved leaves rising from the lens, leaning with the wind. [x offset as a
  // fraction of the width, height as a fraction of the tallest, base half-width, lean].
  const top = y + 2
  const gh = lensY - top
  const yb = lensY + 1
  const specs: [number, number, number, number][] = [
    [-0.31, 0.4, 6.2, -6],
    [-0.2, 0.7, 7.4, -8],
    [-0.08, 0.98, 8.6, -9],
    [0.04, 0.52, 6.4, 6],
    [0.14, 0.75, 7.2, 8],
    [0.25, 0.5, 6.6, 7],
    [0.34, 0.32, 5.4, 5],
  ]
  const tongues = specs.map(([ox, hf, fw, lean]) => {
    const bx = cx + w * ox
    const fh = gh * 0.95 * hf
    const tip: Pt = [bx + lean, yb - fh]
    const l = cubic(
      [bx - fw, yb],
      [bx - fw * 1.3, yb - fh * 0.4],
      [bx + lean * 1.4 - fw * 0.2, yb - fh * 0.66],
      tip,
      10,
    )
    const r = cubic(
      tip,
      [bx + lean * 0.9 + fw * 0.9, yb - fh * 0.62],
      [bx + fw * 1.4, yb - fh * 0.28],
      [bx + fw, yb],
      10,
    )
    return { poly: [...l, ...r.slice(1)] as Pt[], tip, fw }
  })

  // Glow: a rounded envelope 4 units around the tongues. The lower part is solid T5 with the
  // tongues cut out of it (reversed winding); above it the glow thins into vertical T4 hatching.
  const env: Pt[] = []
  const x0 = cx - w * 0.38
  const x1 = cx + w * 0.38
  for (let px = x0; px <= x1; px += 2) {
    let ey = yb - 4
    for (const t of tongues)
      for (const [qx, qy] of t.poly) {
        const dx = px - qx
        if (Math.abs(dx) < 14) ey = Math.min(ey, qy - 4 + 0.16 * dx * dx)
      }
    env.push([px, ey])
  }
  const coreY = yb - gh * 0.2
  const core: Pt[] = [[x0, yb], ...env.map(([px, ey]): Pt => [px, Math.max(ey, coreY)]), [x1, yb]]
  out.push(occlude(core))
  out.push(fill(orient(core, 1)))
  for (const t of tongues) {
    out.push(occlude(t.poly, { halo: 3 }))
    out.push(stroke('hair', t.poly))
    const low = clipPoly(t.poly, ([, qy]) => qy - coreY)
    if (low.length > 2) out.push(fill(orient(low, -1)))
  }

  // Crater: lit far rim, T4 far inner wall, dark lens, lit near rim with a bold lip.
  const lensTop = base - 14
  const half = w * 0.365
  const farRim: Pt[] = [
    ...quad([cx - half - 2.5, base - 8], [cx, lensTop - 6.5], [cx + half + 2.5, base - 8], 14),
  ]
  const lens: Pt[] = [
    ...quad([cx - half, base - 8], [cx, lensTop - 1.5], [cx + half, base - 8], 14),
    ...quad([cx + half, base - 8], [cx, base + 1.5], [cx - half, base - 8], 14).slice(1),
  ]
  const nearRim: Pt[] = [
    ...quad([cx - half - 5, base - 7], [cx, base + 8], [cx + half + 5, base - 7], 14),
    [cx + half + 5, base + 9],
    [cx - half - 5, base + 9],
  ]
  out.push(occlude(farRim, { halo: 0 }))
  out.push(stroke('hair', farRim))
  out.push(occlude(lens))
  const wall: Pt[] = [
    ...quad([cx - half, base - 8], [cx, lensTop - 1.5], [cx + half, base - 8], 14),
    ...quad([cx + half, base - 8], [cx, base - 6.5], [cx - half, base - 8], 14).slice(1),
  ]
  out.push(...hatchPoly(wall, { angle: 90, gap: 2, weight: 'hair' }))
  const floor: Pt[] = [
    ...quad([cx + half * 0.96, base - 6.8], [cx, base - 5], [cx - half * 0.96, base - 6.8], 14),
    ...quad(
      [cx - half * 0.96, base - 6.8],
      [cx, base + 1.2],
      [cx + half * 0.96, base - 6.8],
      14,
    ).slice(1),
  ]
  out.push(fill(floor))
  out.push(stroke('line', lens, true))
  out.push(occlude(nearRim))
  out.push(stroke('bold', nearRim.slice(0, 15)))
  return out
}
