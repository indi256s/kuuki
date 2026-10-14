import { Scene, roundRect, visibleRun, type P3 } from './scene'

/** How far the blade pays out on hover, in iso units along the blade. */
const TAPE_PAY = 20
const SLOT_X = 46,
  BZ = 2.6,
  // The blade paid out at its longest (the top of the scale) and shortest (the bottom, still room for the tag), in iso units along the blade.
  BLADE = 146,
  BLADE_MIN = 44,
  // The blade's reach is log-scaled between these distances: a thousand km is a stub, a million km (past the Moon and back) is the full blade.
  KM_MIN = 1_000,
  KM_MAX = 1_000_000,
  // The lip the blade comes out of, in iso units along the blade.
  LIP = 2.4,
  // The blade continues inside the case by one major tick so ticks keep their phase as it pays out; the slot clip hides that part.
  HIDDEN = 25,
  // The case: an x–z profile extruded along y round the blade's width (y 10–30). The mouth corner is square so the slot sits on flat wall.
  CASE = { x: -2, y: 8, d: 24, h: 54 },
  TAG_H = 20

/** Blade length for a distance: log-scaled between `KM_MIN` and `KM_MAX`, clamped. */
export const bladeLength = (km: number) => {
  const t =
    (Math.log10(Math.max(km, 1)) - Math.log10(KM_MIN)) / (Math.log10(KM_MAX) - Math.log10(KM_MIN))
  return BLADE_MIN + (BLADE - BLADE_MIN) * Math.min(1, Math.max(0, t))
}

/**
 * Over time: a tape measure whose lit blade is the distance flown (`km`, log-scaled, so the blade is longer the farther you have flown).
 * The reading itself is the HTML head's; at section size the tag on the blade carries only `label`, the unit, so the number is never said twice.
 * The figure's box always holds the full-length blade, so the case stays put whatever the distance.
 * Parts: `case`, `blade` (clipped at the lip) and `blade-end` (tag and hook).
 */
