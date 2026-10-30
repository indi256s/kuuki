// The landing gear: bogies under the wing, the A380's body gear, the nose leg and a turboprop's nacelle gear.
import type { Airframe } from './airframe'
import type { Item } from './model'
import { ringsOfPath, type Draw } from './draw'
import { engineAxis, type Engine } from './engine'
import { len, sub, unit, type V3 } from './surface'

const wheel = (a: Airframe, d: Draw, c: V3, dia: number): Item[] => {
  const { G, P, kitSolid } = d
  const r = dia / 2,
    w = a.tyreW * (dia / a.wheelD)
  const F = G.frameAlong(c, [0, 1, 0])
  const tyre = G.solidOf(
    [
      [-w / 2, r * 0.55],
      [-w / 2, r * 0.78, 1],
      [-w * 0.42, r * 0.93, 1],
      [-w * 0.25, r, 1],
      [w * 0.25, r, 1],
      [w * 0.42, r * 0.93, 1],
      [w / 2, r * 0.78, 1],
      [w / 2, r * 0.55],
    ],
    F,
    P,
    { smooth: false, steps: 20 },
  )
  const hub = G.disc(w / 2 - 0.01, w / 2 + 0.02, r * 0.55, F, P, { steps: 16 })
  return [
    kitSolid(tyre, 'rubber'),
    kitSolid(hub, 'metal', [
      {
        runs: ringsOfPath(G.circleOf(F, w / 2 + 0.02, r * 0.28, P)),
        ink: 'seam',
        width: 0.18,
      },
    ]),
  ]
}

const strut = (d: Draw, p: V3, q: V3, rr: number): Item => {
  const axis = sub(q, p)
  const L = len(axis)
  const F = d.G.frameAlong(p, unit(axis))
  return d.kitSolid(d.G.disc(0, L, rr, F, d.P), 'metal')
}

const gearLeg = (
  a: Airframe,
  d: Draw,
  xg: number,
  y: number,
  top: number,
  axles: number,
  dia = a.wheelD,
): Item[] => {
  const out: Item[] = []
  const r = dia / 2
  const gap = (a.tyreW * (dia / a.wheelD)) / 2 + 0.12
  const pitch = dia * 1.12
  const xs = Array.from({ length: axles }, (_, i) => -xg + (i - (axles - 1) / 2) * pitch)
  const axleZ = r
  // Far wheels of each axle, then the axles and the bogie beam and leg, then the near wheels.
  for (const x of xs) out.push(...wheel(a, d, [x, y - gap, axleZ], dia))
  for (const x of xs) out.push(strut(d, [x, y - gap, axleZ], [x, y + gap, axleZ], 0.06))
  if (axles > 1)
    out.push(
      strut(d, [xs[0] - 0.15, y, axleZ + 0.12], [xs[xs.length - 1] + 0.15, y, axleZ + 0.12], 0.11),
    )
  out.push(strut(d, [-xg, y, axleZ + (axles > 1 ? 0.12 : 0)], [-xg, y, top], 0.13 * (dia / 1.15)))
  out.push(
    strut(
      d,
      [-xg, y, top - 0.15 - (top - axleZ) * 0.45],
      [-xg + 0.02, y, top - 0.1],
      0.17 * (dia / 1.15),
    ),
  )
  for (const x of xs) out.push(...wheel(a, d, [x, y + gap, axleZ], dia))
  return out
}

/** Gear station (xg) of the main legs, and the number of axles on each. */
const mainXg = (a: Airframe) => a.g.wing.rootLEx + a.g.wing.rootChord * 0.72
const mainAxles = (a: Airframe) =>
  a.g.family === '777' || a.g.icao === 'A35K' ? 3 : a.wide ? 2 : 1

/** A main leg on side sg (+1 near, −1 far); a turboprop's gear stands in its nacelles instead. */
export const mainGear = (a: Airframe, d: Draw, sg: number): Item[] => {
  if (a.prop) return []
  const y = sg * a.trackHalf
  const top = Math.min(a.wingZ(a.trackHalf) - 0.3, a.zc - 0.2)
  return gearLeg(a, d, mainXg(a), y, top, mainAxles(a))
}
export const bodyGear = (a: Airframe, d: Draw, sg: number): Item[] =>
  a.g.family === 'A380' ? gearLeg(a, d, mainXg(a) + 3.2, sg * 2.0, a.zc - a.H * 0.8, 3) : []
export const noseGear = (a: Airframe, d: Draw): Item[] =>
  gearLeg(
    a,
    d,
    Math.min(a.nl * 0.86, a.g.fuselage.cockpitWindowX + 1.6),
    0,
    a.zc - a.H * 0.7,
    1,
    a.wheelD * 0.68,
  )
export const propGear = (a: Airframe, d: Draw, e: Engine, sg: number): Item[] => {
  const ax = engineAxis(a, e, sg)
  return gearLeg(a, d, e.fanX + e.nacelleLength * 0.45, sg * e.y, ax.z - 0.2, 1, a.wheelD)
}
