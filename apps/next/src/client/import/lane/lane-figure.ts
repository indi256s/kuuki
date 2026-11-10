// The import screen's figure: an airport security lane whose trays stand where their sources are (lane-model.ts).
// The lane runs away from the viewer (u grows along -y), so the tunnel's entrance, with its flaps, is the face in view.
import { X, Y, cylZ, rrOn, shadowRect } from '../../overview/iso/solids'
import { Scene, fitBox, hull, type IsoFigureData, type P3 } from '../../overview/iso/scene'
import type { LaneModel, LaneSlot, LaneTray } from './lane-model'

const Z: P3 = [0, 0, 1]
/** Roller tops, where a tray rides. */
const TOP = 16
const BED = { z: 11, h: 2.5 }
const RAIL_TOP = 17.5
const LANE_W = 28
const TRAY = { w: 22, l: 24, h: 5, wall: 1.4, floor: 1.2 }
const ENTRY = { u0: 30, u1: 176 }
const EXIT = { u0: 236, u1: 306 }
const BODY = { v: -3, w: 34, u: ENTRY.u1, l: EXIT.u0 - ENTRY.u1, h: 44 }
const OPENING = { v0: 1, v1: 27, z0: 13, z1: 30 }
/** The flap curtain hangs under the hood, just in front of the entrance face. */
const FLAP_U = BODY.u - 2
const FLAP_LIFT = 11
const SIDE = { v0: 29.5, v1: 62, u0: 240, u1: 266 }
const TABLE = { v: -46, u: 96, w: 30, l: 44, z: 14.5 }
const CART_Z = 5
const NEST = 2
const GANTRY_U = 159
const MONITOR = { v: 32.5, u: 220, z: 30, w: 19, h: 15 }
/** Where a tray is drawn; every other place is this one moved by a CSS transform, so the element survives a rebuild and its transition runs. */
const MOUTH = { v: 3, u: 44, z: TOP }
const QUEUE_PITCH = TRAY.l + 2

function slotAt(tray: Pick<LaneTray, 'slot' | 'index' | 'rejected'>) {
  const lane = (u: number) => ({ v: MOUTH.v, u, z: TOP })
  const at: Record<LaneSlot, { v: number; u: number; z: number }> = {
    mouth: lane(tray.rejected === 'size' ? MOUTH.u - 11 : MOUTH.u),
    queue: lane(122 - tray.index * QUEUE_PITCH),
    frame: lane(148),
    tunnel: lane(190),
    exit: lane(276),
    side: { v: 36, u: SIDE.u0 + 1, z: TOP },
    // Two trays always rest on the cart; returned ones nest on top of them.
    stack: { v: MOUTH.v, u: 0, z: CART_Z + NEST * (2 + tray.index) },
    table: { v: TABLE.v + 4, u: TABLE.u + 8, z: TABLE.z + 1.5 },
  }
  return at[tray.slot]
}

/** Every place a tray can stand, for the bounds: the viewBox must not depend on the model. */
const REACH: Pick<LaneTray, 'slot' | 'index' | 'rejected'>[] = [
  { slot: 'mouth', index: 0, rejected: 'size' },
  { slot: 'exit', index: 0, rejected: null },
  { slot: 'side', index: 0, rejected: null },
  { slot: 'stack', index: 3, rejected: null },
  { slot: 'table', index: 0, rejected: null },
]

const REST: LaneModel = {
  trays: [],
  monitor: false,
  rollers: false,
  flaps: false,
  size: 'hero',
}
const scales = new Map<string, number>()

/** The lane at the scale that fits `box`, with a tray per `model.trays`. Parts: `tray:<id>` (and its twin `front:<id>` in front of the tunnel), `rollers`, `flaps`, `lit` (the monitor screen, only during online recognition). Motion lives in `security-lane.css`. */
export function buildLane(box: { w: number; h: number }, model: LaneModel): IsoFigureData {
  const key = `${box.w}x${box.h}`
  let k = scales.get(key)
  if (!k) scales.set(key, (k = fitBox(box.w, box.h, (scale) => draw(scale, REST))))
  return draw(k, model)
}

