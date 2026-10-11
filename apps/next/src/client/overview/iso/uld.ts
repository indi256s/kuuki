import type { MakerKey } from '@kuuki/data/aircraft-makers'
import { Scene, roundRect, type P3, type Pt } from './scene'

/** Containers on the dolly; each stands for about a fifth of the flights. */
export const ULD_SLOTS = 5
// An LD3 container in x–z: B wide at the base, W at the top, its contour (the angled side) starting CONTOUR up, H tall; D deep along y. STEP is the pitch along the dolly.
const B = 17,
  W = 23,
  CONTOUR = 8,
  H = 22,
  D = 22,
  STEP = 26
const DECK = { z: 7, h: 3 }
/** How far the train rolls toward its tow bar on hover, in iso units. */
const ROLL = 8

/** Splits ULD_SLOTS containers between makers by largest remainder, biggest share first; a maker with any flights below one slot's worth can still win a remainder. */
export function uldSlots(rows: readonly { key: MakerKey; flights: number }[]): MakerKey[] {
  const total = rows.reduce((sum, row) => sum + row.flights, 0)
  if (!total) return []
  const quotas = rows
    .filter((row) => row.flights > 0)
    .map((row) => ({ key: row.key, exact: (row.flights / total) * ULD_SLOTS }))
  const counts = new Map(quotas.map((q) => [q.key, Math.floor(q.exact)]))
  let left = ULD_SLOTS - [...counts.values()].reduce((a, b) => a + b, 0)
  for (const q of [...quotas].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)),
  )) {
    if (left-- <= 0) break
    counts.set(q.key, counts.get(q.key)! + 1)
  }
  return quotas
    .sort((a, b) => b.exact - a.exact)
    .flatMap((q) => Array.from({ length: counts.get(q.key)! }, () => q.key))
}

/**
 * Makers: a baggage dolly carrying ULD_SLOTS LD3 cargo containers, each with its door curtain in its maker's colour (`slots`, biggest share first, so the leader rides at the tow bar).
 * Parts: `train` (carries --roll-x/--roll-y; rolls toward the tow bar on hover).
 */
export function uldTrain(slots: readonly MakerKey[], k = 1) {
  const s = new Scene(k)
  const n = ULD_SLOTS,
    len = n * STEP + 4
  const [rx, ry] = s.vector(ROLL, 0, 0)
  // The leader is nearest the tow bar, at the right; containers are drawn from the far (left) end.
  const order = Array.from({ length: n }, (_, i) => slots[n - 1 - i] ?? 'unknown')
  s.poly(
    [
      [-4, -3, 0],
      [len + 26, -3, 0],
      [len + 26, D + 7, 0],
      [-4, D + 7, 0],
    ],
    'shadow',
    'none',
  )
  s.group(
    'train',
    () => {
      const wheel = (x: number, y: number) => {
        const U: P3 = [1, 0, 0],
          V: P3 = [0, 0, 1]
        s.poly(s.circle([x, y, 4.5], U, V, 0, 0, 4.5, 16), 'side')
        s.poly(s.circle([x, y + 0.1, 4.5], U, V, 0, 0, 1.6, 10), 'detail', 'line', undefined, 0.6)
      }
      // Far wheels peek under the deck; the near ones go on after it.
      for (const x of [10, len - 10]) wheel(x, -1)
      // Tow bar from the front of the deck down to a ring on the ground.
      const mid = D / 2 + 1
      s.box(len, mid - 1.5, DECK.z - 1, 6, 3, 2)
      s.line(
        [
          [len + 6, mid, DECK.z],
          [len + 20, mid, 2.2],
        ],
        'line',
        1.8,
      )
      s.poly(
        s.circle([len + 22, mid, 1.6], [1, 0, 0], [0, 1, 0], 0, 0, 2.6, 14),
        'none',
        'line',
        undefined,
        1.4,
      )
      // The deck, with its rail of rollers between the containers.
      s.box(-2, -2, DECK.z, len, D + 6, DECK.h)
      for (const x of [10, len - 10]) wheel(x, D + 4.2)
      const top = DECK.z + DECK.h
      s.segs(
        Array.from({ length: n + 1 }, (_, i): P3[] => {
          const x = i * STEP + 1
          return [
            [x - 1, 0, top],
            [x - 1, D + 2, top],
          ]
        }),
        'detail',
        1.2,
      )
      // A data plate on the deck's near face.
      s.poly(
        [
          [4, D + 4, top - 0.6],
          [16, D + 4, top - 0.6],
          [16, D + 4, DECK.z + 0.6],
          [4, D + 4, DECK.z + 0.6],
        ],
        'detail',
        'none',
      )

      order.forEach((maker, i) => {
        const x = i * STEP + 2,
          y = 1
        const profile: Pt[] = [
          [x, top],
          [x + B, top],
          [x + W, top + CONTOUR],
          [x + W, top + H],
          [x, top + H],
        ]
        s.prism(profile, y, D)
        // Door curtain on the near face, in the maker's colour, with three straps across it.
        const near = y + D
        const face = s.on([x, near, top + H], [1, 0, 0], [0, 0, -1])
        const inset: Pt[] = roundRect(2, 2.5, W - 4, H - 5, 0.8, 2)
        // The curtain follows the contour: its lower right corner steps in where the wall angles.
        const curtain: P3[] = inset.map(([u, v]) => {
          const limit = v > H - CONTOUR ? B - 2 + ((H - v) / CONTOUR) * (W - B) : W - 2
          return face(Math.min(u, limit), v)
        })
        s.poly(curtain, `maker:${maker}`, `maker-side:${maker}`, undefined, 0.8)
        s.segs(
          [6, 11, 16].map((v): P3[] => [
            face(2.4, v),
            face(
              Math.min(
                W - 2.4,
                v > H - CONTOUR ? B - 2 + ((H - v) / CONTOUR) * (W - B) - 0.4 : W - 2.4,
              ),
              v,
            ),
          ]),
          `maker-side:${maker}`,
          1,
        )
        // Corner fittings on the roof and the ID plate at the top of the door.
        for (const u of [1.5, W - 1.5])
          s.poly(
            s.circle([x + u, near - 1.5, top + H], [1, 0, 0], [0, 1, 0], 0, 0, 0.7, 6),
            'detail',
            'none',
          )
        s.poly([face(4, 0.8), face(12, 0.8), face(12, 2), face(4, 2)], 'detail', 'none')
      })
      s.include([
        [len + 26 + ROLL, mid, 0],
        [-4 + ROLL, -3, 0],
      ])
    },
    { vars: { '--roll-x': `${rx}px`, '--roll-y': `${ry}px` } },
  )
  return s.done()
}
