// MH: a Marshallese stick chart (rebbelib style). Straight coconut-rib frame sticks lashed at the
// corners, a cross of mid sticks, two curved diagonals and four bowed swell sticks, with small
// cowrie shells at the joints. The whole chart is rotated a few degrees so it reads as handmade.
// The box is the chart before rotation. The chart is a lit paper field; background hatching stops
// a halo short of its outline.
import {
  type Pt,
  type SvgNode,
  cubic,
  fill,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

export const stickChart: KitModule = ([x, y, w, h], p) => {
  const tilt = (num(p, 'tilt', -7) * Math.PI) / 180
  const cx = x + w / 2
  const cy = y + h / 2
  const rot = ([px, py]: Pt): Pt => {
    const dx = px - cx
    const dy = py - cy
    return [
      cx + dx * Math.cos(tilt) - dy * Math.sin(tilt),
      cy + dx * Math.sin(tilt) + dy * Math.cos(tilt),
    ]
  }
  const R = (pts: Pt[]): Pt[] => pts.map(rot)
  const out: SvgNode[] = []
  const l = x
  const r = x + w
  const t = y
  const b = y + h
  const shadow = R(rectPts(l - 2, t + 5, w + 8, h + 6))
  out.push(occlude(shadow), ...toneFill(shadow, 'T4', { gap: 2.4, inset: 0.4 }))
  out.push(occlude(R(rectPts(l - 3, t - 3, w + 6, h + 6)), { halo: 3 }))
  const stick = (pts: Pt[], wt: 'bold' | 'line' | 'hair' = 'line') => out.push(stroke(wt, R(pts)))
  // frame, with sticks overshooting the corners
  stick(
    [
      [l - 4, t],
      [r + 4, t],
    ],
    'bold',
  )
  stick(
    [
      [l - 4, b],
      [r + 4, b],
    ],
    'bold',
  )
  stick(
    [
      [l, t - 4],
      [l, b + 4],
    ],
    'bold',
  )
  stick(
    [
      [r, t - 4],
      [r, b + 4],
    ],
    'bold',
  )
  // cross of mid sticks
  stick(
    [
      [l, cy],
      [r, cy],
    ],
    'line',
  )
  stick(
    [
      [cx, t],
      [cx, b],
    ],
    'line',
  )
  // curved diagonals (shallow S bends) and swell sticks: a bowed stick from each frame midpoint to
  // the next, bulging toward the centre
  const d1 = cubic([l, t], [l + w * 0.3, t + h * 0.5], [r - w * 0.3, b - h * 0.5], [r, b], 20)
  const d2 = cubic([r, t], [r - w * 0.3, t + h * 0.5], [l + w * 0.3, b - h * 0.5], [l, b], 20)
  const bows = [
    quad([cx, t], [cx - w * 0.22, cy - h * 0.22], [l, cy], 14),
    quad([l, cy], [cx - w * 0.22, cy + h * 0.22], [cx, b], 14),
    quad([cx, b], [cx + w * 0.22, cy + h * 0.22], [r, cy], 14),
    quad([r, cy], [cx + w * 0.22, cy - h * 0.22], [cx, t], 14),
  ]
  stick(d1)
  stick(d2)
  for (const bow of bows) stick(bow)
  // cowrie shells: oval fills with a pale slit, at the joints and one on each bow
  const shell = ([px, py]: Pt, s = 1) => {
    const [qx, qy] = rot([px, py])
    const ring: Pt[] = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      return [qx + Math.cos(a) * 4 * s, qy + Math.sin(a) * 3.2 * s] as Pt
    })
    out.push(occlude(ring), fill(ring))
    out.push(
      stroke('fine', [
        [qx - 2 * s, qy],
        [qx + 2 * s, qy],
      ]),
    )
  }
  for (const s of [
    [cx, cy],
    [cx, t],
    [cx, b],
    [l, cy],
    [r, cy],
  ] as Pt[])
    shell(s, 1.15)
  for (const s of [d1[5], d1[15], d2[5], d2[15], ...bows.map((bw) => bw[7])]) shell(s, 0.9)
  return out
}
