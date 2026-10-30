// The main wing: one half with its upper-skin seams and wingtip devices, the one-piece high wing, flap-track fairings.
import { smooth, stations, tan, type Airframe } from './airframe'
import type { Item, Lines } from './model'
import { dihedralUp, foil, foilAt, oriented, revolve, vChord, type Draw, type Foil } from './draw'
import type { Surface } from './surface'

// The main wing, one side (sg = +1 near, −1 far).
const wingFoil = (a: Airframe, sg: number): Foil => {
  const { g, high, y0, wingEnd, wingZ, tanD, leAt, teAt, tau, skinY, kink, rake } = a
  const wg = g.wing,
    tip = g.wingtip
  const yA = high ? 0 : y0
  const yAt = (t: number) => yA + t * (wingEnd - yA)
  const up = dihedralUp(sg, tanD)
  return {
    path: (t) => [sg * yAt(t), wingZ(Math.max(yAt(t), y0))],
    le: (t) => leAt(Math.max(yAt(t), y0)),
    te: (t) => {
      const y = yAt(t)
      // Raked and pointed tips: keep a sliver of chord so the tip closes as an edge, not a point.
      return Math.max(teAt(Math.max(y, y0)), leAt(Math.max(y, y0)) + 0.06)
    },
    tau: (t) => tau(yAt(t)),
    up: () => up,
    root: high
      ? undefined
      : (xg, _y, z) => {
          const ys = skinY(xg, z)
          return [sg * Math.max(ys, 0.01), z]
        },
    rows: 46,
    at: [kink, wg.leBreakY, rake ? rake[0].y : null, ...(tip.rakeLE ?? []).map((p) => p.y)]
      .filter((y): y is number => y != null)
      .map((y) => (y - yA) / (wingEnd - yA)),
    camber: 0.018,
  }
}

/**
 * A wingtip device rising (or dropping) from the wing end: a cubic from the end chord, leaving it level, to the blade
 * tip `h` above (below) it and `reach` outboard, arriving at `cant` from vertical. The upper blade's reach takes it
 * to half span (SCHEMA.md: from `rootY`, else the lean `height·tan(cant)`); `blend` is the share of the reach run
 * level before it turns (0: a fence, straight up).
 */
const tipDevice = (
  a: Airframe,
  sg: number,
  h: number,
  dir: 1 | -1,
  chordTipFrac: number,
  blend: number,
): Surface => {
  const { g, half, wingEnd, wingZ, leAt, chordAt } = a
  const yT = wingEnd,
    zT = wingZ(yT)
  const le0 = leAt(yT),
    c0 = Math.max(0.3, chordAt(yT))
  const tanCant = tan(g.wingtip.cant)
  const reach = dir > 0 ? half - yT : h * tanCant
  const P1: [number, number] = blend > 0 ? [blend * reach, 0] : [0, h / 3]
  const P2: [number, number] = [reach - 0.35 * h * tanCant, (blend > 0 ? 0.65 : 2 / 3) * h]
  const P3: [number, number] = [reach, h]
  const pathAt = (t: number): [number, number, number, number] => {
    // Returns y, z and the unit tangent (ty, tz) along the device, from the wing end.
    const m = 1 - t
    const y = 3 * m * m * t * P1[0] + 3 * m * t * t * P2[0] + t * t * t * P3[0]
    const z = 3 * m * m * t * P1[1] + 3 * m * t * t * P2[1] + t * t * t * P3[1]
    const dy = 3 * m * m * P1[0] + 6 * m * t * (P2[0] - P1[0]) + 3 * t * t * (P3[0] - P2[0])
    const dz = 3 * m * m * P1[1] + 6 * m * t * (P2[1] - P1[1]) + 3 * t * t * (P3[1] - P2[1])
    const l = Math.hypot(dy, dz) || 1
    return [yT + y, zT + dir * z, dy / l, (dir * dz) / l]
  }
  const sweepBack = (t: number) => c0 * (0.15 + 0.62 * t) + h * 0.32 * t
  const le = (t: number) => le0 + sweepBack(t) * smooth(t * 1.6)
  const f: Foil = {
    path: (t) => {
      const [y, z] = pathAt(t)
      return [sg * y, z]
    },
    le,
    // The chord shrinks to chordTipFrac at the blade tip.
    te: (t) => le(t) + c0 * (1 - (1 - chordTipFrac) * smooth(t * 1.15)),
    tau: (t) => 0.1 - 0.02 * t,
    up: (t) => {
      const [, , ty, tz] = pathAt(t)
      // Thickness lies across the blade: the tangent turned a quarter, toward the inboard/top side.
      return [-sg * tz * dir, ty * dir]
    },
    rows: 18,
  }
  return oriented({ at: foilAt(f), u: stations(18), v: 48, closed: true }, 0.6)
}

