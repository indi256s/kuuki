// Piton de la Fournaise: a wide low shield with the Enclos rampart on the left and the Dolomieu
// notch in the summit. A hatched ash plume rises from the vent with a lit fountain of spark arcs
// cut into it, and a paper lava river runs down the shaded right flank to the sea. The box bottom
// is the shoreline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { plumeNodes } from './mass-b'
import { rockMass } from './rock-b'
import { type KitModule, num } from './util'

export const fournaiseB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const P = (u: number, up: number): Pt => [x + w * u, base - up]
  const out: SvgNode[] = []

  // Silhouette top line, left to right: rampart plateau, cliff drop, the 15 degree shield, the notch.
  const shield: Pt[] = [
    P(0.2, 27),
    ...quad(P(0.2, 27), P(0.4, 38), P(0.5, 46), 8).slice(1),
    P(0.525, 49.5),
    P(0.545, 44),
    P(0.565, 45),
    P(0.585, 49),
    P(0.61, 45.5),
  ]
  const flank = quad(P(0.61, 45.5), P(0.78, 27), P(1, 2), 14)
  const top: Pt[] = [...shield, ...flank.slice(1)]
  const sil: Pt[] = [P(0.2, 0), ...top, P(1, 0)]
  out.push(occlude(sil, { halo: 2 }))

  // Rampart: a benched cliff block, strata on its lit face, T4 on the shaded side.
  const wallTop: Pt[] = [P(0, 58), P(0.06, 59), P(0.12, 55), P(0.16, 46), P(0.175, 33), P(0.2, 27)]
  const wall: Pt[] = [P(0, 0), ...wallTop, P(0.2, 0)]
  out.push(
    ...rockMass(wall, rand, {
      ridge: wallTop,
      shade: 0.4,
      slant: 0.25,
      fracture: 0,
      strata: true,
      strataGap: 2.6,
      darkGap: 2.2,
      smooth: true,
      keep: true,
    }),
  )
  // Two small parasitic cones on the Enclos floor.
  for (const [u, hh] of [
    [0.31, 8],
    [0.4, 11],
  ] as const) {
    const cone: Pt[] = [
      P(u - 0.06, 20 + hh * 0.2),
      P(u - 0.012, 22 + hh),
      P(u + 0.012, 22 + hh),
      P(u + 0.06, 20 + hh * 0.2),
    ]
    out.push(occlude(cone, { halo: 0.8 }), stroke('hair', cone))
  }

  // Enclos floor and lit left flank of the shield: sparse diagonals, closing towards the foot.
  const lit: Pt[] = [...shield.slice(0, -4), P(0.565, 0), P(0.2, 0)]
  out.push(
    ...toneFill(lit, 'T2', {
      angle: -58,
      gap: [4.2, 3.2],
      weight: 'fine',
      ramp: [base - 38, base],
    }),
  )
  // Shaded right flank: dense fall-line hatching.
  const shade: Pt[] = [
    P(0.565, 45),
    P(0.585, 49),
    P(0.61, 45.5),
    ...flank.slice(1),
    P(1, 0),
    P(0.565, 0),
  ]
  out.push(...toneFill(shade, 'T4', { angle: 60, gap: 2.9, weight: 'hair', inset: 0.2 }))

  // Lava river: a paper ribbon down the flank, edged in hair lines, ending at the sea.
  const path: Pt[] = [
    P(0.61, 44),
    P(0.65, 37),
    P(0.67, 30),
    P(0.73, 23),
    P(0.75, 14),
    P(0.81, 8),
    P(0.84, 0),
  ]
  const edge = (s: number): Pt[] =>
    path.map(([px, py], i) => [px + s * (2.2 + (i / path.length) * 3.4), py])
  out.push(occlude([...edge(-1), ...edge(1).reverse()], { halo: 0.6 }))
  out.push(stroke('hair', edge(-1)), stroke('hair', edge(1)))
  out.push(
    stroke(
      'fine',
      path.slice(1, -1).map(([px, py]) => [px + 0.4, py] as Pt),
    ),
  )

  // Ash plume over the vent, dense; the fountain is cut out of it and drawn as spark arcs.
  const vent = P(0.565, 46)
  out.push(
    ...plumeNodes(x + w * 0.4, x + w * 0.74, vent[1] + 1, 26, rand, {
      lobes: 6,
      thr: 0.3,
      gap: 2,
      halo: 1.6,
    }),
  )
  const wedge: Pt[] = [
    [vent[0] - 3, vent[1] + 1],
    [vent[0] - 10, vent[1] - 16],
    [vent[0] - 6, vent[1] - 23],
    [vent[0] + 6, vent[1] - 23],
    [vent[0] + 10, vent[1] - 16],
    [vent[0] + 3, vent[1] + 1],
  ]
  out.push(occlude(wedge, { halo: 0 }))
  for (let k = -4; k <= 4; k++) {
    const tipY = vent[1] - 11 - (1 - Math.abs(k) / 4.5) * 8 - rand() * 2
    out.push(
      stroke(
        Math.abs(k) < 2 ? 'hair' : 'fine',
        quad(
          [vent[0] + k * 0.4, vent[1] + 0.5],
          [vent[0] + k * 1.2, tipY - 6],
          [vent[0] + k * 2.1, tipY],
          8,
        ),
      ),
    )
  }
  // Outline: shield top (the notch carries the bold stroke).
  out.push(stroke('line', top.slice(0, -flank.length + 1)), stroke('line', flank))
  out.push(stroke('bold', [P(0.525, 49.5), P(0.545, 44), P(0.565, 45), P(0.585, 49)]))
  return out
}
