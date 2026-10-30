// A lane airliner built like a precise 1:N model: one per ICAO type from the measured geometry in
// packages/data/src/aircraft-geometry (SCHEMA.md), drawn with the pinned anatomy kit's camera, light and tone bands.
//
// Frame: metres; x points to the nose (the nose tip at x = 0, the tail at −length), +y is the near flank (toward the
// viewer; with the nose to the right that is the starboard side), z is up from the ground. "xg" is the records' station,
// aft from the nose (x = −xg).
//
// Estimated in the drawing, not in the data: belly height, nose shape between the measured stations, airfoil thickness,
// wheel track and tyre sizes (published values, rounded, by family), gear stations, door, exit, cargo-door and window
// stations, the inlet internals, flap-track fairing stations and the antenna positions.
import { airframeOf, tan, type Airframe } from './airframe'
import { drawing } from './draw'
import type { Kit } from './kit'
import type { AircraftGeometry, Item } from './model'
import { engine } from './engine'
import { fuselage } from './fuselage'
import { bodyGear, mainGear, noseGear, propGear } from './gear'
import { ringsOf, unionAll, type Camera, type Pt, type V3 } from './surface'
import { fin, stabiliser } from './tail'
import { flapFairings, highWing, wing } from './wing'

export type { AircraftGeometry } from './model'

// ---------------------------------------------------------------------------------------------------- the model

export type Built = {
  items: Item[]
  groundY: number
  tail: number
  nose: number
  /** The upper anti-collision beacon: on the crown over the wing box, or on top of a T-tail. */
  beacon: V3
}

/** The ground shadow: the plan of the fuselage, wings and stabilisers, flattened on the ground. */
function groundShadow(a: Airframe, cam: Camera): Item {
  const { g, Lb, y0, wingEnd, tTail, sec, leAt, teAt } = a
  const ht = g.htail
  const plan: Pt[][] = []
  const flat = (pts: [number, number][]) => pts.map(([xg, y]) => cam.project([-xg, y, 0.01]))
  const fus: [number, number][] = []
  for (let i = 0; i <= 40; i++) {
    const xg = (i / 40) * Lb
    fus.push([xg, sec(xg).w])
  }
  for (let i = 40; i >= 0; i--) {
    const xg = (i / 40) * Lb
    fus.push([xg, -sec(xg).w])
  }
  plan.push(flat(fus))
  for (const sg of [1, -1]) {
    plan.push(
      flat([
        [leAt(y0), sg * y0],
        [leAt(wingEnd), sg * wingEnd],
        [teAt(wingEnd), sg * wingEnd],
        [teAt(y0), sg * y0],
      ]),
    )
    if (!tTail) {
      const tipLE = ht.tipLEx ?? ht.rootLEx
      const tipTE = ht.tipTEx ?? tipLE + ht.tipChord
      plan.push(
        flat([
          [ht.rootLEx, sg * 0.5],
          [tipLE, (sg * ht.span) / 2],
          [tipTE, (sg * ht.span) / 2],
          [ht.rootLEx + ht.rootChord, sg * 0.5],
        ]),
      )
    }
  }
  const u = unionAll(
    plan.map((p) => [
      [...p.map((q) => [q[0], q[1]] as [number, number]), [p[0][0], p[0][1]] as [number, number]],
    ]),
  )
  return { kind: 'fill', rings: ringsOf(u), mat: 'shadow' }
}

export function airliner(g: AircraftGeometry, cam: Camera, kit: Pick<Kit, 'G' | 'P'>): Built {
  const a = airframeOf(g)
  const d = drawing(cam, kit)
  const { Lb, high, prop, tTail, trackHalf, tyreW, crownZ, finTopZ } = a
  const wg = g.wing,
    vt = g.vtail
  const engines = g.engines
  const farEngines = [...engines].sort((p, q) => q.y - p.y) // outboard (farthest) first
  const nearEngines = [...engines].sort((p, q) => p.y - q.y)

  // Assembly, far to near.
  const items: Item[] = [groundShadow(a, cam)]
  if (!tTail) items.push(stabiliser(a, d, -1))

  // Far side.
  if (high) {
    for (const e of farEngines) {
      const { out, front } = engine(a, d, e, -1)
      items.push(...propGear(a, d, e, -1), ...out, ...front)
    }
  } else {
    for (const e of farEngines) items.push(...engine(a, d, e, -1).out)
    items.push(...flapFairings(a, d, -1))
    items.push(...wing(a, d, -1))
    items.push(...mainGear(a, d, -1))
  }
  items.push(...bodyGear(a, d, -1))
  items.push(...noseGear(a, d))

  items.push(...fuselage(a, d))
  if (tTail) items.push(stabiliser(a, d, -1))
  items.push(fin(a, d))
  if (tTail) items.push(stabiliser(a, d, 1))

  // Near side.
  items.push(...bodyGear(a, d, 1))
  if (high) {
    const near = nearEngines.map((e) => ({ e, ...engine(a, d, e, 1) }))
    for (const { e, out } of near) items.push(...propGear(a, d, e, 1), ...out)
    items.push(highWing(a, d))
    for (const { front } of near) items.push(...front)
  } else {
    items.push(...mainGear(a, d, 1))
    for (const e of nearEngines) items.push(...engine(a, d, e, 1).out)
    items.push(...flapFairings(a, d, 1))
    items.push(...wing(a, d, 1))
    if (!tTail) items.push(stabiliser(a, d, 1))
  }
  const groundY = prop ? engines[0].y : trackHalf + (tyreW / 2 + 0.12)
  const beaconX = tTail
    ? vt.rootLEx + tan(vt.sweepLE) * vt.height + 0.3 * vt.tipChord
    : wg.rootLEx + 0.35 * wg.rootChord
  const beacon: V3 = [-beaconX, 0, tTail ? finTopZ + 0.15 : crownZ(beaconX, 0) + 0.1]
  return { items, groundY, tail: -Lb, nose: 0, beacon }
}
