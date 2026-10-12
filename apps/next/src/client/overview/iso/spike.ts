import { Scene, hull, type IsoFigureData, type P3 } from './scene'
import { X, Y, cylZ, shadowDisc, slabRot } from './solids'

/** How far the top stub lifts off the spike on hover, in iso units along z. */
const LIFT = 18
const R = 34,
  FELT = 1.2,
  BASE_H = 8,
  RIM_H = 1.4,
  COLLAR_Z = FELT + BASE_H + RIM_H,
  SHAFT_R = 1.8,
  // Stubs: the first sits on the collar, each next one a paper-thickness and a sliver higher.
  Z0 = 22,
  PITCH = 3,
  THICK = 1.5,
  TOP_THICK = 1.8,
  MAX_STUBS = 12,
  W = 90,
  D = 38,
  // A flat stub hides the shaft up to its back corner, so the shaft part that rides with the top stub is as long as that reach.
  REACH = 30,
  TIP_H = 16
// The box is sized for the tallest stack, so the card does not jump when a filter changes the bucket.
const TOP_MAX = Z0 + MAX_STUBS * PITCH + TOP_THICK,
  SHAFT_TOP = TOP_MAX + LIFT + REACH,
  TIP = SHAFT_TOP + TIP_H

// Small, varied, fixed angles and cuts: no two neighbours match, and nothing is random.
const ANGLES = [-0.12, 0.14, -0.04, 0.18, -0.15, 0.08, -0.07, 0.13, -0.1, 0.05, -0.16, 0.1]