const devices = (a: Airframe, sg: number): Surface[] => {
  const tip = a.g.wingtip
  switch (tip.type) {
    case 'sharklet':
      return [tipDevice(a, sg, tip.height, 1, 0.28, 0.5)]
    case 'blended':
      return [tipDevice(a, sg, tip.height, 1, 0.32, 0.4)]
    case 'curved':
      return [tipDevice(a, sg, tip.height, 1, 0.2, 0.6)]
    case 'at-winglet':
      return [
        tipDevice(a, sg, tip.height, 1, 0.3, 0.35),
        tipDevice(a, sg, tip.below, -1, 0.35, 0.3),
      ]
    case 'fence':
      return [
        tipDevice(a, sg, tip.height, 1, 0.35, 0),
        ...(tip.below ? [tipDevice(a, sg, tip.below, -1, 0.35, 0)] : []),
      ]
    default:
      return []
  }
}

// Upper-skin seams on either wing: the slat line along the leading edge, the flap and aileron hinge line, spoilers.
const wingSeams = (a: Airframe, d: Draw, wl: Surface): Lines[] => {
  const { y0, wingEnd, tipY } = a
  const span = (y: number) => (y - y0) / (wingEnd - y0)
  const ail = span(y0 + (tipY - y0) * 0.7)
  const end = Math.min(span(tipY), 1)
  // Each line runs out to the root, the tip or the aileron's end ticks, and the ticks run back to the trailing edge.
  const out: Lines[] = [
    d.seam(wl, 60, (t) => [t * end, vChord(0.12)], 'faint'),
    d.seam(wl, 40, (t) => [t * ail, vChord(0.74)]),
    d.seam(wl, 20, (t) => [ail + t * (end - 0.03 - ail), vChord(0.76)]),
    d.seam(wl, 6, (t) => [ail, vChord(0.74 + 0.26 * t)]),
    d.seam(wl, 6, (t) => [end - 0.03, vChord(0.76 + 0.24 * t)]),
  ]
  for (const t of [0.18, 0.3, 0.42, 0.54])
    out.push(d.seam(wl, 8, (k) => [t, vChord(0.6 + 0.14 * k)], 'faint', 0.18))
  return out
}

/** One half of the main wing with its upper-skin seams, then its wingtip devices in livery. */
export function wing(a: Airframe, d: Draw, sg: number): Item[] {
  const wl = foil(wingFoil(a, sg))
  return [
    d.solid(wl, 'body', wingSeams(a, d, wl)),
    ...devices(a, sg).map((s) => d.solid(s, 'livery')),
  ]
}

/** The high wing spans both sides in one piece, on the crown. */
export function highWing(a: Airframe, d: Draw): Item {
  const { wingEnd, wingZ, leAt, teAt, tau } = a
  const yAt = (t: number) => -wingEnd + 2 * wingEnd * t
  const both: Foil = {
    ...wingFoil(a, 1),
    path: (t) => {
      const y = yAt(t)
      return [y, wingZ(Math.abs(y))]
    },
    le: (t) => leAt(Math.abs(yAt(t))),
    te: (t) => teAt(Math.abs(yAt(t))),
    tau: (t) => tau(Math.abs(yAt(t))),
    up: () => [0, 1],
    root: undefined,
    rows: 60,
  }
  const wS = foil(both)
  return d.solid(wS, 'body', [
    // The flap and aileron hinge line, tip to tip across the crown.
    d.seam(wS, 120, (t) => [t, vChord(0.74)]),
  ])
}

// Canoe fairings under the trailing edge, standing out behind it: three a side on the jets (estimated stations).
export function flapFairings(a: Airframe, d: Draw, sg: number): Item[] {
  const { high, y0, tipY, leAt, chordAt, wingZ, tau, teAt } = a
  if (high) return []
  const out: Item[] = []
  for (const k of [0.2, 0.42, 0.64]) {
    const y = y0 + k * (tipY - y0)
    const le = leAt(y),
      c = chordAt(y)
    const zl = wingZ(y) - 0.3 * tau(y) * c
    const rf = Math.max(0.12, 0.05 * c)
    const x0 = le + 0.5 * c,
      x1 = teAt(y) + 0.22 * c
    const ax = { x: -x0, y: sg * y, z: zl }
    const s = revolve(
      ax,
      (m) => [
        m * (x1 - x0),
        rf *
          Math.pow(Math.sin(Math.PI * Math.min(m * 1.25, 1) * 0.5), 0.5) *
          (1 - smooth((m - 0.55) / 0.45) * 0.97),
      ],
      14,
    )
    out.push(d.solid(oriented(s, 0.4), 'body', [], 0.35))
  }
  return out
}
