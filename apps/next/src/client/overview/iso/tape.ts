import { Scene, roundRect, type P3 } from './scene'

/** How far the blade pays out on hover, in iso units along the blade. */
const TAPE_PAY = 20
const SLOT_X = 46,
  BZ = 2.6,
  BLADE = 146,
  // The blade continues inside the case by one major tick so ticks keep their phase as it pays out; the slot clip hides that part.
  HIDDEN = 25,
  // The case: an x–z profile extruded along y round the blade's width (y 10–30). The mouth corner is square so the slot sits on flat wall.
  CASE = { x: -2, y: 8, d: 24, h: 54 },
  TAG_H = 20

/** Over time: a tape measure whose lit blade is the distance flown; at section size its tag reads the total. Parts: `case`, `blade` (clipped at the slot) and `blade-end` (tag and hook). */
export function tape(label: string, k = 1) {
  const s = new Scene(k)
  const x1 = SLOT_X + BLADE
  const [payX, payY] = s.vector(TAPE_PAY, 0, 0)
  const pay = { '--pay-x': `${payX}px`, '--pay-y': `${payY}px` }

  s.group('case', () => {
    const { x, y, d, h } = CASE
    s.prism(roundRect(x, 0, SLOT_X - x, h, [0, 12, 20, 12]), y, d)
    // Thumb lock: a slider on the top, its front flush with where the front edge starts to round.
    s.box(SLOT_X - 24, 16, h, 12, 8, 2.5)
    // Neutral screw at the coil's centre on the near face.
    const F: P3 = [0, y + d, h],
      U: P3 = [1, 0, 0],
      V: P3 = [0, 0, -1]
    const hub: [number, number] = [(x + SLOT_X) / 2, h / 2]
    s.poly(s.circle(F, U, V, ...hub, 8), 'side', 'line')
    s.poly(s.circle(F, U, V, ...hub, 2, 12), 'detail', 'none')
    // The mouth: the blade (z 1.2–2.6, y 10–30) passes through it.
    s.poly(
      [
        [SLOT_X, 9, 4],
        [SLOT_X, 31, 4],
        [SLOT_X, 31, 0.8],
        [SLOT_X, 9, 0.8],
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
        'accent-side',
        'accent-side',
      )
    },
    { clip: edgeClip, vars: pay },
  )

  s.group(
    'blade-end',
    () => {
      // At section size a tag stands on the blade's far edge and reads the total along it, widening for longer totals; its upright face takes the accent's side tone so it parts from the lit blade. Smaller, the value sits beside the figure and an empty tag would only be a slab, so there is none.
      if (k >= 0.9) {
        const tw = Math.max(84, Math.ceil(label.length * 6.9 + 15)),
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
      // The hook is nearer than the tag where they meet on screen, so it comes after.
      s.box(x1, 7, 0, 4, 26, 11, { top: 'front', front: 'front', side: 'side' })
      // Bounds cover the paid-out position, so the moving end never leaves the figure's box.
      s.include([
        [x1 + 4 + TAPE_PAY, 7, 0],
        [x1 + 4 + TAPE_PAY, 33, 0],
        [x1 + 4 + TAPE_PAY, 33, 11],
      ])
    },
    { vars: pay },
  )
  return s.done()
}
