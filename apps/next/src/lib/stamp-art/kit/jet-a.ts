// Airliner on final approach, side view, nose to the left and slightly raised, gear down (Maho
// Beach, Sint Maarten). The box is where the aircraft sits: its width is the aircraft length, and
// it is centred on the box. A long lit fuselage with a shaded belly and a window band, a swept fin
// and tailplane, a swept wing with an engine pod, and nose and main gear on struts.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

export const jetA: KitModule = ([x, y, w, h], p) => {
  const s = w / 145
  const pitch = (num(p, 'pitch', 4) * Math.PI) / 180
  const cx = x + w / 2
  const cy = y + h / 2
  // Local coordinates: nose at (0, 0) on the centreline, tail at (145, 0); y is down.
  const T = ([lx, ly]: Pt): Pt => {
    const dx = (lx - 72.5) * s
    const dy = ly * s * 1.2
    return [
      cx + dx * Math.cos(pitch) - dy * Math.sin(pitch),
      cy + dx * Math.sin(pitch) + dy * Math.cos(pitch),
    ]
  }
  const P = (pts: Pt[]): Pt[] => pts.map(T)
  const out: SvgNode[] = []

  // Far wing is hidden; draw the near wing first so the fuselage overlaps its root.
  const wing: Pt[] = [
    [50, 3],
    [86, 3],
    [96, 27],
    [84, 27],
  ]
  out.push(occlude(P(wing), { halo: 1.2 }), ...body(P(wing), 'hair'))
  out.push(
    ...toneFill(
      P([
        [84, 3.6],
        [86, 3.6],
        [96, 26.4],
        [91, 26.4],
      ]),
      'T4',
      { inset: 0.2 },
    ),
  )
  // Engine pod under the wing.
  const pod: Pt[] = [
    [60, 11],
    [80, 11],
    [82, 15],
    [80, 19],
    [60, 19],
    [58, 15],
  ]
  out.push(occlude(P(pod), { halo: 1.2 }), fill(P(pod)))
  // Landing gear: nose strut and a main strut with a bogie.
  for (const [gx, top, bot] of [
    [16, 7, 24],
    [70, 19, 30],
    [82, 8, 28],
  ] as const) {
    out.push(
      stroke(
        'line',
        P([
          [gx, top],
          [gx, bot - 3],
        ]),
      ),
    )
    out.push(fill(P(wheel(gx, bot, 3.4))))
  }

  // Fuselage: raised cockpit, long barrel, tapering tail cone.
  const upper: Pt[] = [
    [0, 3],
    ...quad([0, 3], [3, -8], [20, -8]).slice(1),
    [100, -8],
    ...quad([100, -8], [124, -8], [146, -3]).slice(1),
  ]
  const lower: Pt[] = [
    [146, -1],
    ...quad([146, -1], [122, 8], [100, 8]).slice(1),
    [26, 8],
    ...quad([26, 8], [4, 8], [0, 3]).slice(1),
  ]
  const fuselage = P([...upper, ...lower])
  // Tail fin and tailplane go behind the fuselage outline.
  const fin: Pt[] = [
    [108, -7.5],
    [128, -36],
    [140, -36],
    [145, -4],
  ]
  out.push(occlude(P(fin), { halo: 1.2 }), ...body(P(fin), 'line'))
  out.push(
    ...toneFill(
      P([
        [132, -35],
        [140, -35],
        [144, -5],
        [136, -6],
      ]),
      'T4',
      { inset: 0.3 },
    ),
  )
  const plane: Pt[] = [
    [122, 0],
    [143, -9],
    [146, -5],
    [130, 4],
  ]
  out.push(occlude(P(plane), { halo: 1.2 }), ...body(P(plane), 'hair'))
  out.push(occlude(fuselage, { halo: 1.2 }), ...body(fuselage, 'line'))
  // Shaded belly and the window band.
  out.push(
    ...toneFill(
      P([
        [22, 3.8],
        [112, 3.8],
        [124, 6.6],
        [100, 7.2],
        [26, 7.2],
      ]),
      'T4',
      { inset: 0.3 },
    ),
  )
  out.push(
    stroke(
      'hair',
      P([
        [10, 3.2],
        [118, 3.2],
      ]),
    ),
  )
  for (let wx = 24; wx < 100; wx += 6) out.push(fill(P(rectPts(wx, -3, 2.4, 2.4))))
  out.push(
    fill(
      P([
        [4, -2],
        [12, -6],
        [12, -1.5],
        [5, 0.5],
      ]),
    ),
  )
  return out
}

const wheel = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: 10 }, (_, i) => [
    cx + r * Math.cos((i / 10) * Math.PI * 2),
    cy + r * Math.sin((i / 10) * Math.PI * 2),
  ])
