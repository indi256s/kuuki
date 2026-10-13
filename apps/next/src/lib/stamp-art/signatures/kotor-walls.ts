// ME: the walls of Kotor zig-zagging straight up the slope to the tower at the top.
import { type Pt, type SvgNode, body, stroke } from '../grid'
import type { KitModule } from '../kit'
import { tower } from '../kit/wall'
import { num } from '../kit/util'

/** Wall runs bottom-left to the tower top-right in switchbacks; its height shows as a band. */
export const kotorWalls: KitModule = ([x, y, w, h], p) => {
  const wallH = num(p, 'wallH', 7)
  const towerW = num(p, 'towerW', 15)
  const towerH = num(p, 'towerH', 24)
  const bottom = y + h
  const topY = y + towerH
  // Switchback waypoints as fractions of the box; the wall always gains height.
  const route: Pt[] = [
    [0.0, 1.0],
    [0.46, 0.7],
    [0.2, 0.5],
    [0.7, 0.28],
    [0.52, 0.12],
    [0.82, 0.0],
  ].map(([fx, fy]) => [x + (w - towerW) * fx, topY + (bottom - topY) * fy])
  const out: SvgNode[] = []
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i],
      b = route[i + 1]
    const quadPts: Pt[] = [a, b, [b[0], b[1] - wallH], [a[0], a[1] - wallH]]
    out.push(...body(quadPts, 'line'))
    // Merlons: short teeth on top, spaced along the run.
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(2, Math.round(len / 6))
    for (let k = 0; k < n; k++) {
      const t0 = (k + 0.1) / n,
        t1 = (k + 0.62) / n
      const pa: Pt = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 - wallH]
      const pb: Pt = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 - wallH]
      out.push(stroke('line', [pa, [pa[0], pa[1] - 2.4], [pb[0], pb[1] - 2.4], pb]))
    }
    // One course line along the middle of the band.
    out.push(
      stroke('hair', [
        [a[0] + 1, a[1] - wallH * 0.45],
        [b[0] - 1, b[1] - wallH * 0.45],
      ]),
    )
  }
  // Tower at the top end of the wall.
  const end = route[route.length - 1]
  out.push(
    ...tower([end[0] - 1, y - 1 + 0, towerW, end[1] - y + 1], {
      cap: 'battle',
      merlons: 3,
      openings: 'slits',
      slitRows: 1,
      taper: 0.03,
      shade: true,
    }),
  )
  return out
}