function draw(k: number, model: LaneModel): IsoFigureData {
  const s = new Scene(k)
  // Screws, louvres and print are under a pixel on the band: they would only grey its faces.
  const fine = k >= 0.75

  s.group('base', () => {
    shadowRect(s, BODY.v, -EXIT.u1, BODY.w, EXIT.u1 + 2, 3)
    shadowRect(s, TABLE.v, -(TABLE.u + TABLE.l), TABLE.w, TABLE.l, 2)
    shadowRect(s, SIDE.v0, -SIDE.u1, SIDE.v1 - SIDE.v0, SIDE.u1 - SIDE.u0, 2)
    inspectionTable(s, fine)
    lbox(s, -4.5, GANTRY_U, 0, 2, 3, 36)
    laneTable(s, ENTRY.u0, ENTRY.u1, fine)
    laneTable(s, EXIT.u0, EXIT.u1, fine)
    sideLine(s, fine)
    cart(s)
  })

  const trays = (part: string) => () => {
    for (const tray of model.trays) {
      const to = slotAt(tray)
      const [x, y] = s.vector(to.v - MOUTH.v, MOUTH.u - to.u, to.z - MOUTH.z)
      s.group(
        `${part}:${tray.id}`,
        () => {
          if (tray.rejected !== 'type') return drawTray(s, MOUTH, tray)
          // The one joke in motion: a file of the wrong type runs up to the flaps and comes back.
          const [bx, by] = s.vector(0, MOUTH.u + TRAY.l + 1 - FLAP_U, 0)
          s.group('bump', () => drawTray(s, MOUTH, tray), {
            vars: { '--bump-x': `${bx}px`, '--bump-y': `${by}px` },
          })
        },
        { vars: { '--tray-x': `${x}px`, '--tray-y': `${y}px` } },
      )
    }
  }
  // A tray past the tunnel stands behind it and one before it stands in front, yet an element that changes layers loses its transition.
  // So each tray is drawn twice with one transform: this copy under the tunnel, and a twin over it that shows only in front of the entrance.
  s.group('trays', trays('tray'))
  for (const place of REACH) {
    const { v, u, z } = slotAt(place)
    s.include([
      [v - 1, -(u - 1), z],
      [v + TRAY.w + 1, -(u + TRAY.l + 10), z + 14],
    ])
  }

  s.group('tunnel', () => tunnel(s, fine))

  // The twin is cut by what the entrance lets you see: the opening at the flap line, widening toward the viewer.
  const seen: P3[] = []
  for (const v of [OPENING.v0 - 0.5, OPENING.v1 + 0.5])
    for (const z of [OPENING.z0 + 2, OPENING.z1]) seen.push([v, -FLAP_U, z])
  for (const v of [-3, LANE_W + 3]) for (const z of [2, 40]) seen.push([v, 8, z])
  s.group('front', trays('front'), { clip: seen })

  const [fx, fy] = s.vector(0, 0, FLAP_LIFT)
  const curtain: P3[] = []
  for (const v of [OPENING.v0 - 0.5, OPENING.v1 + 0.5])
    for (const z of [OPENING.z0 + 2.5, OPENING.z1]) curtain.push([v, -FLAP_U, z])
  s.group('flaps', () => flaps(s), {
    clip: curtain,
    vars: { '--flap-x': `${fx}px`, '--flap-y': `${fy}px` },
  })

  s.group('gantry', () => gantry(s, fine))
  s.group('monitor', () => monitor(s, model.monitor, fine))
  // The screen's glow reaches past the drawing only while it is lit: reserve its room always.
  const { v, u, z, w, h } = MONITOR
  s.include([
    [v - 12, -u, z + h + 16],
    [v + w + 12, -u, z - 16],
  ])
  return s.done(3)
}

/** A box given along the lane: across (v), along (u), up. Its near faces are the +v side and the low-u end. */
function lbox(
  s: Scene,
  v: number,
  u: number,
  z: number,
  w: number,
  l: number,
  h: number,
  f: Parameters<Scene['box']>[6] = {},
) {
  s.box(v, -(u + l), z, w, l, h, f)
}

