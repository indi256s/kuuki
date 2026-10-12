import { Scene, roundRect, type IsoFigureData, type P3, type Pt } from './scene'
import { NZ, X, Y, rrOn, shadowRect } from './solids'

/** How far the shade rises on hover: a third of the pane. */
const PANE = { u: 24, v: 18, w: 52, h: 76, r: 22 },
  RISE = PANE.h / 3,
  // The shade rests two-thirds down the pane.
  SHADE_END = PANE.v + (PANE.h * 2) / 3,
  W = 100,
  D = 12,
  H = 136,
  // The window is a recess this deep; the pane sits at its back.
  RECESS = 6,
  PY = D - RECESS,
  LEDGE = { z: 14, d: 18, h: 6 }

/**
 * Time in the air: a cabin sidewall window with the shade two-thirds down; the daylight is the lit pane.
 * Part: `shade` (slab, ribs, bar and pull lip), clipped to the pane so it slides up into the reveal. Nothing depends on data. Motion lives in `cabin-window.css`.
 */
export function cabinWindow(k: number): IsoFigureData {
  const s = new Scene(k)
  const [riseX, riseY] = s.vector(0, 0, RISE)
  const F: P3 = [0, D, H],
    B: P3 = [0, PY, H],
    at = s.on(F, X, NZ),
    back = s.on(B, X, NZ)
  const { u: pu, v: pv, w: pw, h: ph, r: pr } = PANE

  // A screw head: a small disc with a slot.
  const screw = (O: P3, u: number, v: number, r = 1.5) => {
    s.poly(s.circle(O, X, NZ, u, v, r, 10), 'detail', 'line', undefined, 0.6)
    const to = s.on(O, X, NZ)
    s.line([to(u - r * 0.6, v), to(u + r * 0.6, v)], 'line', 0.5)
  }

  shadowRect(s, 0, 0, W, D + LEDGE.d + 4, 2)
  s.box(0, 0, 0, W, D, H)

  // Panel seams 5 in from each side and 7 below the top, with fasteners where they cross; the kick seam runs low.
  s.segs(
    [
      [at(5, 0), at(5, H - LEDGE.z - LEDGE.h)],
      [at(W - 5, 0), at(W - 5, H - LEDGE.z - LEDGE.h)],
      [at(5, 7), at(W - 5, 7)],
      [at(0, H - 3), at(W, H - 3)],
    ],
    'detail',
    0.8,
  )
  for (const [u, v] of [
    [5, 7],
    [W - 5, 7],
    [5, 62],
    [W - 5, 62],
    [5, 108],
    [W - 5, 108],
  ])
    screw(F, u, v)
  // The same rails turn the corner on the end face.
  s.segs(
    [
      [
        [W, 0, H - 7],
        [W, D, H - 7],
      ],
      [
        [W, 0, 3],
        [W, D, 3],
      ],
    ],
    'detail',
    0.8,
  )

  // Surround moulding round the opening.
  s.poly(rrOn(s, F, X, NZ, pu - 9, pv - 9, pw + 18, ph + 18, 29), 'none', 'detail', undefined, 0.8)

  // The opening and the recess behind it: only the side and sill walls show, and the recess group clips what the back plane would push past the opening's top and right edges.
  const open = roundRect(pu - 6, pv - 6, pw + 12, ph + 12, 26)
  const openFront = open.map(([u, v]) => at(u, v))
  const cu = pu + pw / 2,
    cv = pv + ph / 2
  s.poly(openFront, 'glass', 'line')
  s.group(
    'recess',
    () => {
      open.forEach(([u0, v0], i) => {
        const [u1, v1] = open[(i + 1) % open.length]
        // Inward normal: the facet's perpendicular, flipped to face the pane's centre.
        const flip =
            (v1 - v0) * (cu - (u0 + u1) / 2) + (u0 - u1) * (cv - (v0 + v1) / 2) < 0 ? -1 : 1,
          nu = (v1 - v0) * flip,
          nv = (u0 - u1) * flip
        if (nu - nv <= 0.05) return
        const tone = nu > -nv ? 'side' : 'top'
        s.poly([at(u0, v0), at(u1, v1), back(u1, v1), back(u0, v0)], tone, tone, undefined, 0.5)
      })
      // The window frame ring at the back of the recess, then the pane in it.
      s.poly(
        open.map(([u, v]) => back(u, v)),
        'front',
        'line',
        undefined,
        0.8,
      )
      const pane = rrOn(s, B, X, NZ, pu, pv, pw, ph, pr)
      // The whole pane is lit; the shade hides the top two-thirds of it.
      s.lit(pane, 5)
      // Horizon: one wavy line from pane edge to pane edge. The pane is inset by pr - sqrt(pr² - dy²) at depth dy into a corner.
      const hv = SHADE_END + 14,
        edge = pr - Math.sqrt(pr * pr - (hv - (pv + ph - pr)) ** 2)
      s.line(
        [
          back(pu + edge, hv + 1),
          back(pu + 14, hv - 1),
          back(pu + 28, hv + 0.5),
          back(pu + 40, hv - 1),
          back(pu + pw - edge, hv),
        ],
        'accent-plate',
        0.9,
      )
      // Breather hole in the scratch pane's lower edge.
      s.poly(s.circle(B, X, NZ, cu, pv + ph - 7, 1.3, 10), 'detail', 'line', undefined, 0.6)

      s.group(
        'shade',
        () => {
          const slab: Pt[] = [
            [pu, pv],
            [pu + pw, pv],
            [pu + pw, SHADE_END],
            [pu, SHADE_END],
          ]
          s.poly(
            slab.map(([u, v]) => back(u, v)),
            'front',
            'line',
          )
          // Ribs run edge to edge, so the pane's rounded corners trim them.
          const ribs: P3[][] = []
          for (let v = SHADE_END - 7; v > pv - 2; v -= 5) ribs.push([back(pu, v), back(pu + pw, v)])
          s.segs(ribs, 'detail', 0.7)
          // Bottom bar and its pull lip.
          s.poly(
            [
              back(pu, SHADE_END - 4),
              back(pu + pw, SHADE_END - 4),
              back(pu + pw, SHADE_END),
              back(pu, SHADE_END),
            ],
            'top',
            'line',
          )
          s.poly(rrOn(s, B, X, NZ, cu - 8, SHADE_END, 16, 5, 2), 'top', 'line', undefined, 0.8)
          s.poly(s.circle(B, X, NZ, cu, SHADE_END + 2.5, 0.9, 8), 'detail', 'none')
        },
        {
          clip: rrOn(s, B, X, NZ, pu, pv, pw, ph, pr),
          vars: { '--rise-x': `${riseX}px`, '--rise-y': `${riseY}px` },
        },
      )
      // The scratch pane in front of the shade.
      s.poly(
        rrOn(s, B, X, NZ, pu + 3, pv + 3, pw - 6, ph - 6, pr - 3),
        'none',
        'line',
        undefined,
        0.7,
      )
    },
    { clip: open.map(([u, v]) => at(u, v)) },
  )
  s.poly(openFront, 'none', 'line')

  // Placard: a blank rule-lined plate.
  s.poly(rrOn(s, F, X, NZ, 33, 105, 34, 8, 1.5), 'top', 'line', undefined, 0.8)
  s.segs(
    [
      [at(33, 107), at(67, 107)],
      [at(33, 111), at(67, 111)],
    ],
    'detail',
    0.7,
  )
  for (const u of [36, 64]) s.poly(s.circle(F, X, NZ, u, 109, 0.8, 8), 'line', 'none')

  // Armrest ledge: slab, a recessed pad, the trim along its front edge and two fasteners.
  const { z: lz, d: ld, h: lh } = LEDGE
  s.box(0, D, lz, W, ld, lh)
  const top = s.on([0, D, lz + lh], X, Y)
  s.poly(rrOn(s, [0, D, lz + lh], X, Y, 9, 4, W - 18, 9, 3), 'side', 'line', undefined, 0.8)
  s.segs(
    [
      [top(0, ld - 2.5), top(W, ld - 2.5)],
      [
        [0, D + ld, lz + 2],
        [W, D + ld, lz + 2],
      ],
    ],
    'detail',
    0.8,
  )
  for (const x of [4.5, W - 4.5])
    s.poly(s.circle([x, D + 8.5, lz + lh], X, Y, 0, 0, 1.4, 10), 'detail', 'line', undefined, 0.6)

  return s.done()
}
