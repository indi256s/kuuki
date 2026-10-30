// The fuselage: the skin with its seams, joints, doors and hatches, the glass on it, and the antennas on the crown.
import { D2R, midHalf, type Airframe } from './airframe'
import type { Item, Lines } from './model'
import { closed, foil, roundedUV, type Draw, type Foil } from './draw'
import type { Rings } from './surface'

/** A blade antenna standing on the crown at station xg. */
const antenna = (a: Airframe, d: Draw, xg: number, h: number, c: number): Item => {
  const f: Foil = {
    path: (t) => [0, a.crownZ(xg, 0) - 0.06 + t * (h + 0.06)],
    le: (t) => xg + t * c * 0.55,
    te: (t) => xg + c - t * c * 0.15,
    tau: () => 0.16,
    up: () => [1, 0],
    root: (x, y, z) => [y, Math.min(z, a.crownZ(x, y))],
    rows: 6,
  }
  return d.solid(foil(f), 'metal', [], 0.3)
}

/** The fuselage solid with its skin lines, then the glass fills, then the two crown antennas. */
export function fuselage(a: Airframe, d: Draw): Item[] {
  const { g, Lb, R, H, nl, tc, high, prop, wide, rootTE, fairing0, fairing1, body, sec, thetaAt } =
    a
  const wg = g.wing
  const skin: Lines[] = []
  const uOf = (xg: number) => xg / Lb
  const vOf = (deg: number) => deg / 360 // 0 at the crown, 90° the near flank
  const ck = g.fuselage.cockpit
  const aft = ck?.aftX ?? g.fuselage.cockpitWindowX
  const fore = ck?.foreX ?? aft - 1.2
  // Radome joint (just ahead of the windscreen) and the production joints of the barrel and tail cone.
  skin.push(d.seam(body, 90, (t) => [uOf(Math.min(nl * 0.38, fore - 0.35)), t]))
  skin.push(d.seam(body, 90, (t) => [uOf(Lb - tc + 0.4), t], 'faint'))
  skin.push(d.seam(body, 90, (t) => [uOf(Lb - tc * 0.32), t], 'faint'))
  // The belly fairing's edge.
  if (!high)
    skin.push(
      d.seam(
        body,
        60,
        (t) => {
          const xg = fairing0 + (fairing1 - fairing0) * t
          // Its ends turn down under the belly, so the line meets the silhouette instead of stopping on the skin.
          const lift = Math.sin(t * Math.PI)
          return [uOf(xg), vOf(180 - 51 * Math.sqrt(lift))]
        },
        'faint',
      ),
    )
  const fills: Item[] = []
  const glass = (rings: Rings, framed = false) => {
    if (rings.length)
      fills.push({
        kind: 'fill',
        rings,
        mat: 'glass',
        ...(framed ? { edge: 'line' as const, width: 0.16 } : {}),
      })
  }
  // Cockpit glazing on the near side: the record's edge angles fix the sill and head heights at the aft edge, and the
  // panes keep those heights forward, so the windscreen climbs over the narrowing nose to the centre post by itself.
  {
    const s = sec(aft)
    const [, h] = midHalf(s)
    const sill = h + h * Math.sin((ck?.lowDeg ?? 28) * D2R),
      head = h + h * Math.sin((ck?.highDeg ?? 50) * D2R)
    const span = aft - fore
    const post = 0.06
    const cut1 = fore + 0.46 * span,
      cut2 = fore + 0.76 * span
    const lo = (x: number) => thetaAt(x, sill + 0.08 * (1 - (x - fore) / span))
    const hi = (x: number) => Math.max(thetaAt(x, head), 3)
    const pane = (corners: [number, number][]) =>
      glass(
        d.patch(
          body,
          corners.map(([x, th]) => [uOf(x), vOf(th)]),
          0.0,
        ),
        true,
      )
    // Windscreen: the front edge leans back from the sill corner over the nose to the centre post.
    const ws = (sg: number) =>
      pane([
        [fore + 0.1 * span, sg * lo(fore + 0.1 * span)],
        [cut1 - post, sg * lo(cut1 - post)],
        [cut1 - post, sg * hi(cut1 - post)],
        [fore + 0.2 * span, sg * hi(fore + 0.2 * span)],
        [fore + 0.02 * span, sg * Math.max(hi(fore), 3)],
      ])
    ws(-1)
    ws(1)
    // Two side windows, the sliding one first; the last one's aft edge sweeps up.
    pane([
      [cut1 + post, lo(cut1 + post)],
      [cut2 - post, lo(cut2 - post)],
      [cut2 - post, hi(cut2 - post)],
      [cut1 + post, hi(cut1 + post)],
    ])
    pane([
      [cut2 + post, lo(cut2 + post)],
      [aft, lo(aft) - 2],
      [aft - 0.12 * span, hi(aft)],
      [cut2 + post, hi(cut2 + post)],
    ])
  }
  // Doors (starboard: R1 forward, the last R door aft), overwing exits, cargo doors, then the window row.
  const doorH = Math.min(1.85, H * 0.9)
  const doorW = wide ? 1.07 : 0.81
  const windowZ = (deck: 'main' | 'upper') => {
    if (deck === 'upper' && g.fuselage.upperDeckWindowZ) return g.fuselage.upperDeckWindowZ
    if (g.fuselage.mainDeckWindowZ) return g.fuselage.mainDeckWindowZ
    return H * (prop ? 1.12 : 1.18)
  }
  const outlineUV = (xg: number, zMid: number, w: number, h: number) => {
    const t0 = thetaAt(xg, zMid + h / 2),
      t1 = thetaAt(xg, zMid - h / 2)
    return roundedUV(uOf(xg), vOf((t0 + t1) / 2), w / 2 / Lb, (t1 - t0) / 2 / 360, 0.3, 3)
  }
  const doorAt = (xg: number, w = doorW, h = doorH, zMid = windowZ('main') - 0.15) => {
    const loop = outlineUV(xg, zMid, w, h)
    const rings = d.patch(body, loop, 0.05)
    if (rings.length) skin.push({ runs: closed(rings), ink: 'seam', width: 0.26 })
  }
  const lastDoor = Lb - tc + (wide ? 1.2 : 0.95)
  const firstDoor = Math.max(g.fuselage.cockpitWindowX + 1.3, nl * 0.95)
  doorAt(firstDoor)
  doorAt(lastDoor)
  const wingMid = wg.rootLEx + wg.rootChord * 0.35
  const exits: number[] = []
  if (!prop) {
    if (wide) {
      doorAt(wg.rootLEx - 1.5)
      doorAt(rootTE + 1.2)
      if (Lb > 60) doorAt((firstDoor + wg.rootLEx - 1.5) / 2)
    } else if (Lb > 42) {
      doorAt(wg.rootLEx - 2.4)
      doorAt(rootTE + 2.0)
    } else {
      exits.push(wingMid - 0.5, wingMid + 0.5)
      for (const x of Lb < 35 ? [wingMid] : exits) doorAt(x, 0.51, 0.96, windowZ('main') - 0.05)
    }
  }
  // Cargo doors on the lower lobe, ahead of and behind the wing.
  if (!prop) {
    const cw = wide ? 2.7 : 1.82,
      ch = wide ? 1.7 : 1.24
    for (const x of [Math.max(firstDoor + 2.2, wg.rootLEx - 3.4), rootTE + (wide ? 4.5 : 2.2)]) {
      const loop = outlineUV(x, H * 0.55, cw, ch)
      const rings = d.patch(body, loop, 0.04)
      if (rings.length) skin.push({ runs: closed(rings), ink: 'faint', width: 0.22 })
    }
  }
  // Windows: one row (two on the A380), skipping doors and exits, at a ~0.53 m pitch.
  const decks: ('main' | 'upper')[] = g.fuselage.decks > 1 ? ['main', 'upper'] : ['main']
  const pitch = wide ? 0.53 : 0.533
  for (const deck of decks) {
    const z = windowZ(deck)
    const from = firstDoor + doorW / 2 + 0.55,
      to = lastDoor - doorW / 2 - 0.45
    for (let x = from; x <= to; x += pitch) {
      if (exits.some((e) => Math.abs(x - e) < 0.5) && !(Lb < 35)) continue
      if (wide && [wg.rootLEx - 1.5, rootTE + 1.2].some((dx) => Math.abs(x - dx) < 0.8)) continue
      if (
        !wide &&
        Lb > 42 &&
        [wg.rootLEx - 2.4, rootTE + 2.0].some((dx) => Math.abs(x - dx) < 0.75)
      )
        continue
      if (Lb < 35 && Math.abs(x - wingMid) < 0.45) continue
      if (sec(x).w < R * 0.985) continue
      glass(d.patch(body, outlineUV(x, z, 0.24, 0.34), 0.1))
    }
  }
  return [
    d.solid(body, 'body', skin),
    ...fills,
    // VHF blades on the crown, ahead of the wing and over the aft cabin.
    antenna(a, d, Math.max(firstDoor + 2.5, Lb * 0.24), prop ? 0.3 : 0.42, 0.55),
    antenna(a, d, Lb * 0.58, prop ? 0.3 : 0.4, 0.55),
  ]
}