function dot(s: Scene, c: P3, U: P3, V: P3, r = 0.7) {
  s.poly(s.circle(c, U, V, 0, 0, r, 8), 'detail', 'line', undefined, 0.5)
}

/** Rollers across the lane, as one part: running, they travel one pitch and repeat, and the bed's outline hides the ends. */
function rollers(s: Scene, u0: number, u1: number, pitch: number, r: number) {
  for (let u = u1 - pitch / 2; u > u0 - pitch; u -= pitch) {
    const ring = (x: number) => s.circle([x, -u, TOP - r], Y, Z, 0, 0, r, 8)
    s.poly2(hull(s.pp([...ring(0.6), ...ring(LANE_W - 0.6)])), 'top', 'line', 0.6)
  }
}

/** A run of roller table: legs, the bed, a rail each side and the rollers between them. */
function laneTable(s: Scene, u0: number, u1: number, fine: boolean) {
  const pitch = fine ? 4 : 6,
    r = fine ? 1.25 : 1.6
  for (let u = u0 + 6; u < u1 - 4; u += 44)
    for (const v of [0.5, LANE_W - 2.5]) lbox(s, v, u, 0, 2, 2, BED.z)
  lbox(s, 0, u0, BED.z, LANE_W, u1 - u0, BED.h, { top: 'side' })
  lbox(s, -1.5, u0, BED.z, 1.5, u1 - u0, RAIL_TOP - BED.z)
  const bed: P3[] = []
  for (const u of [u0, u1])
    for (const v of [0, LANE_W]) for (const z of [BED.z + BED.h, TOP + 0.4]) bed.push([v, -u, z])
  const [x, y] = s.vector(0, -pitch, 0)
  s.group('rollers', () => rollers(s, u0, u1, pitch, r), {
    clip: bed,
    vars: { '--roll-x': `${x}px`, '--roll-y': `${y}px` },
  })
  // The near rail stops where the side line leaves the lane.
  const runs: [number, number][] =
    u0 === EXIT.u0
      ? [
          [u0, SIDE.u0 - 1.5],
          [SIDE.u1 + 1.5, u1],
        ]
      : [[u0, u1]]
  for (const [a, b] of runs) {
    lbox(s, LANE_W, a, BED.z, 1.5, b - a, RAIL_TOP - BED.z)
    const face = s.on([LANE_W + 1.5, 0, 0], [0, -1, 0], Z)
    s.line([face(a + 1.5, BED.z + 2), face(b - 1.5, BED.z + 2)], 'detail', 0.7)
    if (fine)
      for (let u = a + 5; u < b - 2; u += 12) dot(s, face(u, BED.z + 4.4), [0, -1, 0], Z, 0.6)
  }
  // The end stop of the exit run.
  if (u0 === EXIT.u0) lbox(s, -1.5, u1, BED.z, LANE_W + 3, 1.5, RAIL_TOP - BED.z + 2)
}

/** The side line: a short roller branch from the exit toward the viewer, closed by a stop. */
function sideLine(s: Scene, fine: boolean) {
  const { v0, v1, u0, u1 } = SIDE,
    r = fine ? 1.25 : 1.6
  for (const u of [u0 + 1, u1 - 3]) lbox(s, v1 - 4, u, 0, 2, 2, BED.z)
  lbox(s, v0, u0, BED.z, v1 - v0, u1 - u0, BED.h, { top: 'side' })
  lbox(s, v0, u1, BED.z, v1 - v0, 1.5, RAIL_TOP - BED.z)
  for (let v = v0 + 2.5; v < v1 - 1; v += fine ? 4 : 6) {
    const ring = (u: number) => s.circle([v, -u, TOP - r], X, Z, 0, 0, r, 8)
    s.poly2(hull(s.pp([...ring(u0 + 0.6), ...ring(u1 - 0.6)])), 'top', 'line', 0.6)
  }
  lbox(s, v0, u0 - 1.5, BED.z, v1 - v0, 1.5, RAIL_TOP - BED.z)
  const face = s.on([0, -(u0 - 1.5), 0], X, Z)
  s.line([face(v0 + 1.5, BED.z + 2), face(v1 - 1.5, BED.z + 2)], 'detail', 0.7)
  lbox(s, v1, u0 - 1.5, BED.z, 1.5, u1 - u0 + 3, RAIL_TOP - BED.z + 2)
}

