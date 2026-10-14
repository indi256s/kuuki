// Karst module: limestone islets rising sheer from calm water (Ha Long Bay). `islets` lists
// [centre x, width, height, depth] per islet as fractions of the box (height from the waterline at
// the box bottom; depth 0 is the nearest, 1 the farthest). Far islets are a light diagonal T2
// hatch with a hair outline; near ones are lit paper on the left with sparse fissures, and a
// shaded right side of vertical hair lines of staggered length. Every islet is undercut at the
// waterline and capped with a rounded, tufted crown. An optional `junk` ([centre x, size]) adds a
// small junk sail in front.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, nums, num } from './util'

type Islet = { cx: number; w: number; h: number; depth: number }

export const karst: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 23)))
  const flat = nums(p, 'islets', [0.2, 0.28, 0.9, 0.6, 0.62, 0.3, 1, 0.5, 0.85, 0.24, 0.7, 0.8])
  const islets: Islet[] = []
  for (let i = 0; i + 3 < flat.length; i += 4)
    islets.push({ cx: x + w * flat[i], w: w * flat[i + 1], h: h * flat[i + 2], depth: flat[i + 3] })
  islets.sort((a, b) => b.depth - a.depth)
  const base = y + h
  const out: SvgNode[] = []

  for (const it of islets) {
    const far = it.depth > 0.5
    const hw = it.w / 2
    const N = 36
    const left: Pt[] = [],
      right: Pt[] = []
    const bumpA = rand() * 6,
      bumpB = rand() * 6
    const lean = (rand() - 0.5) * 0.18 * it.w
    const taper = 0.22 + rand() * 0.25
    const shoulder = 0.84
    // Sides: undercut at the waterline, a belly, a taper toward the shoulder, crags along the way.
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * shoulder
      let f = 1 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.6)) - taper * t * t
      if (t < 0.05) f *= 0.8 + 0.2 * (t / 0.05)
      const yy = base - it.h * t
      const sh = lean * t
      const lw = hw * f * (1 + 0.07 * Math.sin(t * 17 + bumpA) + 0.04 * Math.sin(t * 41))
      const rw = hw * f * (1 + 0.07 * Math.sin(t * 15 + bumpB) + 0.04 * Math.sin(t * 37))
      left.push([it.cx - lw + sh, yy])
      right.push([it.cx + rw + sh, yy])
    }
    // Crown: a ragged cap across the full width at the shoulder, the dome higher in the middle.
    const lTop = left[left.length - 1],
      rTop = right[right.length - 1]
    const crownPts: Pt[] = []
    const phase = rand() * 6
    const M = 12
    for (let i = 1; i < M; i++) {
      const u = (i / M) * 2 - 1
      const cxp = (lTop[0] + rTop[0]) / 2
      const halfTop = (rTop[0] - lTop[0]) / 2
      crownPts.push([
        cxp + u * halfTop,
        base -
          it.h *
            (shoulder + (1 - shoulder) * (1 - Math.abs(u) ** 1.8 + 0.25 * Math.sin(u * 7 + phase))),
      ])
    }
    left.push(...crownPts.slice(0, Math.ceil(crownPts.length / 2)))
    right.push(...crownPts.slice(Math.ceil(crownPts.length / 2)).reverse())
    const sil: Pt[] = [...left, ...right.slice().reverse()]
    out.push(occlude(sil))
    const rim = sil
    if (far) {
      out.push(...toneFill(sil, 'T2', { angle: -58, gap: 3 }))
      out.push(stroke('hair', rim))
      continue
    }
    // Shaded right side: vertical hair lines of staggered length, from the right edge inward.
    const xr = it.cx + hw * 0.05
    const acc: SvgNode[] = []
    for (let px = xr; px < it.cx + hw; px += 2.2) {
      // Line spans from just under the crown line to just above the waterline where it lies inside.
      let top = base
      for (let i = N; i >= 0; i--)
        if (right[i][0] >= px) {
          top = right[i][1]
          break
        }
      const yTop = top + 2 + rand() * 6
      if (base - 2 - yTop < 4) continue
      const hatchBot = base - 1.5 - (rand() < 0.4 ? rand() * it.h * 0.3 : 0)
      acc.push(
        stroke('hair', [
          [px, yTop],
          [px, hatchBot],
        ]),
      )
    }
    out.push(...acc)
    // Lit side: a few fine fissures.
    for (let k = 0; k < 4; k++) {
      const px = it.cx - hw * (0.7 - k * 0.2) + (rand() - 0.5) * 2
      const yTop = base - it.h * (0.7 - rand() * 0.2)
      out.push(
        stroke('fine', [
          [px, yTop],
          [px + (rand() - 0.5) * 2, yTop + it.h * (0.25 + rand() * 0.2)],
        ]),
      )
    }
    // Crown tufts.
    for (let k = 0; k < 5; k++) {
      const t = 0.9 + rand() * 0.05
      const i = Math.round(N * t)
      const gx = left[i][0] + (right[i][0] - left[i][0]) * (0.2 + 0.15 * k)
      const gy = base - it.h * (t + 0.03) + 1.2 + rand()
      out.push(
        stroke('fine', [
          [gx, gy + 3],
          [gx + (rand() - 0.5) * 1.5, gy],
        ]),
      )
    }
    out.push(stroke('line', rim))
    // Waterline notch: a short bold line at the foot.
    out.push(hline('hair', it.cx - hw * 0.78, it.cx + hw * 0.82, base - 0.5))
  }

  const junk = nums(p, 'junk', [])
  if (junk.length === 2) {
    const jx = x + w * junk[0],
      s = junk[1]
    const hullY = base - 1
    const hull: Pt[] = [
      [jx - s * 0.55, hullY - s * 0.14],
      [jx - s * 0.4, hullY],
      [jx + s * 0.45, hullY],
      [jx + s * 0.6, hullY - s * 0.2],
    ]
    out.push(occlude([...hull, [jx + s * 0.1, hullY - s * 1.1], [jx - s * 0.1, hullY - s * 1.1]]))
    const sail: Pt[] = [
      [jx - s * 0.05, hullY - s * 0.2],
      [jx - s * 0.05, hullY - s * 1.1],
      [jx + s * 0.4, hullY - s * 0.95],
      [jx + s * 0.5, hullY - s * 0.2],
    ]
    out.push(stroke('hair', sail, true))
    for (const f of [0.4, 0.6, 0.8])
      out.push(
        stroke('fine', [
          [jx - s * 0.05, hullY - s * f],
          [jx + s * 0.47 - f * 0.1 * s, hullY - s * f + (1 - f) * 0.1 * s],
        ]),
      )
    out.push(stroke('line', hull))
  }
  return out
}
