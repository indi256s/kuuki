import { Scene, type P3 } from '../../../overview/iso/scene'
import { shadowRect } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

/** Bar length, foil end and card sleeve per rung (world units): snack, standard, long, extra long, absurd. */
const LEN = [30, 55, 85, 125, 180],
  FOIL = [4, 5, 6, 8, 10],
  SLEEVE = [13, 24, 38, 56, 80]

/** Fixed pseudo-random in [0, 1) so the foil crinkles never change between draws. */
const hash = (n: number) => ((((n + 1) * 2654435761) >>> 0) % 1000) / 1000

const Y: P3 = [0, 1, 0],
  Z: P3 = [0, 0, 1]

/**
 * Distance: a duty-free triangular chocolate bar in a card sleeve, lying along x on a shelf.
 * The bar is anchored at its foil end and grows toward the far end; each rung adds a run of peaks there, and that run is `lit`.
 * The top rung is long enough to bridge a gap between two shelf ends, with its price tag still on.
 */
export const distance: LadderFigureDef = {
  id: 'distance',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero',
      i = rung - 1,
      L = LEN[i],
      fo = FOIL[i],
      sl = SLEEVE[i],
      P = L - fo - sl,
      prev = i ? LEN[i - 1] - FOIL[i - 1] - SLEEVE[i - 1] : 0
    const SD = 32,
      ZS = rung === 5 ? 20 : 12,
      yc = SD / 2,
      HW = hero ? 12 : 13,
      H = hero ? 22 : 24,
      z0 = ZS
    const blocks: [number, number][] =
      rung === 5
        ? [
            [-8, 40],
            [132, 188],
          ]
        : [[-6, L + 6]]

    // Floor shadows first: shelf footprints, and the bar's own shadow falling through the gap.
    for (const [a, b] of blocks) shadowRect(s, a, 0, b - a, SD, 5)
    if (rung === 5)
      s.poly(
        [
          [40, yc - 2, 0],
          [136, yc - 2, 0],
          [136, yc + HW + 12, 0],
          [40, yc + HW + 12, 0],
        ],
        'shadow',
        'none',
      )

    const shelf = (x0: number, x1: number) => {
      const w = x1 - x0
      if (!hero) {
        s.box(x0, 0, 0, w, SD, ZS)
        return
      }
      // Recessed kick plinth, the body, then a slightly proud top plate.
      s.box(x0 + 3, 3, 0, w - 6, SD - 6, 3, { front: 'shade', side: 'shade', top: 'shade' })
      s.box(x0, 0, 3, w, SD, ZS - 4.5)
      s.box(x0 - 0.8, -0.8, ZS - 1.5, w + 1.6, SD + 1.6, 1.5)
      // Price rail on the front face: a proud strip with label-slot ticks.
      s.box(x0 + 3, SD, 4.5, w - 6, 1.6, 5.5, { top: 'top', front: 'top', side: 'front' })
      if (hero) {
        const ticks: P3[][] = []
        for (let x = x0 + 8; x < x1 - 5; x += 9)
          ticks.push([
            [x, SD + 1.6, 5.4],
            [x, SD + 1.6, 8.6],
          ])
        s.segs(ticks, 'detail', 0.8)
        s.line(
          [
            [x0 + 3, SD + 1.6, 7],
            [x1 - 3, SD + 1.6, 7],
          ],
          'crease',
          0.8,
        )
        // Inset on the top plate and its screws.
        s.line(
          [
            [x0 + 2.5, 2.5, ZS],
            [x1 - 2.5, 2.5, ZS],
            [x1 - 2.5, SD - 2.5, ZS],
            [x0 + 2.5, SD - 2.5, ZS],
            [x0 + 2.5, 2.5, ZS],
          ],
          'detail',
          0.7,
        )
        for (const [cx, cy] of [
          [x0 + 6, 6],
          [x1 - 6, 6],
          [x0 + 6, SD - 6],
          [x1 - 6, SD - 6],
        ])
          s.poly(s.circle([cx, cy, ZS], [1, 0, 0], Y, 0, 0, 0.85, 8), 'detail', 'line')
        // The gap-facing end of the first gondola carries its fixing screws.
        if (rung === 5 && x0 < 0)
          for (const cy of [8, SD - 8])
            s.poly(s.circle([x1, cy, 9], Y, Z, 0, 0, 0.85, 8), 'detail', 'line')
      }
    }
    for (const [a, b] of blocks) {
      shelf(a, b)
      const x0 = Math.max(0, a + 2),
        x1 = Math.min(L, b - 2)
      s.poly(
        [
          [x0, yc - 5, ZS],
          [x1, yc - 5, ZS],
          [x1, SD - 3, ZS],
          [x0, SD - 3, ZS],
        ],
        'shadow',
        'none',
      )
    }

    // The chocolate: one triangular prism whose ridge swells into segments, joined at the base with shallow V notches (a third of the height deep). The newest run, at the far end, is lit.
    const n = Math.max(1, Math.round(P / (hero ? 9 : 14))),
      sw = P / n,
      t = sw * 0.3,
      Hn = (H * 2) / 3,
      yn = HW / 3,
      litN = Math.max(1, Math.round((P - prev) / sw))
    const peak = (j: number, on: boolean) => {
      const a = j * sw,
        b = a + sw,
        first = j === 0,
        last = j === n - 1
      const slope: P3[] = [
        [a, yc + HW, z0],
        [b, yc + HW, z0],
        ...(last ? [] : ([[b, yc + yn, z0 + Hn]] as P3[])),
        [last ? b : b - t, yc, z0 + H],
        [first ? a : a + t, yc, z0 + H],
        ...(first ? [] : ([[a, yc + yn, z0 + Hn]] as P3[])),
      ]
      const notch: P3[] = [
        [b, yc - yn, z0 + Hn],
        [b, yc + yn, z0 + Hn],
        [b - t, yc, z0 + H],
      ]
      s.poly(slope, 'top', on ? 'accent' : 'crease')
      if (on) s.poly(slope, 'accent', 'none', undefined, undefined, 0.26)
      if (!last) {
        s.poly(notch, 'side', on ? 'accent' : 'crease')
        if (on) s.poly(notch, 'accent', 'none', undefined, undefined, 0.26)
      }
      if (on) {
        // Ridge and the score line down to the base.
        s.line(
          [
            [first ? a : a + t, yc, z0 + H],
            [last ? b : b - t, yc, z0 + H],
          ],
          'accent',
          1.4,
        )
        if (!last)
          s.line(
            [
              [b, yc + HW, z0],
              [b, yc + yn, z0 + Hn],
              [b - t, yc, z0 + H],
            ],
            'accent',
            1.2,
          )
      }
    }
    s.group('lit', () => {
      for (let j = 0; j < litN; j++) peak(j, true)
    })
    for (let j = litN; j < n; j++) peak(j, false)
    // The foot of the bar, and the far end face of the first segment.
    s.line(
      [
        [0, yc + HW, z0],
        [P, yc + HW, z0],
      ],
      'line',
    )
    s.line(
      [
        [0, yc + HW, z0],
        [0, yc, z0 + H],
      ],
      'line',
    )

    // The card sleeve, slightly proud of the chocolate.
    const HW2 = HW + 1.3,
      H2 = (H * HW2) / HW,
      xs0 = P,
      xs1 = P + sl
    const sp = (x: number, v: number): P3 => [x, yc + HW2 * (1 - v), z0 + H2 * v]
    s.poly([sp(xs0, 0), sp(xs1, 0), sp(xs1, 1), sp(xs0, 1)], 'top', 'crease')
    if (hero) {
      // Glue flap: the lap strip along the foot.
      s.poly([sp(xs0, 0), sp(xs1, 0), sp(xs1, 0.13), sp(xs0, 0.13)], 'front', 'crease', 0.8)
      // Perforated tear strip.
      s.line([sp(xs0 + 1.5, 0.72), sp(xs1 - 1.5, 0.72)], 'detail', 0.8, '1.3 1.7')
      // Tuck flap: a die-cut tab at the end with its slit.
      const tw = Math.min(5.5, sl * 0.42)
      s.poly(
        [sp(xs1 - tw, 0.22), sp(xs1 - 0.5, 0.22), sp(xs1 - 0.5, 0.58), sp(xs1 - tw, 0.58)],
        'front',
        'crease',
        0.9,
      )
      s.line([sp(xs1 - tw, 0.4), sp(xs1 - tw + 1.4, 0.4)], 'detail', 0.8)
    }
    // The open end of the tube, then the sleeve's silhouette.
    s.poly(
      [
        [xs1, yc - HW2, z0],
        [xs1, yc + HW2, z0],
        [xs1, yc, z0 + H2],
      ],
      'side',
      'crease',
    )
    s.line([sp(xs0, 1), sp(xs1, 1)], 'line')
    s.line([sp(xs0, 0), sp(xs0, 1)], 'line')
    s.line([sp(xs0, 0), sp(xs1, 0)], 'line')

    // The foil end: crimped facets on the slope and on the end face.
    const fs = (u: number, v: number): P3 => [xs1 + fo * u, yc + HW * (1 - v), z0 + H * v]
    s.poly([fs(0, 0), fs(1, 0), fs(1, 1), fs(0, 1)], 'top', 'crease')
    const facets: [number, number][][] = hero
      ? [
          [
            [0, 0],
            [0.45, 0],
            [0.15, 0.6],
          ],
          [
            [0.45, 0],
            [1, 0],
            [0.75, 0.45],
          ],
          [
            [0.15, 0.6],
            [0.5, 1],
            [0, 1],
          ],
          [
            [0.75, 0.45],
            [1, 1],
            [0.55, 1],
          ],
        ]
      : [
          [
            [0, 0],
            [0.55, 0],
            [0.2, 0.7],
          ],
          [
            [0.55, 0],
            [1, 0],
            [1, 0.8],
          ],
        ]
    facets.forEach((f, j) =>
      s.poly(
        f.map(([u, v]) => fs(u, v)),
        j % 2 ? 'side' : 'front',
        'crease',
        0.7,
      ),
    )
    s.line([fs(0, 0), fs(1, 0)], 'line')
    s.line([fs(0, 1), fs(1, 1)], 'line')
    const e0: P3 = [xs1 + fo, yc - HW, z0],
      e1: P3 = [xs1 + fo, yc + HW, z0],
      e2: P3 = [xs1 + fo, yc, z0 + H],
      ec: P3 = [xs1 + fo, yc + 0.6, z0 + 7.5]
    s.poly([e0, e1, e2], 'side', 'line')
    s.poly([e1, e2, ec], 'top', 'crease', 0.8)
    s.poly([e0, e1, ec], 'front', 'crease', 0.8)
    if (hero) {
      const cr: P3[][] = []
      for (let j = 0; j < 6; j++) {
        const a = j / 6 + (hash(j) - 0.5) * 0.12
        // Crinkle lines fan out from the gathered centre and stop short of the edge.
        const tx = ec[1] + Math.cos(a * 2 * Math.PI) * (7 + hash(j + 9) * 5)
        const tz = ec[2] + Math.sin(a * 2 * Math.PI) * (5 + hash(j + 4) * 3)
        cr.push([
          [ec[0], ec[1], ec[2]],
          [
            ec[0],
            Math.min(yc + HW - 2, Math.max(yc - HW + 2, tx)),
            Math.max(z0 + 1.5, Math.min(z0 + H - 3, tz)),
          ],
        ])
      }
      s.segs(cr, 'detail', 0.8)
      // Crinkles on the slope.
      s.segs(
        [
          [fs(0.05, 0.3), fs(0.35, 0.42), fs(0.55, 0.2), fs(0.9, 0.5)],
          [fs(0.1, 0.78), fs(0.4, 0.7), fs(0.7, 0.86), fs(0.95, 0.7)],
        ],
        'detail',
        0.7,
      )
    }

    // Top rung: the price tag is still on, hanging in the gap on a thread looped over the bar.
    if (rung === 5) {
      const j = Math.floor(80 / sw),
        tx = j * sw + sw / 2,
        ty = yc + HW + 1.2,
        top = z0 - 6,
        hw = sw * 0.7,
        bot = top - hw * 3,
        sway = 1
      s.line(
        [
          [tx, yc, z0 + H],
          [tx, yc + HW, z0],
          [tx + 0.3, ty, z0 - 2],
          [tx + 1.6, ty, top + 1.5],
        ],
        'line',
        0.8,
      )
      s.poly(
        [
          [tx - hw * 0.45, ty, top],
          [tx + hw * 0.45, ty, top],
          [tx + hw, ty, top - hw * 0.5],
          [tx + hw + sway, ty, bot],
          [tx - hw + sway, ty, bot],
          [tx - hw, ty, top - hw * 0.5],
        ],
        'top',
        'line',
      )
      s.poly(s.circle([tx, ty, top - hw * 0.5], [1, 0, 0], Z, 0, 0, 0.9, 8), 'shade', 'line', 0.8)
      const ruled: P3[][] = []
      for (const d of [0.4, 0.7].map((f) => f * hw * 3))
        ruled.push([
          [tx - hw * 0.62 + sway * (d / (hw * 3)), ty, top - d],
          [tx + hw * 0.62 + sway * (d / (hw * 3)), ty, top - d],
        ])
      s.segs(ruled, 'detail', hero ? 0.9 : 1.1)
    }
    return s.done()
  },
}