/** The manual inspection table behind the lane, with a hand scanner lying on it. */
function inspectionTable(s: Scene, fine: boolean) {
  const { v, u, w, l, z } = TABLE
  for (const [a, b] of [
    [v + 1, u + l - 3],
    [v + 1, u + 1],
    [v + w - 3, u + l - 3],
    [v + w - 3, u + 1],
  ])
    lbox(s, a, b, 0, 2, 2, z)
  // A stretcher between the near legs, then the top.
  lbox(s, v + w - 2.6, u + 3, 4, 1.2, l - 6, 1.2)
  lbox(s, v, u, z, w, l, 1.5)
  const top = z + 1.5
  if (fine)
    s.poly(
      rrOn(s, [0, 0, top], X, Y, v + 3, -(u + 33), w - 6, 26, 1.5),
      'none',
      'detail',
      undefined,
      0.7,
    )
  lbox(s, v + 6, u + 37, top, 15, 3.4, 1.6, { top: 'front' })
  lbox(s, v + 21, u + 36.2, top, 5, 5, 2.2)
  if (fine) dot(s, [v + 23.5, -(u + 38.7), top + 2.2], X, Y, 1.2)
}

/** The tray return: a low cart on casters with two trays always nested on it. */
function cart(s: Scene) {
  for (const [v, u] of [
    [2, 22],
    [2, 0],
    [24, 22],
    [24, 0],
  ])
    lbox(s, v, u, 0, 2, 2, 3)
  lbox(s, 1, -1, 3, 26, 26, CART_Z - 3)
  lbox(s, MOUTH.v, 0, CART_Z, TRAY.w, TRAY.l, NEST)
  drawTray(s, { v: MOUTH.v, u: 0, z: CART_Z + NEST }, null)
}

/** A tray at `o`, its cavity drawn as the three faces the rim leaves in view, and what rides in it. A file that is too big also leaves its bottle behind the tray. */
function drawTray(
  s: Scene,
  o: { v: number; u: number; z: number },
  tray: Pick<LaneTray, 'cargo' | 'stubs' | 'rejected'> | null,
) {
  const { w, l, h, wall, floor } = TRAY
  const x0 = o.v,
    y0 = -(o.u + l),
    z = o.z
  if (tray?.rejected === 'size') bottle(s, x0 + w / 2, y0 - 5.5, z)
  s.box(x0, y0, z, w, l, h)
  const xi0 = x0 + wall,
    xi1 = x0 + w - wall,
    yi0 = y0 + wall,
    yi1 = y0 + l - wall,
    fz = z + floor,
    rim = z + h,
    c = h - floor
  s.poly(
    [
      [xi0, yi0, fz],
      [xi0, yi1 - c, fz],
      [xi0, yi1, rim],
      [xi0, yi0, rim],
    ],
    'side',
    'crease',
  )
  s.poly(
    [
      [xi0, yi0, fz],
      [xi1 - c, yi0, fz],
      [xi1, yi0, rim],
      [xi0, yi0, rim],
    ],
    'front',
    'crease',
  )
  s.poly(
    [
      [xi0, yi0, fz],
      [xi1 - c, yi0, fz],
      [xi1 - c, yi1 - c, fz],
      [xi0, yi1 - c, fz],
    ],
    'top',
    'crease',
  )
  // The hand hold in the near end.
  s.poly(
    rrOn(s, [0, y0 + l, 0], X, [0, 0, -1], x0 + w / 2 - 4, -(z + 3.9), 8, 1.7, 0.8),
    'glass',
    'line',
    undefined,
    0.6,
  )
  // Cargo stays on the part of the floor the near walls leave in view, so nothing has to be cut by the rim.
  if (!tray || tray.cargo === 'none') return
  if (tray.cargo === 'document') sheet(s, xi0 + 1.6, yi0 + 1.4, fz)
  if (tray.cargo === 'stubs')
    for (let i = 0; i < tray.stubs; i++)
      stub(s, xi0 + 0.8 + i * 2.2, yi0 + 0.8 + i * 1.2, fz + i * 0.6)
  if (tray.cargo === 'logbook') logbook(s, xi0 + 1, yi0 + 0.8, fz)
}

