// The engines: a turbofan's nacelle with its fan face, exhaust and pylon, or a turboprop's nacelle with its propeller.
import { clamp, nacelleFlat, smooth, type Airframe } from './airframe'
import type { AircraftGeometry, Ink, Item } from './model'
import { closed, foil, oriented, revolve, ringsOfPath, type Draw, type Foil } from './draw'
import { add, mul, type Pt, type Surface, type V3 } from './surface'

export type Engine = AircraftGeometry['engines'][number]

export const engineAxis = (a: Airframe, e: Engine, sg: number) => {
  const zce = a.lowerAt(e.y) - e.dropBelowWing
  return { y: sg * e.y, z: zce, x: -e.fanX }
}

const propItems = (d: Draw, e: Engine, ax: { x: number; y: number; z: number }): Item[] => {
  const { cam, G, P, kitSolid } = d
  const r = e.nacelleDiameter / 2
  const F = G.frameAlong([ax.x + 0.1, ax.y, ax.z], [1, 0, 0])
  const spinner = G.solidOf(
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8
      return [0.75 * t, 0.62 * r * Math.sqrt(1 - t * t * 0.98), 1]
    }),
    F,
    P,
  )
  const D = e.prop!.diameter / 2
  // The turning disc: a faint ring; four blades frozen in it.
  const ring: Pt[] = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * 2 * Math.PI
    return cam.project(G.pointOf(F, 0.25, D, a))
  })
  const blades: Item[] = []
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 2 * Math.PI + 0.5
    const dir = G.radialOf(F, a) as V3
    const side = G.tangentOf(F, a) as V3
    const at = (rr: number, w: number, s = 0.25): V3 =>
      add(add(G.pointOf(F, s, 0, 0), mul(dir, rr)), mul(side, w))
    blades.push({
      kind: 'fill',
      rings: [
        [
          at(0.3, -0.13),
          at(D * 0.55, -0.15),
          at(D * 0.97, -0.07),
          at(D, 0),
          at(D * 0.97, 0.06),
          at(D * 0.55, 0.1),
          at(0.3, 0.1),
        ].map(cam.project),
      ],
      mat: 'metal',
      edge: 'line',
      width: 0.35,
    })
  }
  return [
    { kind: 'lines', lines: { runs: closed([ring]), ink: 'faint', width: 0.3 } },
    ...blades,
    kitSolid(spinner, 'metal'),
  ]
}

/**
 * One engine on side sg: `out` is the nacelle and pylon, drawn before the wing; `front`
 * the turboprop's spinner and blades, drawn after it.
 */
