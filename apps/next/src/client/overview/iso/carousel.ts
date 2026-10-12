import { NZ, X, Y, cylY, rrOn, shadowRect } from './solids'
import { Scene, roundRect, type IsoFigureData, type P3 } from './scene'

/** How far the next bag pushes out through the flaps on hover, in iso units along the belt. */
const PUSH = 26
const L = 236,
  D = 62,
  SLATS = 16,
  // Plate and flaps at the portal: the frame is 3 deep, the flap curtain hangs just in front of it.
  FRAME = 3,
  FRAME_TOP = 66,
  OPEN_TOP = 58,
  RAIL = { z0: 54.5, z1: 58 },
  FLAPS = 8,
  // Bags are one bag: same size, same strap, same handle. Their base clears the sloped slats, the front wheels touch them.
  BAG = { w: 58, d: 38, h: 22, y: 12, z: 27 }

/** The slat surface slopes toward the viewer: z at depth y. */
const zAt = (y: number) => 30 - (8 * y) / D

/** Airports: a baggage belt run coming out of a rubber-flap portal; three identical bags, the next one pushing through the flaps, and the tag on yours lit with the most-used airport's code. Parts: `incoming` (the bag still coming through, clipped at the portal face). Geometry never depends on `code`. Motion lives in `carousel.css`. */
export function carousel(k: number, { code }: { code: string }): IsoFigureData {
  const s = new Scene(k)
  const [pushX, pushY] = s.vector(PUSH, 0, 0)

  shadowRect(s, -10, -16, L + 10, D + 26, 2)
  portalWall(s)
  belt(s)
  portalFrame(s)

  // The incoming bag is drawn whole and clipped at the portal face (x >= 0), so what is still behind the curtain stays hidden. The hull's top edge sits on the bag's top plane, which is where the clip has to follow the face.
  const w = BAG.w,
    top = BAG.z + BAG.h
  const clip: P3[] = []
  for (const x of [0, w + PUSH + 6])
    for (const y of [BAG.y - 2, BAG.y + BAG.d])
      for (const z of [BAG.z - 7, top + 0.8]) clip.push([x, y, z])
  s.group('incoming', () => bag(s, 30 - w, false, code), {
    clip,
    vars: { '--push-x': `${pushX}px`, '--push-y': `${pushY}px` },
  })
  // Bounds cover the pushed position, so the moving bag never leaves the figure's box.
  s.include([
    [30 - w + w + PUSH, BAG.y, BAG.z],
    [30 + PUSH, BAG.y + BAG.d + 4, top],
  ])
  bag(s, 84, true, code)
  bag(s, 166, false, code)

  flaps(s)
  return s.done(4)
}

/** The wall the portal is cut in, behind everything else. */
function portalWall(s: Scene) {
  s.box(-10, -16, 0, 10, D + 26, 70)
  // Cladding seams: a rail line along the top, and one upright panel joint above the island. Both run edge to edge.
  s.line(
    [
      [0, -16, 63],
      [0, D + 10, 63],
    ],
    'detail',
    0.8,
  )
  s.line(
    [
      [0, -10, 20],
      [0, -10, 70],
    ],
    'detail',
    0.8,
  )
  s.line(
    [
      [0, D + 5, 63],
      [0, D + 5, 0],
    ],
    'detail',
    0.8,
  )
}