/** A printed sheet: a heading rule, text rules and a barcode along its near edge. */
function sheet(s: Scene, x: number, y: number, z: number) {
  const w = 11,
    d = 14,
    top = z + 0.6
  s.box(x, y, z, w, d, 0.6)
  s.line(
    [
      [x + 1.5, y + 2, top],
      [x + 6.5, y + 2, top],
    ],
    'line',
    0.8,
  )
  s.segs(
    [4.2, 6, 7.8].map((dy): P3[] => [
      [x + 1.5, y + dy, top],
      [x + w - 1.5, y + dy, top],
    ]),
    'detail',
    0.6,
  )
  s.segs(
    [0, 1.3, 2.6, 3.9, 5.2, 6.5].map((dx): P3[] => [
      [x + 2 + dx, y + 9.8, top],
      [x + 2 + dx, y + 12.4, top],
    ]),
    'line',
    0.7,
  )
}

/** A boarding-pass stub: a card with its tear line and a code rule. */
function stub(s: Scene, x: number, y: number, z: number) {
  const w = 7,
    d = 13,
    top = z + 0.5
  s.box(x, y, z, w, d, 0.5)
  s.line(
    [
      [x, y + 3.6, top],
      [x + w, y + 3.6, top],
    ],
    'detail',
    0.6,
    '1 1',
  )
  s.line(
    [
      [x + 1.4, y + 6.4, top],
      [x + w - 1.4, y + 6.4, top],
    ],
    'line',
    0.8,
  )
}

/** The Flighty logbook: a bound book standing proud of the tray, with its page block, label plate and elastic band. */
function logbook(s: Scene, x: number, y: number, z: number) {
  const w = 13,
    d = 16,
    h = 4.6,
    top = z + h
  s.box(x, y, z, w, d, h)
  // Page block between the covers, on both faces in view.
  for (const dz of [1, h - 1]) {
    s.line(
      [
        [x + w, y + 0.6, z + dz],
        [x + w, y + d, z + dz],
      ],
      'detail',
      0.6,
    )
    s.line(
      [
        [x + 1.2, y + d, z + dz],
        [x + w, y + d, z + dz],
      ],
      'detail',
      0.6,
    )
  }
  s.line(
    [
      [x + 1.2, y, top],
      [x + 1.2, y + d, top],
    ],
    'detail',
    0.7,
  )
  s.poly(
    rrOn(s, [0, 0, top], X, Y, x + 3.4, y + 2.4, 6.4, 4.4, 0.8),
    'front',
    'detail',
    undefined,
    0.6,
  )
  // The band over the cover and down the near end.
  s.poly(
    [
      [x + w - 2.6, y, top],
      [x + w - 1.2, y, top],
      [x + w - 1.2, y + d, top],
      [x + w - 2.6, y + d, top],
    ],
    'ghost',
    'line',
    undefined,
    0.6,
  )
  s.poly(
    [
      [x + w - 2.6, y + d, top],
      [x + w - 1.2, y + d, top],
      [x + w - 1.2, y + d, z],
      [x + w - 2.6, y + d, z],
    ],
    'ghost',
    'line',
    undefined,
    0.6,
  )
}

