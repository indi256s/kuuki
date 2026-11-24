import { Scene, hull, type IsoFigureData, type P3 } from './scene'
import { X, Y, cylZ, shadowDisc, slabRot } from './solids'

const LIFT = 18
const R = 34,
  FELT = 1.2,
  BASE_H = 8,
  RIM_H = 1.4,
  COLLAR_Z = FELT + BASE_H + RIM_H,
  SHAFT_R = 1.8,
  Z0 = 22,
  PITCH = 3,
  THICK = 1.5,
  TOP_THICK = 1.8,
  MAX_STUBS = 12,
  W = 90,
  D = 38,
  REACH = 30,
  TIP_H = 16
const TOP_MAX = Z0 + MAX_STUBS * PITCH + TOP_THICK,
  SHAFT_TOP = TOP_MAX + LIFT + REACH,
  TIP = SHAFT_TOP + TIP_H

const ANGLES = [-0.12, 0.14, -0.04, 0.18, -0.15, 0.08, -0.07, 0.13, -0.1, 0.05, -0.16, 0.1]

export function spike(k: number, { stubs }: { stubs: 3 | 5 | 8 | 12 }): IsoFigureData {
  const s = new Scene(k)
  const [liftX, liftY] = s.vector(0, 0, LIFT)
  shadowDisc(s, 0, 0, R + 8)

  cylZ(s, 0, 0, 0, R - 2, FELT, { top: 'front', body: 'side' }, 40)
  cylZ(s, 0, 0, FELT, R, BASE_H, { top: 'top', body: 'side' }, 40)
  const groove: P3[] = []
  for (let i = 0; i <= 20; i++) {
    const a = ((-45 + (180 * i) / 20) * Math.PI) / 180
    groove.push([R * Math.cos(a), R * Math.sin(a), FELT + 2.4])
  }
  s.line(groove, 'detail', 0.8)
  cylZ(s, 0, 0, FELT + BASE_H, R - 2.6, RIM_H, { top: 'top', body: 'front' }, 40)
  s.poly(s.circle([0, 0, COLLAR_Z], X, Y, 0, 0, R - 9, 40), 'none', 'detail', undefined, 0.8)
  s.poly(s.circle([0, 0, COLLAR_Z], X, Y, 0, 0, R - 11, 40), 'none', 'detail', undefined, 0.6)
  cylZ(s, 0, 0, COLLAR_Z, 7.5, 2.4, { top: 'top', body: 'front' }, 24)
  cylZ(s, 0, 0, COLLAR_Z + 2.4, 5.4, 2.2, { top: 'top', body: 'side' }, 20)
  const seam = s.circle([0, 0, COLLAR_Z + 3.4], X, Y, 0, 0, 5.4, 20)
  s.line([...seam.slice(-5), ...seam.slice(0, 6)], 'detail', 0.7)

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
    s.line([at(-16, -d / 2), at(-16, d / 2)], 'detail', 0.8, '1.5 2')
    s.line([at(-7, -13), at(34 + (i % 4) * 2, -13)], 'detail', 0.8)
    s.line([at(-7, -9), at(18 + (i % 3) * 3, -9)], 'detail', 0.8)
  }

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

  const apex: P3 = [0, 0, TIP],
    ring = s.circle([0, 0, SHAFT_TOP], X, Y, 0, 0, SHAFT_R, 16)
  s.poly2(hull([...s.pp(ring), s.P(...apex)]), 'front', 'line')
  s.poly([apex, ...ring.slice(-2), ...ring.slice(0, 3)], 'side', 'line')

  s.include(corners.flatMap(([u, v]): P3[] => [P(u, v, TOP_MAX), P(u, v, TOP_MAX + LIFT)]))
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