/** Straight run of belt along x: island behind, sloped overlapping slats, steel kerb in front. */
function belt(s: Scene) {
  // Island: its top, the strip of its front above the slats, and its end face.
  s.box(0, -16, 0, L, 16, 36)
  // Panel seams on the strip above the slats: upright joints at even pitch, from the slat line to the top edge.
  for (let i = 1; i < 4; i++)
    s.line(
      [
        [(L / 4) * i, 0, 30],
        [(L / 4) * i, 0, 36],
      ],
      'detail',
      0.8,
    )
  // Island end face: a sunk panel, its seam and corner screws.
  const E = s.on([L, 0, 0], Y, [0, 0, 1]),
    ex = (u: number, v: number) => E(-u, v)
  s.poly(
    [ex(3, 5), ex(13, 5), ex(13, 31), ex(3, 31)].map(([a, b, c]) => [a, b, c] as P3),
    'none',
    'detail',
    undefined,
    0.8,
  )
  s.line([ex(8, 5), ex(8, 31)], 'detail', 0.8)
  s.line([ex(3, 18), ex(13, 18)], 'detail', 0.8)
  for (const [u, v] of [
    [5, 7],
    [11, 7],
    [5, 29],
    [11, 29],
  ])
    screw(s, ex(u, v), Y, [0, 0, 1])

  // End of the run: the belt body, closed by a cap plate that follows the slope.
  s.poly(
    [
      [L, 0, 0],
      [L, D, 0],
      [L, D, zAt(D)],
      [L, 0, zAt(0)],
    ],
    'side',
    'line',
  )
  const cap = (y: number, z: number): P3 => [L, y, z]
  s.poly(
    [cap(4, 4), cap(D - 4, 4), cap(D - 4, zAt(D - 4) - 4), cap(4, zAt(4) - 4)],
    'front',
    'detail',
    undefined,
    0.8,
  )
  for (const [y, z] of [
    [8, 8],
    [D - 8, 8],
    [8, zAt(8) - 8],
    [D - 8, zAt(D - 8) - 8],
  ])
    screw(s, cap(y, z), Y, [0, 0, 1])

  // Slats: sloped plates, each lapping over the next with a lip.
  const pitch = L / SLATS
  for (let i = 0; i < SLATS; i++) {
    const x0 = i * pitch,
      x1 = Math.min(L, x0 + pitch)
    s.poly(
      [
        [x0, 0, 30],
        [x1, 0, 30],
        [x1, D, 22],
        [x0, D, 22],
      ],
      'top',
      'detail',
    )
    if (i < SLATS - 1)
      s.poly(
        [
          [x1 - 1.5, 0, 30],
          [x1, 0, 31.4],
          [x1, D, 23.4],
          [x1 - 1.5, D, 22],
        ],
        'front',
        'line',
        undefined,
        0.6,
      )
  }
  // Edge trims along both sides of the slats.
  for (const [a, b] of [
    [0, 2.5],
    [D - 2.5, D],
  ])
    s.poly(
      [
        [0, a, zAt(a)],
        [L, a, zAt(a)],
        [L, b, zAt(b)],
        [0, b, zAt(b)],
      ],
      'side',
      'line',
      undefined,
      0.6,
    )

  // Steel kerb with its rubbing strip and bolts at an even pitch.
  s.box(0, D, 0, L, 5, 25)
  const fy = D + 5
  s.poly(
    [
      [3, fy, 15],
      [L - 3, fy, 15],
      [L - 3, fy, 10],
      [3, fy, 10],
    ],
    'detail',
    'line',
    undefined,
    0.8,
  )
  const bolts = 12
  for (let i = 0; i < bolts; i++) {
    const x = 3 + ((L - 6) / bolts) * (i + 0.5)
    screw(s, [x, fy, 12.5], X, [0, 0, 1], 1.1)
  }
  // The kerb's top edge bevel.
  s.line(
    [
      [0, D + 1.5, 25],
      [L, D + 1.5, 25],
    ],
    'detail',
    0.8,
  )
}