/** The bottle that stays behind: body, label band, shoulder and cap. */
function bottle(s: Scene, cx: number, cy: number, z: number) {
  cylZ(s, cx, cy, z, 2.8, 8, {}, 14)
  for (const dz of [2.4, 5.6])
    s.line(
      // The half of the band that faces the viewer.
      Array.from({ length: 9 }, (_, i): P3 => {
        const a = ((i * 22.5 - 45) * Math.PI) / 180
        return [cx + 2.8 * Math.cos(a), cy + 2.8 * Math.sin(a), z + dz]
      }),
      'detail',
      0.6,
    )
  cylZ(s, cx, cy, z + 8, 1.3, 2.4, {}, 10)
  cylZ(s, cx, cy, z + 10.4, 1.7, 1.3, { top: 'front', body: 'side' }, 10)
}

/** The X-ray tunnel: its housing with the entrance cut in the near end, a hood over the entrance, service panels on the long side and a beacon on top. */
function tunnel(s: Scene, fine: boolean) {
  const { v, w, u, l, h } = BODY,
    v1 = v + w
  lbox(s, v, u, 0, w, l, h)
  const end = s.on([0, -u, 0], X, Z),
    side = s.on([v1, 0, 0], [0, -1, 0], Z)
  // Plinth line round both faces in view.
  s.line([end(v, 4), end(v1, 4), side(u + l, 4)], 'detail', 0.7)
  // The entrance, with the lane's bed running in.
  const { v0, v1: o1, z0, z1 } = OPENING
  s.poly([end(v0, z0), end(o1, z0), end(o1, z1), end(v0, z1)], 'shade', 'line')
  s.poly([end(v0, z0), end(o1, z0), end(o1, TOP), end(v0, TOP)], 'side', 'line', undefined, 0.6)
  // Header plate with two rules.
  s.poly(
    rrOn(s, [0, -u, 0], X, [0, 0, -1], v + 6, -41, w - 12, 5.5, 1),
    'front',
    'detail',
    undefined,
    0.7,
  )
  for (const z of [37.4, 39.2]) s.line([end(v + 8, z), end(v1 - 8, z)], 'detail', 0.6)
  if (fine)
    for (const [a, z] of [
      [v + 2, 41.5],
      [v1 - 2, 41.5],
      [v + 2, 7],
      [v1 - 2, 7],
    ])
      dot(s, end(a, z), X, Z)

  // Long side: panel joints, a service door with its handle, louvres, and the stop button on its plate.
  for (const a of [u + 20, u + 40]) s.line([side(a, 4), side(a, h)], 'detail', 0.7)
  s.poly(
    [side(u + 22.5, 8), side(u + 37.5, 8), side(u + 37.5, 27), side(u + 22.5, 27)],
    'none',
    'detail',
    undefined,
    0.7,
  )
  lbox(s, v1, u + 24, 16, 0.8, 1.6, 5)
  if (fine) {
    s.segs(
      [9, 11.5, 14, 16.5].map((z) => [side(u + 44, z), side(u + 56, z)]),
      'detail',
      0.7,
    )
    for (const [a, z] of [
      [u + 2, h - 2],
      [u + l - 2, h - 2],
    ])
      dot(s, side(a, z), [0, -1, 0], Z)
  }
  s.poly(
    rrOn(s, [v1, 0, 0], [0, -1, 0], [0, 0, -1], u + 5.5, -35, 9, 9, 1.5),
    'front',
    'detail',
    undefined,
    0.7,
  )
  dot(s, side(u + 10, 30.5), [0, -1, 0], Z, 2.4)

  // Top: panel joints across, and the beacon on its collar.
  for (const a of [u + 20, u + 40])
    s.line(
      [
        [v, -a, h],
        [v1, -a, h],
      ],
      'detail',
      0.7,
    )
  cylZ(s, v + 6, -(u + 8), h, 2.6, 1, { top: 'front', body: 'side' }, 12)
  cylZ(s, v + 6, -(u + 8), h + 1, 1.8, 3.2, { top: 'top', body: 'detail' }, 12)

  // The hood the flap curtain hangs from.
  lbox(s, OPENING.v0 - 2, u - 4, OPENING.z1, OPENING.v1 - OPENING.v0 + 4, 4, 2.5)
}

