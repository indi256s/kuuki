import { Scene, type P3 } from './scene'

/** How far the blade pays out on hover, in iso units along the blade. */
export const TAPE_PAY = 20
const SLOT_X = 46,
  BZ = 2.6,
  BLADE = 146,
  // The blade continues inside the case by one major tick so ticks keep their phase as it pays out; the slot clip hides that part.
  HIDDEN = 25

/** Over time: a tape measure whose lit blade is the distance flown; the tag reads the total. Parts: `case`, `blade` (clipped at the slot) and `blade-end` (hook and tag). */
export function tape(label: string, k = 1) {
  const s = new Scene(k)
  const x1 = SLOT_X + BLADE
  const [payX, payY] = s.vector(TAPE_PAY, 0, 0)
  const pay = { '--pay-x': `${payX}px`, '--pay-y': `${payY}px` }

  s.group('case', () => {
    s.rbox(0, 0, 0, SLOT_X, 40, 52, 10)
    const F: P3 = [0, 40, 52],
      U: P3 = [1, 0, 0],
      V: P3 = [0, 0, -1]
    s.poly(s.circle(F, U, V, 23, 26, 13), 'glass', 'line')
    s.lit(s.circle(F, U, V, 23, 26, 6.5), 3)
    s.poly(
      [
        [SLOT_X, 9, 7],
        [SLOT_X, 31, 7],
        [SLOT_X, 31, 3],
        [SLOT_X, 9, 3],
      ],
      'glass',
      'line',
    )
  })

  // Clip each face in its own plane: projecting a slab lets hidden blade points overlap the slot window.
  const faceClip: P3[] = [],
    edgeClip: P3[] = []
  for (const x of [SLOT_X, x1 + TAPE_PAY + 12]) {
    for (const y of [-4, 44]) faceClip.push([x, y, BZ])
    for (const z of [BZ - 3, BZ + 3]) edgeClip.push([x, 30, z])
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
          [x, 10 + (i % 5 === 0 ? 9 : 4.5), BZ],
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
        'accent',
        'accent',
      )
    },
    { clip: edgeClip, vars: pay },
  )

  s.group(
    'blade-end',
    () => {
      s.box(x1, 7, 0, 4, 26, 11, { top: 'front', front: 'side', side: 'side' })
      // The tag stands on the blade and reads along it; it widens for longer totals.
      const tw = Math.max(84, Math.ceil(label.length * 6.9 + 15)),
        tx = x1 - tw - 6,
        ty = 24
      const plate: P3[] = [
        [tx, ty, 34],
        [tx + tw, ty, 34],
        [tx + tw, ty, 14],
        [tx, ty, 14],
      ]
      s.glow(6, () => s.poly(plate, 'accent', 'none'))
      s.poly(plate, 'accent', 'accent')
      s.poly(
        [
          [tx, ty - 3, 34],
          [tx + tw, ty - 3, 34],
          [tx + tw, ty, 34],
          [tx, ty, 34],
        ],
        'accent',
        'on-accent',
        0.35,
      )
      s.text(label, [tx + tw / 2, ty, 20], [1, 0, 0], [0, 0, -1], {
        size: 11.5,
        fill: 'on-accent',
        weight: 700,
        anchor: 'middle',
        mono: true,
      })
      // Bounds cover the paid-out position, so the moving end never leaves the figure's box.
      s.include([
        [x1 + 4 + TAPE_PAY, 7, 0],
        [x1 + 4 + TAPE_PAY, 33, 0],
        [x1 + 4 + TAPE_PAY, 33, 11],
        [tx + TAPE_PAY, ty, 34],
        [tx + tw + TAPE_PAY, ty, 34],
      ])
    },
    { vars: pay },
  )
  return s.done()
}