/** The portal frame over the belt's start: a plate with the opening cut out, corner bolts and a header plate with rules. */
function portalFrame(s: Scene) {
  const f = (y: number, z: number): P3 => [FRAME, y, z]
  // Face, top and the near jamb.
  s.poly([f(0, zAt(0)), f(D, zAt(D)), f(D, FRAME_TOP), f(0, FRAME_TOP)], 'side', 'line')
  s.poly(
    [
      [0, 0, FRAME_TOP],
      [FRAME, 0, FRAME_TOP],
      [FRAME, D, FRAME_TOP],
      [0, D, FRAME_TOP],
    ],
    'top',
    'line',
  )
  s.poly(
    [
      [0, D, zAt(D)],
      [FRAME, D, zAt(D)],
      [FRAME, D, FRAME_TOP],
      [0, D, FRAME_TOP],
    ],
    'front',
    'line',
  )
  // The opening, its floor the belt itself.
  s.poly([f(4, zAt(4)), f(D - 4, zAt(D - 4)), f(D - 4, OPEN_TOP), f(4, OPEN_TOP)], 'glass', 'line')
  // Corner bolts.
  for (const [y, z] of [
    [2, FRAME_TOP - 2],
    [D - 2, FRAME_TOP - 2],
    [2, zAt(2) + 4],
    [D - 2, zAt(D - 2) + 4],
  ])
    screw(s, f(y, z), Y, [0, 0, 1])
  // Header plate: a sunk label plate with two rules, edge to edge.
  s.poly(
    [f(7, 59.5), f(D - 7, 59.5), f(D - 7, 64.5), f(7, 64.5)],
    'front',
    'detail',
    undefined,
    0.8,
  )
  for (const z of [61.2, 62.8]) s.line([f(7, z), f(D - 7, z)], 'detail', 0.7)
}

/** Rubber flap curtain: eight strips on a rail. The ones over the bag bulge out and end on its top; the outer two hang to the belt. */
function flaps(s: Scene) {
  // Rail the strips hang from.
  s.box(FRAME, 4, RAIL.z0, 1.4, D - 8, RAIL.z1 - RAIL.z0)
  const fw = BAG.d / 6,
    y0 = BAG.y - fw,
    bagTop = BAG.z + BAG.h,
    bulge = 8,
    gap = 0.6,
    zTop = 56
  for (let i = 0; i < FLAPS; i++) {
    const ya = y0 + i * fw + gap,
      yb = y0 + (i + 1) * fw - gap,
      over = i >= 1 && i <= 6,
      fx = FRAME + 1.4 + 0.2,
      xb = over ? fx + bulge : fx,
      za = over ? bagTop + 0.4 : zAt(ya) + 0.5,
      zb = over ? bagTop + 0.4 : zAt(yb) + 0.5
    // The visible edge of the strip, then its face.
    s.poly(
      [
        [fx, yb, zTop],
        [xb, yb, zb],
        [xb + 0.9, yb, zb],
        [fx + 0.9, yb, zTop],
      ],
      'front',
      'line',
      undefined,
      0.6,
    )
    s.poly(
      [
        [fx, ya, zTop],
        [fx, yb, zTop],
        [xb, yb, zb],
        [xb, ya, za],
      ],
      'detail',
      'line',
      undefined,
      0.7,
    )
    // A crease across the strip, edge to edge.
    const t = 0.5
    s.line(
      [
        [fx + (xb - fx) * t, ya, zTop + (za - zTop) * t],
        [fx + (xb - fx) * t, yb, zTop + (zb - zTop) * t],
      ],
      'line',
      0.5,
    )
    // Rivet where it meets the rail.
    s.poly(s.circle([fx, 0, 0], Y, [0, 0, 1], (ya + yb) / 2, zTop - 1.2, 0.8, 8), 'line', 'none')
  }
}

/** A small screw head on a plane: a `detail` disc in a `line` ring. */
function screw(s: Scene, c: P3, U: P3, V: P3, r = 1.4) {
  s.poly(s.circle(c, U, V, 0, 0, r, 10), 'detail', 'line', undefined, 0.6)
}