/** Lead-rubber strips across the entrance, each with its rivet and a hem crease. */
function flaps(s: Scene) {
  const n = 7,
    { v0, v1, z0, z1 } = OPENING,
    pitch = (v1 - v0) / n,
    at = s.on([0, -FLAP_U, 0], X, Z),
    foot = z0 + 3.5
  for (let i = 0; i < n; i++) {
    const a = v0 + i * pitch + 0.3,
      b = v0 + (i + 1) * pitch - 0.3
    s.poly([at(a, foot), at(b, foot), at(b, z1), at(a, z1)], 'detail', 'line', undefined, 0.6)
    s.line([at(a, foot + 2.2), at(b, foot + 2.2)], 'line', 0.5)
    s.poly(s.circle(at((a + b) / 2, z1 - 1.4), X, Z, 0, 0, 0.6, 8), 'line', 'none')
  }
}

/** The barcode frame's near side: the bar over the lane, the reader under it and the near post. */
function gantry(s: Scene, fine: boolean) {
  lbox(s, -4.5, GANTRY_U, 34, 36, 3, 2.5)
  lbox(s, 9, GANTRY_U - 0.5, 30.4, 10, 4, 3.6)
  s.poly(
    rrOn(s, [0, -(GANTRY_U - 0.5), 0], X, [0, 0, -1], 10.5, -33, 7, 1.7, 0.8),
    'glass',
    'line',
    undefined,
    0.6,
  )
  lbox(s, 29.5, GANTRY_U, 0, 2, 3, 34)
  lbox(s, 28.5, GANTRY_U - 1, 0, 4, 5, 1.2)
  if (fine) dot(s, [31.5, -(GANTRY_U + 1.5), 27], [0, -1, 0], Z)
}

/** The operator's monitor on its post, with a keyboard shelf. Its screen is the figure's one live part: accent with a glow while a document is read online, a ghost otherwise. */
function monitor(s: Scene, lit: boolean, fine: boolean) {
  const { v, u, z, w, h } = MONITOR
  lbox(s, v + 4.5, u - 3, 0, 10, 10, 1.2)
  lbox(s, v + 8.5, u + 1, 1.2, 2, 2, z - 1.2)
  lbox(s, v + 1.5, u - 5, z - 8, 16, 6, 1)
  if (fine)
    s.segs(
      [1.6, 3, 4.4].map((d): P3[] => [
        [v + 3, -(u - 5 + d), z - 7],
        [v + 16, -(u - 5 + d), z - 7],
      ]),
      'detail',
      0.6,
    )
  lbox(s, v, u, z, w, 3, h)
  const at = s.on([0, -u, 0], X, Z)
  const screen = rrOn(s, [0, -u, 0], X, [0, 0, -1], v + 1.5, -(z + h - 1.5), w - 3, h - 4.5, 1)
  // What the operator sees: a tray with a document in it.
  const picture = () => {
    const ink = lit ? 'on-accent' : 'detail'
    s.poly(
      rrOn(s, [0, -u, 0], X, [0, 0, -1], v + 4, -(z + h - 3.6), w - 8, 6.4, 1.2),
      'none',
      ink,
      undefined,
      0.8,
    )
    s.poly(
      [at(v + 6.5, z + 6.6), at(v + 11, z + 6.6), at(v + 11, z + 9.8), at(v + 6.5, z + 9.8)],
      'none',
      ink,
      undefined,
      0.7,
    )
    s.segs(
      [7.4, 9].map((dz) => [at(v + 12.2, z + dz), at(v + 13.6, z + dz)]),
      ink,
      0.7,
    )
  }
  if (lit)
    s.group('lit', () => {
      s.glow(3, () => s.poly(screen, 'accent', 'none'))
      s.poly(screen, 'accent', 'accent')
      picture()
    })
  else {
    s.poly(screen, 'ghost', 'line', undefined, 0.7)
    picture()
  }
  for (const a of [v + w - 3, v + w - 5]) dot(s, at(a, z + 1.5), X, Z, 0.5)
}