export function tape(label: string, k = 1, km = KM_MAX) {
  const s = new Scene(k)
  const x1 = SLOT_X + bladeLength(km)
  const [payX, payY] = s.vector(TAPE_PAY, 0, 0)
  const pay = { '--pay-x': `${payX}px`, '--pay-y': `${payY}px` }

  const { x, y, d, h } = CASE
  const profile = roundRect(x, 0, SLOT_X - x, h, [0, 12, 20, 12])
  /** A point on the case's near face (y = 32), at x and height z. */
  const face = (px: number, z: number): P3 => [px, y + d, z]
  const onFace = (pts: readonly (readonly [number, number])[]) => pts.map(([px, z]) => face(px, z))
  s.group('case', () => {
    // Belt clip: a spring plate on the back wall, whose folded top shows above the case behind it.
    s.box(6, y - 3.6, 8, 30, 3.6, h - 8 + 1.6, { top: 'detail', front: 'side', side: 'side' })
    s.prism(profile, y, d)
    // Seam where the two shells meet: the profile outline halfway through the case, so it wraps the corners; only the facets the viewer sees.
    s.line(
      visibleRun(profile).map(([a, b]): P3 => [a, y + d / 2, b]),
      'crease',
      0.9,
    )
    // Thumb lock: a ridged slider in a track on the top, its front flush with where the front edge starts to round.
    s.poly(
      [
        [SLOT_X - 27, 14.5, h],
        [SLOT_X - 12, 14.5, h],
        [SLOT_X - 12, 25.5, h],
        [SLOT_X - 27, 25.5, h],
      ],
      'shade',
      'crease',
    )
    s.box(SLOT_X - 24, 16, h, 12, 8, 2.5)
    s.segs(
      [0, 1, 2, 3, 4].map((i) => [
        [SLOT_X - 22.5 + i * 2.4, 17, h + 2.5],
        [SLOT_X - 22.5 + i * 2.4, 23, h + 2.5],
      ]),
      'crease',
      0.7,
    )
    // Rubber grips on the near face, each with closed slots (stadiums, no open ends).
    for (const [gx, gz, gw, gh, slots, sx, sw] of [
      [34.5, 7, 9.5, 34, [14, 21, 28, 35], 36.5, 5.5],
      [1.5, 9, 7.5, 20, [13, 19, 25], 3.2, 4.1],
    ] as const) {
      s.poly(onFace(roundRect(gx, gz, gw, gh, 2, 3)), 'side', 'crease')
      for (const z of slots) s.poly(onFace(roundRect(sx, z, sw, 1.6, 0.8, 3)), 'shade', 'crease')
    }
    // Case screws at the corners of the near face.
    for (const [sx, sz] of [
      [12, 47],
      [40, 47],
      [4.5, 4.5],
      [41, 3.5],
    ]) {
      s.poly(onFace(roundRect(sx - 1.2, sz - 1.2, 2.4, 2.4, 1.2, 4)), 'detail', 'crease')
      s.segs([[face(sx - 0.7, sz + 0.3), face(sx + 0.7, sz - 0.3)]], 'crease', 0.6)
    }
    // Neutral screw at the coil's centre.
    const F: P3 = [0, y + d, h],
      U: P3 = [1, 0, 0],
      V: P3 = [0, 0, -1]
    const hub: [number, number] = [(x + SLOT_X) / 2, h / 2]
    s.poly(s.circle(F, U, V, ...hub, 8), 'side', 'line')
    s.poly(s.circle(F, U, V, ...hub, 2, 12), 'detail', 'none')
    // Label plate under the hub with its printed rules and a short scale.
    s.poly(onFace(roundRect(12, 5, 20, 9, 1.5, 3)), 'top', 'crease')
    s.segs(
      [
        [face(14, 11.5), face(30, 11.5)],
        [face(14, 9.5), face(24, 9.5)],
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [
          face(14 + i * 2, 7.2),
          face(14 + i * 2, i % 4 === 0 ? 5.8 : 6.4),
        ]),
      ],
      'muted',
      0.6,
    )
    // The mouth: a lip the blade (z 1.2–2.6, y 10–30) comes out through.
    s.box(SLOT_X, 7, 0, LIP, 26, 6.5, { top: 'detail', front: 'front', side: 'detail' })
    s.poly(
      [
        [SLOT_X + LIP, 9, 4],
        [SLOT_X + LIP, 31, 4],
        [SLOT_X + LIP, 31, 0.8],
        [SLOT_X + LIP, 9, 0.8],
      ],
      'glass',
      'line',
    )
  })

  // Clip each face in its own plane: projecting a slab lets hidden blade points overlap the slot window.
  const faceClip: P3[] = [],
    edgeClip: P3[] = []
  for (const cx of [SLOT_X + LIP, x1 + TAPE_PAY + 12]) {
    for (const cy of [-4, 44]) faceClip.push([cx, cy, BZ])
    for (const z of [BZ - 3, BZ + 3]) edgeClip.push([cx, 30, z])
  }
  s.group(
    'blade',
    () => {
      const x0 = SLOT_X - HIDDEN
      s.lit(
        [
          [x0, 10, BZ],
          [x1, 10, BZ],
          [x1, 30, BZ],
          [x0, 30, BZ],
        ],
        5,
      )
      const minor: P3[][] = [],
        major: P3[][] = []
      for (let x = x0 + 6, i = 0; x < x1 - 2; x += 5, i++)
        (i % 5 === 0 ? major : minor).push([
          [x, 10, BZ],
          [x, 10 + (i % 5 === 0 ? 10 : 4.5), BZ],
        ])
      s.segs(minor, 'on-accent', 0.8)
      s.segs(major, 'on-accent', 1.1)
    },
    { clip: faceClip, vars: pay },
  )

  s.group(
    'blade',
    () => {
      s.poly(
        [
          [SLOT_X - HIDDEN, 30, BZ],
          [x1, 30, BZ],
          [x1, 30, BZ - 1.4],
          [SLOT_X - HIDDEN, 30, BZ - 1.4],
        ],
        'accent-side',
        'accent-side',
      )
    },
    { clip: edgeClip, vars: pay },
  )

  s.group(
    'blade-end',
    () => {
      // At section size a tag stands on the blade's far edge and names the unit; the reading is the head's, and its upright face takes the accent's side tone so it parts from the lit blade. Smaller, an empty tag would only be a slab, so there is none.
      if (k >= 0.8) {
        const tw = Math.max(26, Math.ceil(label.length * 6.9 + 12)),
          tx = x1 - tw - 6,
          top = BZ + TAG_H
        s.poly(
          [
            [tx, 10, top],
            [tx + tw, 10, top],
            [tx + tw, 10, BZ],
            [tx, 10, BZ],
          ],
          'accent-plate',
          'accent-plate',
        )
        s.poly(
          [
            [tx, 8.5, top],
            [tx + tw, 8.5, top],
            [tx + tw, 10, top],
            [tx, 10, top],
          ],
          'accent',
          'accent',
        )
        s.text(label, [tx + tw / 2, 10, BZ + 6], [1, 0, 0], [0, 0, -1], {
          size: 11.5,
          fill: 'on-accent',
          weight: 700,
          anchor: 'middle',
          mono: true,
        })
        s.include([
          [tx + TAPE_PAY, 8.5, top],
          [tx + tw + TAPE_PAY, 8.5, top],
        ])
      }
      // The hook is nearer than the tag where they meet on screen, so it comes after: a plate riveted to the blade with a nail slot.
      s.box(x1, 7, 0, 4, 26, 11, { top: 'front', front: 'front', side: 'side' })
      const hx = x1 + 4,
        at = (py: number, z: number): P3 => [hx, py, z]
      s.poly(
        roundRect(14, 4.4, 12, 2.2, 1.1, 3).map(([py, z]) => at(py, z)),
        'shade',
        'crease',
      )
      for (const py of [10, 30])
        s.poly(
          roundRect(py - 1, 4.5, 2, 2, 1, 4).map(([qy, z]) => at(qy, z)),
          'detail',
          'crease',
        )
      // The full-length blade is always inside the box, so the case stays put whatever the distance; so is the paid-out position, so the moving end never leaves it.
      s.include([
        [SLOT_X + BLADE + 4 + TAPE_PAY, 7, 0],
        [SLOT_X + BLADE + 4 + TAPE_PAY, 33, 0],
        [SLOT_X + BLADE + 4 + TAPE_PAY, 33, 11],
      ])
    },
    { vars: pay },
  )
  return s.done()
}