export function engine(
  a: Airframe,
  d: Draw,
  e: Engine,
  sg: number,
): { out: Item[]; front: Item[] } {
  const { G, P, solid, kitSolid, twoTone } = d
  const ax = engineAxis(a, e, sg)
  const r = e.nacelleDiameter / 2
  const L = e.nacelleLength
  const flat = nacelleFlat(e)
  const out: Item[] = []
  if (e.prop) {
    // Turboprop: a long round nacelle under the high wing, the spinner and the blades in front.
    const nac = revolve(
      ax,
      (m) => {
        const s = -0.1 + m * (L + 0.1)
        const u = m
        const shape =
          u < 0.12
            ? 0.62 + 0.38 * Math.sqrt(u / 0.12)
            : u > 0.7
              ? 1 - 0.55 * smooth((u - 0.7) / 0.3)
              : 1
        return [s, r * shape * (u < 0.02 ? Math.sqrt(u / 0.02) : 1)]
      },
      40,
    )
    const n2: Surface = {
      ...nac,
      at: (m, v) => {
        const p = nac.at(m, v)
        // A deeper nacelle under the wing (it carries the gear bay): stretch the lower half.
        const dz = p[2] - ax.z
        return [p[0], p[1], dz < 0 ? ax.z + dz * 1.35 : p[2]]
      },
    }
    // The livery on the engine cowling ahead of the wing; the nacelle aft of it stays bare.
    const cowlEnd = clamp((a.leAt(e.y) - e.fanX + 0.1) / (L + 0.1), 0.25, 0.6)
    out.push(...twoTone(oriented(n2, 0.5), 'body', 0, cowlEnd))
    return { out, front: propItems(d, e, ax) }
  }
  // Exhaust: the core cowl and plug behind the fan cowl, drawn first (they sit behind it from this side).
  const ex = e.exhaustLength ?? L * 0.32
  const core = revolve(
    ax,
    (m) => {
      const s = L - 0.3 + m * (ex * 0.6 + 0.3)
      return [s, r * (0.66 - 0.24 * smooth(m))]
    },
    10,
  )
  const plug = revolve(
    ax,
    (m) => {
      const s = L + ex * 0.55 + m * ex * 0.45
      return [s, r * 0.33 * Math.pow(Math.max(0, 1 - m), 0.8) + 0.001]
    },
    10,
  )
  out.push(solid(oriented(plug, 0.3), 'metal'))
  out.push(solid(oriented(core, 0.5), 'metal'))
  // Intake: the dark fan face, the spinner, the inner wall; the lip and outer cowl go over them.
  const fanS = 0.42 * r
  const fanF = G.frameAlong([ax.x - fanS, ax.y, ax.z], [-1, 0, 0])
  const disc = G.disc(-0.01, 0.01, r * 0.86, fanF, P)
  out.push({ kind: 'fill', rings: ringsOfPath(disc.fill), mat: 'void' })
  const spinner = G.solidOf(
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8
      return [-0.32 * r * (1 - t), 0.26 * r * Math.sqrt(t), 1]
    }),
    fanF,
    P,
  )
  out.push(kitSolid(spinner, 'metal', [], 0.18))
  const inner = revolve(ax, (m) => [fanS * (1 - m) + 0.1 * r * m, r * (0.85 - 0.01 * m)], 8)
  out.push(solid(oriented(inner, 0.5, true), 'void', [], 0))
  // Lip and cowl: one meridian from the lip's inner edge, round the elliptical lip, over the cowl to the fan nozzle.
  const hl = 0.9 * r,
    lipT = 0.06 * r,
    lipA = 0.1 * r
  const lipEnd = 0.2
  const cowl = revolve(
    ax,
    (m) => {
      if (m < lipEnd) {
        const t = -Math.PI / 2 + (m / lipEnd) * Math.PI
        return [lipA * (1 - Math.cos(t)), hl + lipT * Math.sin(t)]
      }
      const u = (m - lipEnd) / (1 - lipEnd)
      const s = lipA + u * (L - lipA)
      const r0 = hl + lipT
      const swell = Math.sin(Math.min(1, u / 0.32) * (Math.PI / 2))
      const aft = smooth((u - 0.52) / 0.48)
      return [s, (r0 + (r - r0) * swell) * (1 - 0.15 * aft)]
    },
    40,
    flat,
  )
  // The cowl in livery behind a bare metal lip ring.
  const ring = lipEnd + ((1 - lipEnd) * 0.16 * r) / (L - lipA)
  const cowlSeams: [number, Ink][] =
    sg > 0
      ? [
          [lipEnd + (1 - lipEnd) * 0.42, 'seam'],
          [lipEnd + (1 - lipEnd) * 0.8, 'faint'],
        ]
      : []
  out.push(...twoTone(oriented(cowl, 0.5), 'metal', ring, 1, cowlSeams))
  // Pylon: from the cowl crown up into the wing's lower skin, its fairing running past the nozzle.
  const zw = a.lowerAt(e.y) + 0.05
  const pyl: Foil = {
    path: (t) => [sg * e.y, ax.z + r * 0.7 + t * (zw - ax.z - r * 0.7)],
    le: (t) => e.fanX + L * (0.28 - 0.1 * t),
    te: (t) => e.fanX + L + ex * (0.75 - 0.35 * t),
    tau: () => 0.12,
    up: () => [1, 0],
    rows: 8,
  }
  out.push(solid(foil(pyl), 'body'))
  return { out, front: [] }
}