/** A suitcase lying on the belt, front toward the viewer: shell, zip line and pull, the strap over the top and down the front, a side handle in front, wheels. Yours also carries the lit tag. */
function bag(s: Scene, x: number, tagged: boolean, code: string) {
  const { w, d, h, y, z } = BAG,
    zt = z + h
  s.rbox(x, y, z, w, d, h, 6)
  // Zip line round the lid, its pull at the front-left corner.
  s.poly(
    roundRect(x + 5, y + 5, w - 10, d - 10, 4).map(([a, c]) => [a, c, zt] as P3),
    'none',
    'detail',
    undefined,
    0.8,
  )
  s.box(x + 12, y + d - 8, zt, 5, 3, 0.8, { top: 'front', front: 'front', side: 'side' })
  // Strap over the top and down the front, with its buckle.
  const xs = x + w * 0.66
  s.poly(
    [
      [xs, y, zt],
      [xs + 6, y, zt],
      [xs + 6, y + d, zt],
      [xs, y + d, zt],
    ],
    'ghost',
    'line',
    undefined,
    0.7,
  )
  s.poly(
    [
      [xs, y + d, zt],
      [xs + 6, y + d, zt],
      [xs + 6, y + d, z + 2],
      [xs, y + d, z + 2],
    ],
    'ghost',
    'line',
    undefined,
    0.7,
  )
  s.box(xs - 1, y + d / 2 - 3, zt, 8, 6, 0.8, { top: 'front', front: 'front', side: 'side' })
  s.line(
    [
      [xs + 3, y + d / 2 - 3, zt + 0.8],
      [xs + 3, y + d / 2 + 3, zt + 0.8],
    ],
    'line',
    0.6,
  )
  // Side handle on the front face: a grip with its slot.
  const xc = x + w * 0.3,
    hz = z + h * 0.45
  s.box(xc - 10, y + d, hz, 20, 3, 5)
  const Fh = y + d + 3
  s.poly(
    rrOn(s, [0, Fh, 0], X, NZ, xc - 7, -(hz + 3.8), 14, 2.6, 1.2),
    'glass',
    'line',
    undefined,
    0.7,
  )
  // Front wheels, standing on the belt.
  for (const cx of [x + 9, x + w - 9]) {
    cylY(s, cx, y + d - 3.5, z - 0.8, 2.6, 4.5, { face: 'front', body: 'side' }, 14)
    s.poly(
      s.circle([cx, y + d + 1, z - 0.8], X, NZ, 0, 0, 0.9, 8),
      'detail',
      'line',
      undefined,
      0.5,
    )
  }
  if (tagged) tag(s, x, code)
}

/** The tag on yours: a lit plate on a loop from the handle, with the airport code, a rule and a barcode. */
function tag(s: Scene, x: number, code: string) {
  const { w, d, h, y, z } = BAG,
    xc = x + w * 0.3,
    Fy = y + d + 3.5,
    at = s.on([0, Fy, 0], X, NZ),
    tx = xc + 13,
    tw = 19,
    th = h - 4,
    ztop = z + h - 2,
    zb = ztop - th
  const T = rrOn(s, [0, Fy, 0], X, NZ, tx, -ztop, tw, th, 2)
  // Loop from the handle's top edge to the punched hole.
  s.line(
    [
      [xc + 6, Fy, z + h * 0.45 + 5],
      [tx + 3.5, Fy, ztop - 2.5],
    ],
    'line',
    0.8,
  )
  s.glow(5, () => s.poly(T, 'accent', 'none'))
  s.poly(T, 'accent', 'accent')
  s.poly(s.circle([0, Fy, 0], X, NZ, tx + 3.5, -(ztop - 2.5), 1.2, 10), 'on-accent', 'none')
  s.text(code, at(tx + tw / 2 + 1.5, -(zb + th * 0.55)), X, NZ, {
    size: 6,
    fill: 'on-accent',
    weight: 700,
    mono: true,
    anchor: 'middle',
  })
  // Rule across the tag, and bars hanging from it down to the bottom edge.
  const rz = zb + 7
  s.line([at(tx, -rz), at(tx + tw, -rz)], 'on-accent', 0.6)
  const bars: P3[][] = []
  for (let i = 0; i < 7; i++) bars.push([at(tx + 3 + i * 2.2, -rz), at(tx + 3 + i * 2.2, -zb)])
  s.segs(bars, 'on-accent', 0.8)
}