/** Flights: a desk spike with torn boarding-pass stubs on it; `stubs` of them sit under the lit top stub, which lifts off along the spike on hover. Parts: `top-stub`. */
export function spike(k: number, { stubs }: { stubs: 3 | 5 | 8 | 12 }): IsoFigureData {
  const s = new Scene(k)
  const [liftX, liftY] = s.vector(0, 0, LIFT)
  shadowDisc(s, 0, 0, R + 8)

  // Felt foot, then the heavy base with a bevelled rim, a groove and an engraved ring on top.
  cylZ(s, 0, 0, 0, R - 2, FELT, { top: 'front', body: 'side' }, 40)
  cylZ(s, 0, 0, FELT, R, BASE_H, { top: 'top', body: 'side' }, 40)
  // Groove round the wall; only the half facing the viewer shows.
  const groove: P3[] = []
  for (let i = 0; i <= 20; i++) {
    const a = ((-45 + (180 * i) / 20) * Math.PI) / 180
    groove.push([R * Math.cos(a), R * Math.sin(a), FELT + 2.4])
  }
  s.line(groove, 'detail', 0.8)
  cylZ(s, 0, 0, FELT + BASE_H, R - 2.6, RIM_H, { top: 'top', body: 'front' }, 40)
  s.poly(s.circle([0, 0, COLLAR_Z], X, Y, 0, 0, R - 9, 40), 'none', 'detail', undefined, 0.8)
  s.poly(s.circle([0, 0, COLLAR_Z], X, Y, 0, 0, R - 11, 40), 'none', 'detail', undefined, 0.6)
  // Ferrule collar where the shaft enters the base: a wide step and a narrow one with a seam.
  cylZ(s, 0, 0, COLLAR_Z, 7.5, 2.4, { top: 'top', body: 'front' }, 24)
  cylZ(s, 0, 0, COLLAR_Z + 2.4, 5.4, 2.2, { top: 'top', body: 'side' }, 20)
  const seam = s.circle([0, 0, COLLAR_Z + 3.4], X, Y, 0, 0, 5.4, 20)
  s.line([...seam.slice(-5), ...seam.slice(0, 6)], 'detail', 0.7)

  // The shaft runs through everything; the stubs hide it, and the top stub's own length of it covers the stub's reach.
  cylZ(
    s,
    0,
    0,
    COLLAR_Z + 4.6,
    SHAFT_R,
    SHAFT_TOP - COLLAR_Z - 4.6,
    { top: 'top', body: 'front' },
    14,
  )

  for (let i = 0; i < stubs; i++) {
    const w = 86 + ((i * 5) % 7),
      d = 36 + ((i * 3) % 4)
    const at = slabRot(s, 0, 0, Z0 + i * PITCH, w, d, THICK, ANGLES[i], {
      top: i % 2 ? 'front' : 'top',
      edge: 'side',
    })
    // Perforation where the stub tore off, and two printed rules; the cut length changes per stub.
    s.line([at(-16, -d / 2), at(-16, d / 2)], 'detail', 0.8, '1.5 2')
    s.line([at(-7, -13), at(34 + (i % 4) * 2, -13)], 'detail', 0.8)
    s.line([at(-7, -9), at(18 + (i % 3) * 3, -9)], 'detail', 0.8)
  }

  // The lit top stub rides the shaft up; the barcode, seat and perforation go with it.
  const topZ = Z0 + stubs * PITCH,
    a = -0.08,
    c = Math.cos(a),
    sn = Math.sin(a)
  const face = topZ + TOP_THICK
  const P = (u: number, v: number, z = face): P3 => [u * c - v * sn, u * sn + v * c, z]
  const corners: [number, number][] = [
    [W / 2, -D / 2],
    [W / 2, D / 2],
    [-W / 2, D / 2],
    [-W / 2, -D / 2],
  ]
  s.group(
    'top-stub',
    () => {
      s.glow(5, () =>
        s.poly(
          corners.map(([u, v]) => P(u, v)),
          'accent',
          'none',
        ),
      )
      slabRot(s, 0, 0, topZ, W, D, TOP_THICK, a, {
        top: 'accent',
        edge: 'accent-side',
        stroke: 'accent-side',
      })
      s.line([P(-16, -D / 2), P(-16, D / 2)], 'on-accent', 0.9, '1.5 2')
      // Barcode: bars of two weights, spaced unevenly.
      const bars: P3[][] = [],
        wide: P3[][] = []
      let u = -41
      for (let i = 0; i < 14; i++) {
        ;(i % 3 === 0 ? wide : bars).push([P(u, -12), P(u, 12)])
        u += 1.3 + (i % 4) * 0.45
      }
      s.segs(bars, 'on-accent', 0.7)
      s.segs(wide, 'on-accent', 1)
      s.text('12A', P(-7, 7), [c, sn, 0], [-sn, c, 0], {
        size: 11,
        fill: 'on-accent',
        weight: 700,
        mono: true,
      })
      s.line([P(-7, -13), P(34, -13)], 'on-accent', 0.9)
      s.line([P(-7, -9), P(18, -9)], 'on-accent', 0.9)
      s.line([P(-7, 13), P(34, 13)], 'on-accent', 0.9)
      // The punched hole, and the shaft coming up through it, as long as the stub's reach so it is never hidden by the stub's back half.
      s.poly(
        s.circle(P(0, 0), [c, sn, 0], [-sn, c, 0], 0, 0, 2.8, 14),
        'glass',
        'accent-side',
        undefined,
        0.8,
      )
      cylZ(s, 0, 0, face, SHAFT_R, REACH, { top: 'top', body: 'front' }, 14)
    },
    { vars: { '--lift-x': `${liftX}px`, '--lift-y': `${liftY}px` } },
  )

  // The sharpened tip stays where it is: the stub rises towards it.
  const apex: P3 = [0, 0, TIP],
    ring = s.circle([0, 0, SHAFT_TOP], X, Y, 0, 0, SHAFT_R, 16)
  s.poly2(hull([...s.pp(ring), s.P(...apex)]), 'front', 'line')
  s.poly([apex, ...ring.slice(-2), ...ring.slice(0, 3)], 'side', 'line')

  // Bounds: the tallest stack, rest and lifted.
  s.include(corners.flatMap(([u, v]): P3[] => [P(u, v, TOP_MAX), P(u, v, TOP_MAX + LIFT)]))
  // Every stub's footprint, whatever the count, so the swing of the widest cut is always inside the box.
  for (let i = 0; i < MAX_STUBS; i++) {
    const w = 86 + ((i * 5) % 7),
      d = 36 + ((i * 3) % 4),
      ca = Math.cos(ANGLES[i]),
      sa = Math.sin(ANGLES[i])
    s.include(
      (
        [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as const
      ).map(([p, q]): P3 => {
        const u = (p * w) / 2,
          v = (q * d) / 2
        return [u * ca - v * sa, u * sa + v * ca, Z0]
      }),
    )
  }
  s.include([apex])
  return s.done()
}
