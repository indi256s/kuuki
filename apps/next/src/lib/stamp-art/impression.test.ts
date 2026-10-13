import { describe, expect, it } from 'vitest'
import { SHAPE_NAMES, frames, type RingPath } from './frame'
import type { Pt } from './grid'
import { impressionGapPolys } from './impression'
import { RING_CAP } from './frame'

/** Dense sample of a ring path's text band: baseline points offset 0..cap toward the glyph tops. */
function band(path: RingPath): Pt[] {
  const pts: Pt[] = []
  const tokens = path.d.match(/[MLHA][^MLHAZ]*/g) ?? []
  const base: { p: Pt; up: Pt }[] = []
  let cur: Pt = [0, 0]
  for (const tok of tokens) {
    const v = tok
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (tok[0] === 'M') cur = [v[0], v[1]]
    else if (tok[0] === 'A') {
      const [rx, ry, , , sweep, ex, ey] = v
      const cx = (cur[0] + ex) / 2
      const top = sweep === 1
      for (let i = 0; i <= 120; i++) {
        const a = Math.PI + (top ? 1 : -1) * (i / 120) * Math.PI
        const p: Pt = [cx + rx * Math.cos(a), cur[1] + ry * Math.sin(a)]
        // Tangent of the travel direction; glyph tops point to the left of it.
        const t: Pt = [-rx * Math.sin(a) * (top ? 1 : -1), ry * Math.cos(a) * (top ? 1 : -1)]
        const len = Math.hypot(t[0], t[1])
        base.push({ p, up: [t[1] / len, -t[0] / len] })
      }
      cur = [ex, ey]
    } else {
      const to: Pt = tok[0] === 'H' ? [v[0], cur[1]] : [v[0], v[1]]
      const len = Math.hypot(to[0] - cur[0], to[1] - cur[1])
      for (let i = 0; i <= len; i++) {
        const k = len ? i / len : 0
        base.push({
          p: [cur[0] + (to[0] - cur[0]) * k, cur[1] + (to[1] - cur[1]) * k],
          up: [(to[1] - cur[1]) / len, -(to[0] - cur[0]) / len],
        })
      }
      cur = to
    }
  }
  for (const { p, up } of base)
    for (let u = 0; u <= RING_CAP; u += 1) pts.push([p[0] + up[0] * u, p[1] + up[1] * u])
  return pts
}

describe('impression dropouts', () => {
  it.each(SHAPE_NAMES)('%s: no dropout touches the ring text band', (shape) => {
    const bands = [band(frames[shape].ring.top), band(frames[shape].ring.bottom)].flat()
    for (const [i, poly] of impressionGapPolys(shape).entries()) {
      const pts: Pt[] = [
        ...poly,
        [
          poly.reduce((s, q) => s + q[0], 0) / poly.length,
          poly.reduce((s, q) => s + q[1], 0) / poly.length,
        ],
      ]
      for (const q of pts) {
        const near = bands.find((b) => Math.hypot(b[0] - q[0], b[1] - q[1]) < 1.2)
        expect(near, `${shape} blob ${i} at ${q.map((n) => n.toFixed(1))}`).toBeUndefined()
      }
    }
  })
})
