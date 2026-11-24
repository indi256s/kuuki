import { type Pt, type SvgNode, cubic, fill, occlude, quad, rectPts, stroke } from '../grid'
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
  out.push(occlude(R(rectPts(l - 3, t - 3, w + 6, h + 6)), { halo: 3 }))
  const stick = (pts: Pt[], wt: 'bold' | 'line' | 'hair' = 'line') => out.push(stroke(wt, R(pts)))
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
  const d1 = cubic([l, t], [l + w * 0.3, t + h * 0.5], [r - w * 0.3, b - h * 0.5], [r, b], 20)
  const d2 = cubic([r, t], [r - w * 0.3, t + h * 0.5], [l + w * 0.3, b - h * 0.5], [l, b], 20)
  const bows = [
    quad([cx, t], [cx - w * 0.22, cy - h * 0.22], [l, cy], 14),
    quad([l, cy], [cx - w * 0.22, cy + h * 0.22], [cx, b], 14),
    quad([cx, b], [cx + w * 0.22, cy + h * 0.22], [r, cy], 14),
    quad([r, cy], [cx + w * 0.22, cy - h * 0.22], [cx, t], 14),
  ]
  stick(d1, 'hair')
  stick(d2, 'hair')
  for (const bow of bows) stick(bow)
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

  return out
}
