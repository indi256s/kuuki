import { hull, Scene, type P3, type Paint } from '../../../overview/iso/scene'
import { shadowRect } from '../../../overview/iso/solids'
import { add, circleOn, cross, mix, mul, screw, sub, toneOf, unit, type Ramp, hash } from './parts'
import type { LadderFigureDef } from './types'

/** Per rung (snack, standard, long, extra long, absurd): peaks out of the foil, foil showing past the carton, carton length (world units). */
const PEAKS = [2, 3, 5, 7, 9],
  FOIL = [7, 7, 8, 9, 10],
  SLEEVE = [18, 26, 36, 50, 66]
/** One peak's pitch along the bar. */
const SW = 12

const X: P3 = [1, 0, 0],
  Z: P3 = [0, 0, 1]

/** Milk chocolate sits a step darker than the card it comes in. */
const CHOC: Ramp = { dark: 'side', mid: 'side', light: 'front' }

/** Fixed pseudo-random in [0, 1), so the torn foil never changes between draws. */

/**
 * Distance: a duty-free triangular chocolate bar lying along x on a shop shelf.
 * The carton sits at the near end, closed by its end cap; its far end is torn open, the end flap stands open behind the bar, and the foil is ripped back to bare peaks.
 * Each rung adds peaks at the far end, and that newest run is `lit`. The top rung is long enough to bridge the gap between two shelf ends, with its price tag still on.
 */
