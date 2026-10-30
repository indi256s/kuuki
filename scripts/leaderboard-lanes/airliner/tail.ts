// The tail: a horizontal stabiliser half with its elevator hinge line, and the fin in livery.
import { clamp, midHalf, tan, type Airframe } from './airframe'
import type { Item } from './model'
import { dihedralUp, foil, vChord, type Draw, type Foil } from './draw'

// Stabiliser, one side.
const stabFoil = (a: Airframe, sg: number): Foil => {
  const { g, R, Lb, tTail, finTopZ, sec, skinY } = a
  const ht = g.htail
  const rootY = tTail ? 0 : (ht.rootY ?? R * 0.8)
  const tipLE = ht.tipLEx ?? ht.rootLEx + tan(ht.sweepLE) * (ht.span / 2 - rootY)
  const tipTE = ht.tipTEx ?? tipLE + ht.tipChord
  const zRootS = tTail
    ? finTopZ - (ht.zBelowFinTop ?? 0.25)
    : sec(ht.rootLEx + ht.rootChord * 0.4).top * 0.15 + 0.85 * midHalf(sec(ht.rootLEx))[0]
  const tD = tan(ht.dihedral)
  // Inboard of the measured root the leading edge and chord extend along the same lines to the body.
  const lerpX = (x0: number, x1: number) => (y: number) =>
    x0 + ((x1 - x0) * (y - rootY)) / (ht.span / 2 - rootY)
  const le = lerpX(ht.rootLEx, tipLE),
    te = lerpX(ht.rootLEx + ht.rootChord, Math.min(tipTE, g.dims.length - 0.01))
  const yIn = tTail ? 0 : Math.min(rootY, skinY(ht.rootLEx + ht.rootChord * 0.5, zRootS) * 0.9)
  const yAt2 = (t: number) => yIn + t * (ht.span / 2 - yIn)
  const up = dihedralUp(sg, tD)
  return {
    path: (t) => [sg * yAt2(t), zRootS + tD * (yAt2(t) - rootY)],
    le: (t) => le(yAt2(t)),
    te: (t) => te(yAt2(t)),
    tau: () => 0.1,
    up: () => up,
    root: tTail
      ? undefined
      : (xg, _y, z) => [sg * Math.max(skinY(Math.min(xg, Lb - 0.05), z), 0.01), z],
    rows: 22,
  }
}

// The fin: its root stands on the crown, the dorsal fillet (where measured) runs forward along it.
const finFoil = (a: Airframe): Foil => {
  const { g, Lb, tTail, finTopZ, crownZ } = a
  const ht = g.htail,
    vt = g.vtail
  const zR = crownZ(vt.rootLEx, 0)
  const dl = vt.dorsalFin && vt.dorsalLength && vt.dorsalHeight ? vt.dorsalLength : 0
  const dh = dl ? vt.dorsalHeight! : 0
  const top = tTail ? finTopZ - (ht.zBelowFinTop ?? 0.25) + 0.12 : finTopZ
  const zAt = (t: number) => zR - 0.3 + t * (top - zR + 0.3)
  const hOf = (t: number) => zAt(t) - zR
  const fillet = (t: number) => {
    if (!dl) return 0
    const h = hOf(t)
    if (h >= dh) return 0
    const k = 1 - Math.max(0, h) / dh
    return dl * k * k
  }
  return {
    path: (t) => [0, zAt(t)],
    le: (t) => vt.rootLEx + tan(vt.sweepLE) * Math.max(0, hOf(t)) - fillet(t),
    te: (t) => {
      const u = clamp(hOf(t) / vt.height)
      const root = vt.rootLEx + vt.rootChord
      const tipLE = vt.rootLEx + tan(vt.sweepLE) * vt.height
      return Math.min(root + (tipLE + vt.tipChord - root) * u, g.dims.length - 0.01)
    },
    tau: (t) => 0.115 - 0.025 * clamp(hOf(t) / vt.height),
    up: () => [1, 0],
    root: (xg, y, z) => [y, Math.min(z, crownZ(Math.min(xg, Lb - 0.05), y))],
    rows: 30,
    at: dh ? [(dh + 0.3) / (top - zR + 0.3)] : [],
  }
}

/** A stabiliser half (sg = +1 near, −1 far) with its elevator hinge line. */
export function stabiliser(a: Airframe, d: Draw, sg: number): Item {
  const s = foil(stabFoil(a, sg))
  return d.solid(s, 'body', [d.seam(s, 30, (t) => [t, vChord(0.7)], 'seam', 0.2)])
}

/** The fin in livery, with its seam. */
export function fin(a: Airframe, d: Draw): Item {
  const finS = foil(finFoil(a))
  return d.solid(finS, 'livery', [d.seam(finS, 40, (t) => [t, vChord(0.7)])])
}