export const distance: LadderFigureDef = {
  id: 'distance',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero',
      i = rung - 1,
      n = PEAKS[i],
      P = n * SW,
      litN = n - (i ? PEAKS[i - 1] : 0),
      xf0 = P + SW * 0.4,
      xc0 = xf0 + FOIL[i],
      L = xc0 + SLEEVE[i]

    // Shelf depth and height; the bar runs along the shelf's middle.
    const SD = 34,
      ZS = rung === 5 ? 20 : 12,
      yc = SD / 2 - 1,
      z0 = ZS
    // Chocolate section: base half-width, ridge height, the narrow flat along each ridge, and the notch floor.
    const HW = 12,
      H = 21,
      RR = hero ? 0.9 : 0.6,
      HB = H * 0.3,
      T = SW * 0.3
    const w = (h: number) => RR + (HW - RR) * (1 - h / H)
    // Carton: same slopes, 1.4 proud of the chocolate, sharp ridge.
    const HWc = HW + 1.4,
      Hc = (HWc * H) / (HW - RR)
    const cs = (x: number, v: number): P3 => [x, yc + HWc * (1 - v), z0 + Hc * v]

    const shelves: [number, number][] =
      rung === 5
        ? [
            [-8, 32],
            [152, L + 7],
          ]
        : [[-7, L + 7]]

    // ---------------------------------------------------------------- shelf
    for (const [a, b] of shelves) shadowRect(s, a, 0, b - a, SD, 5)
    if (rung === 5)
      // The bar's shadow falls through the gap onto the floor.
      s.poly(
        [
          [shelves[0][1], yc - 4, 0],
          [shelves[1][0], yc - 4, 0],
          [shelves[1][0], yc + HWc + 10, 0],
          [shelves[0][1], yc + HWc + 10, 0],
        ],
        'shadow',
        'none',
      )

    const shelf = (x0: number, x1: number, ticketAt: number | null) => {
      const wd = x1 - x0
      if (!hero) {
        s.box(x0, 0, 0, wd, SD, ZS)
        s.line(
          [
            [x0 + 3, SD, ZS - 3],
            [x1 - 3, SD, ZS - 3],
          ],
          'crease',
          0.8,
        )
        return
      }
      // Recessed kick plinth, the carcass, a proud top plate with a rolled front lip.
      s.box(x0 + 3, 3, 0, wd - 6, SD - 6, 3, { front: 'side', side: 'side', top: 'side' })
      s.box(x0, 0, 3, wd, SD, ZS - 4.6)
      s.box(x0 - 0.8, -0.8, ZS - 1.6, wd + 1.6, SD + 1.6, 1.6)
      s.line(
        [
          [x0 - 0.8, SD + 0.8, ZS - 0.8],
          [x1 + 0.8, SD + 0.8, ZS - 0.8],
        ],
        'crease',
        0.6,
      )
      // Carcass panel joint on the front, edge to edge.
      s.line(
        [
          [x0, SD, 4.4],
          [x1, SD, 4.4],
        ],
        'crease',
        0.6,
      )
      // Price rail: a C-channel on the front face, its lips, and end caps.
      const r0 = x0 + 2.5,
        r1 = x1 - 2.5,
        rz0 = 5.6,
        rz1 = ZS - 2.8
      s.box(r0, SD, rz0, r1 - r0, 1.4, rz1 - rz0, { top: 'top', front: 'front', side: 'side' })
      s.segs(
        [
          [
            [r0, SD + 1.4, rz1 - 0.9],
            [r1, SD + 1.4, rz1 - 0.9],
          ],
          [
            [r0, SD + 1.4, rz0 + 0.9],
            [r1, SD + 1.4, rz0 + 0.9],
          ],
        ],
        'crease',
        0.6,
      )
      for (const ex of [r0 + 1.1, r1 - 1.1])
        s.line(
          [
            [ex, SD + 1.4, rz0],
            [ex, SD + 1.4, rz1],
          ],
          'crease',
          0.6,
        )
      // A blank shelf ticket clipped into the rail: a price block and two ruled lines.
      if (ticketAt !== null) {
        const tw = 13,
          ty = SD + 1.6,
          tz0 = rz0 + 1.1,
          tz1 = rz1 - 1.1,
          ta = ticketAt - tw / 2,
          tb = ticketAt + tw / 2
        s.poly(
          [
            [ta, ty, tz0],
            [tb, ty, tz0],
            [tb, ty, tz1],
            [ta, ty, tz1],
          ],
          'top',
          'crease',
          undefined,
          0.6,
        )
        s.poly(
          [
            [tb - 5.4, ty, tz0 + 0.9],
            [tb - 1, ty, tz0 + 0.9],
            [tb - 1, ty, tz1 - 0.9],
            [tb - 5.4, ty, tz1 - 0.9],
          ],
          'detail',
          'none',
        )
        s.segs(
          [
            [
              [ta + 1.2, ty, tz1 - 1.1],
              [tb - 6.6, ty, tz1 - 1.1],
            ],
            [
              [ta + 1.2, ty, tz0 + 1.2],
              [tb - 8.6, ty, tz0 + 1.2],
            ],
          ],
          'detail',
          0.8,
        )
      }
      // Inset groove on the top plate, and its corner screws.
      s.line(
        [
          [x0 + 2.4, 2.4, ZS],
          [x1 - 2.4, 2.4, ZS],
          [x1 - 2.4, SD - 2.4, ZS],
          [x0 + 2.4, SD - 2.4, ZS],
          [x0 + 2.4, 2.4, ZS],
        ],
        'detail',
        0.6,
      )
      for (const [cx, cy] of [
        [x0 + 5.4, 5.4],
        [x1 - 5.4, 5.4],
        [x0 + 5.4, SD - 5.4],
        [x1 - 5.4, SD - 5.4],
      ])
        screw(s, [cx, cy, ZS], Z, 0.45, { ring: 1 })
      // The end that faces the gap shows its fixing screws.
      if (rung === 5 && x0 < 0)
        for (const cy of [7, SD - 7]) screw(s, [x1, cy, ZS - 6], X, 0.45, { ring: 1 })
    }
    const ticket = (a: number, b: number) => {
      const c = Math.min(b - 10, Math.max(a + 10, (xc0 + L) / 2))
      return c > a + 9 && c < b - 9 ? c : null
    }
    for (const [a, b] of shelves) {
      shelf(a, b, ticket(a, b))
      // Contact shadow along the bar's foot.
      const x0 = Math.max(0, a + 1.5),
        x1 = Math.min(L, b - 1.5)
      if (hero)
        s.poly(
          [
            [x0, yc - HW, ZS],
            [x1, yc - HW, ZS],
            [x1, yc + HWc + 2.4, ZS],
            [x0, yc + HWc + 2.4, ZS],
          ],
          'shadow',
          'none',
        )
    }

    // ---------------------------------------------------------------- the carton's end flap, torn open
    // Hinged on the back slope's edge at the mouth and swung back past upright, so it stands behind the bar; we see its plain inside.
    {
      const A: P3 = [xc0, yc - HWc, z0],
        B: P3 = [xc0, yc, z0 + Hc],
        C0: P3 = [xc0, yc + HWc, z0]
      const ax = unit(sub(B, A)),
        th = (168 * Math.PI) / 180
      const rot = (p: P3): P3 => {
        const q = sub(p, A),
          al = mul(ax, q[0] * ax[0] + q[1] * ax[1] + q[2] * ax[2]),
          pe = sub(q, al)
        return add(A, add(al, add(mul(pe, Math.cos(th)), mul(cross(ax, pe), Math.sin(th)))))
      }
      const C = rot(C0)
      // Plain unprinted board on the inside: one light tone whichever way the flap leans.
      const inside: Paint = 'front'
      // The tuck tab on the flap's free edge (A–C), rounded at its corners.
      const tab = [0.18, 0.3, 0.7, 0.82].map((f, j) => {
        const base = mix(A, C, f),
          out = unit(sub(base, mix(A, B, 0.5))),
          d = j === 0 || j === 3 ? 0 : hero ? 3.4 : 3
        return add(base, mul(out, d))
      })
      const tabPts: P3[] = [
        tab[0],
        mix(tab[1], tab[0], 0.25),
        tab[1],
        tab[2],
        mix(tab[2], tab[3], 0.25),
        tab[3],
      ]
      s.poly(tabPts, inside, 'line', undefined, 0.8)
      s.poly([A, B, C], inside, 'line')
      if (hero) {
        // Score line where the tab folds, and the glue patch the flap tore off.
        s.line([tab[0], tab[3]], 'crease', 0.6)
        const g = (u: number, t: number) => mix(mix(A, C, u), B, t)
        s.poly(
          [g(0.35, 0.35), g(0.6, 0.35), g(0.6, 0.6), g(0.35, 0.6)],
          'detail',
          'none',
          undefined,
          undefined,
          0.8,
        )
      }
    }

    // ---------------------------------------------------------------- the chocolate
    // Peaks along x: segment j spans [a, b]; V notches between peaks open from HB up to the ridge, T wide each side at the top.
    // A segment is convex, so its outline is its hull: hulls are stroked at twice the width and filled over as one area, which leaves only the outer half of each stroke and hides the joins along the base web.
    type Seg = { a: number; b: number; first: boolean; last: boolean }
    const segs: Seg[] = []
    for (let j = 0; j < n; j++)
      segs.push({ a: j * SW, b: (j + 1) * SW, first: j === 0, last: false })
    segs.push({ a: P, b: xc0 + 1, first: false, last: true })
    const at = (x: number, side: 1 | -1, h: number): P3 => [x, yc + side * w(h), z0 + h]
    const corners = (g: Seg): P3[] => {
      const ta = g.first ? g.a : g.a + T,
        tb = g.last ? g.b : g.b - T
      return [
        at(g.a, 1, 0),
        at(g.b, 1, 0),
        at(g.b, -1, 0),
        at(g.a, -1, 0),
        at(g.a, 1, HB),
        at(g.b, 1, HB),
        at(g.a, -1, HB),
        at(g.b, -1, HB),
        at(ta, 1, H),
        at(tb, 1, H),
        at(ta, -1, H),
        at(tb, -1, H),
      ]
    }
    const chocolate = (list: Seg[], lit: boolean) => {
      if (!list.length) return
      const edge: Paint = lit ? 'accent' : 'line',
        crease: Paint = lit ? 'accent' : 'crease'
      const hulls = list.map((g) => hull(s.pp(corners(g))))
      for (const hp of hulls) s.poly2(hp, 'none', edge, 2 * (lit ? 0.9 : 1))
      s.area(hulls, CHOC.dark)
      for (const g of list) {
        const ta = g.first ? g.a : g.a + T,
          tb = g.last ? g.b : g.b - T
        // The +x notch wall, then the front slope, then the ridge flat.
        if (!g.last) {
          const wall = [at(g.b, 1, HB), at(tb, 1, H), at(tb, -1, H), at(g.b, -1, HB)]
          s.poly(wall, toneOf([H - HB, 0, T], CHOC), crease, undefined, 0.7)
          if (lit) s.poly(wall, 'accent-side', 'none', undefined, undefined, 0.3)
        }
        const slope: P3[] = [
          at(g.a, 1, 0),
          at(g.b, 1, 0),
          ...(g.last ? [] : [at(g.b, 1, HB)]),
          at(tb, 1, H),
          at(ta, 1, H),
          ...(g.first ? [] : [at(g.a, 1, HB)]),
        ]
        s.poly(slope, toneOf([0, H, HW - RR], CHOC), crease, undefined, 0.7)
        if (lit) s.poly(slope, 'accent', 'none', undefined, undefined, 0.24)
        else if (hero) s.poly(slope, 'shade', 'none', undefined, undefined, 0.55)
        const ridge = [at(ta, 1, H), at(tb, 1, H), at(tb, -1, H), at(ta, -1, H)]
        s.poly(ridge, 'top', crease, undefined, 0.6)
        if (lit) s.poly(ridge, 'accent', 'none', undefined, undefined, 0.3)
        // The notch's near edge is where this peak passes in front of the last one's wall.
        if (!g.first) s.line([at(g.a, 1, HB), at(ta, 1, H)], edge, lit ? 0.9 : 0.8)
      }
      s.line([at(list[0].a, 1, 0), at(list[list.length - 1].b, 1, 0)], edge, lit ? 0.9 : 1)
    }
    s.group('lit', () => chocolate(segs.slice(0, litN), true))
    chocolate(segs.slice(litN), false)

    // ---------------------------------------------------------------- the foil, torn
    {
      const FO = 0.35
      const fw = (h: number) => w(h) + FO
      const fp = (x: number, side: 1 | -1, h: number): P3 => [
        x,
        yc + side * fw(h),
        z0 + h + (h >= H ? FO : 0),
      ]
      // The torn edge: a ragged run of teeth from the foot up to the ridge, then across the ridge flat.
      const teeth = hero ? 7 : 3
      const tear: P3[] = []
      for (let j = 0; j <= teeth; j++) {
        const h = (H * j) / teeth,
          dx = j % 2 ? 2 + hash(j) * 1.6 : hash(j + 7) * 0.9
        tear.push(fp(xf0 + dx, 1, Math.min(h, H)))
      }
      const ridgeTear: P3 = fp(xf0 + 1.2, -1, H)
      const slope: P3[] = [...tear, fp(xc0 + 1, 1, H), fp(xc0 + 1, 1, 0)]
      s.poly(slope, 'top', 'crease', undefined, 0.6)
      s.poly(
        [tear[tear.length - 1], fp(xc0 + 1, 1, H), fp(xc0 + 1, -1, H), ridgeTear],
        'top',
        'crease',
        undefined,
        0.6,
      )
      s.line([...tear, ridgeTear], 'line', 0.8)
      s.line([tear[0], fp(xc0 + 1, 1, 0)], 'line')
      s.line([ridgeTear, fp(xc0 + 1, -1, H)], 'line')
      if (hero) {
        // The foil hugs the peaks under it: soft V dimples where each notch is, ending on the foot and the ridge.
        const dims: P3[][] = []
        for (let x = Math.ceil((xf0 + 3) / SW) * SW; x < xc0; x += SW)
          dims.push([fp(x - T * 0.55, 1, H), fp(x, 1, HB), fp(x + T * 0.55, 1, H)])
        s.segs(dims, 'crease', 0.6)
        // Crinkles across the slope, and two torn tongues curling outward.
        s.segs(
          [
            [fp(xf0 + 3.4, 1, 3), fp(xf0 + 4.4, 1, 7.5), fp(xf0 + 3.6, 1, 11)],
            [fp(xc0 - 1.6, 1, 4), fp(xc0 - 2.6, 1, 9), fp(xc0 - 1.8, 1, 15)],
          ],
          'detail',
          0.6,
        )
        for (const j of [1, teeth - 2]) {
          const p0 = tear[j],
            p1 = tear[j + 1],
            tip = add(mix(p0, p1, 0.5), [-1.8, 1.6, 0])
          s.poly([p0, p1, tip], 'front', 'crease', undefined, 0.6)
        }
      }
    }

    // ---------------------------------------------------------------- the carton
    {
      const end: P3[] = [cs(L, 0), [L, yc - HWc, z0], cs(L, 1)]
      const outline = hull(s.pp([cs(xc0, 0), cs(L, 0), cs(xc0, 1), cs(L, 1), [L, yc - HWc, z0]]))
      s.poly(
        [cs(xc0, 0), cs(L, 0), cs(L, 1), cs(xc0, 1)],
        toneOf([0, Hc, HWc]),
        'crease',
        undefined,
        0.7,
      )
      s.poly(end, toneOf(X), 'crease', undefined, 0.7)
      if (hero) {
        // Glue lap along the foot, and the score just under the folded ridge, both running the carton's full length.
        s.segs(
          [
            [cs(xc0, 0.1), cs(L, 0.1)],
            [cs(xc0, 0.955), cs(L, 0.955)],
          ],
          'crease',
          0.6,
        )
        // The printed livery band, edge to edge from the torn mouth to the end cap, with a pinstripe inside each edge.
        s.poly(
          [cs(xc0, 0.4), cs(L, 0.4), cs(L, 0.62), cs(xc0, 0.62)],
          'front',
          'crease',
          undefined,
          0.6,
        )
        s.segs(
          [
            [cs(xc0, 0.43), cs(L, 0.43)],
            [cs(xc0, 0.59), cs(L, 0.59)],
          ],
          'detail',
          0.6,
        )
      }
      // Closed end cap: the tuck flap inset in the triangle, with its thumb notch.
      const ec = (dy: number, dz: number): P3 => [L, yc + dy, z0 + dz]
      const inset = hero ? 1.5 : 2.2
      const tri: P3[] = [
        ec(HWc - inset * 1.9, inset),
        ec(0, Hc - inset * 2.1),
        ec(-HWc + inset * 1.9, inset),
      ]
      s.poly(tri, 'none', 'crease', undefined, 0.7)
      if (hero) {
        const notch: P3[] = []
        for (let j = 0; j <= 10; j++) {
          const a = (Math.PI * j) / 10
          notch.push(ec(2.4 * Math.cos(a), inset + 2.4 * Math.sin(a)))
        }
        s.poly(notch, 'shade', 'crease', undefined, 0.6)
        // Fold creases from the cap's corners to the flap's.
        s.segs(
          [
            [ec(HWc, 0), tri[0]],
            [ec(-HWc, 0), tri[2]],
          ],
          'crease',
          0.6,
        )
      }
      s.poly2(outline, 'none', 'line')
    }

    // ---------------------------------------------------------------- top rung: the price tag, still on
    if (rung === 5) {
      const tx = shelves[1][0] - 14,
        ty = yc + HWc + 0.8,
        top = z0 - 6,
        hw = 5,
        len = 17
      const U = unit([1, -0.3, 0]),
        n3 = unit(cross(U, [0, 0, -1]))
      const tp = (u: number, d: number): P3 => add([tx, ty, top], add(mul(U, u), [0, 0, -d]))
      // The thread: over the carton's slope, round its foot, down to the tag's eyelet.
      s.line([cs(tx, 1), cs(tx, 0), [tx + 0.3, ty, z0 - 2], tp(0, 2.2)], 'line', 0.8)
      const shape: P3[] = [
        tp(-hw * 0.5, 0),
        tp(hw * 0.5, 0),
        tp(hw, hw * 0.5),
        tp(hw, len),
        tp(-hw, len),
        tp(-hw, hw * 0.5),
      ]
      s.poly(shape, toneOf(n3), 'line')
      if (hero) {
        s.poly(circleOn(tp(0, 2.2), n3, 1.2, 14), 'top', 'crease', undefined, 0.6)
        s.poly(circleOn(tp(0, 2.2), n3, 0.55, 10), 'shade', 'none')
      } else s.poly(circleOn(tp(0, 2.2), n3, 0.8, 8), 'none', 'line', undefined, 0.8)
      const ruled: P3[][] = [
        [tp(-hw * 0.62, len * 0.45), tp(hw * 0.62, len * 0.45)],
        [tp(-hw * 0.62, len * 0.62), tp(hw * 0.3, len * 0.62)],
      ]
      if (hero) ruled.push([tp(-hw * 0.62, len * 0.79), tp(hw * 0.5, len * 0.79)])
      s.segs(ruled, 'detail', hero ? 0.9 : 1.1)
    }
    return s.done()
  },
}
