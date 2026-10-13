import { hull, Scene, type P3, type Pt } from '../../../overview/iso/scene'
import { shadowRect, X, Y } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

// Airports: a radar scope set into a console. Rung = blips on the glass; from rung 3 one flies a holding pattern.
// The sweep is the lit part at every rung. The top rung crowds the glass and sticks a note on the bezel.

const BASE = 3,
  ZB = 40,
  SLOPE = 0.22
const DECK: P3 = [0, 1, -SLOPE]
const R_GLASS = 31,
  LIFT = 3.6

/** Blips outside the holding pattern, golden-angle spread so a longer prefix only adds blips. */
const OVAL = { cx: -8, cy: -7, a: 9.5, b: 7.5, turn: (28 * Math.PI) / 180 }
const oval = (t: number): Pt => {
  const half = 2 * OVAL.a,
    arc = Math.PI * OVAL.b,
    len = 2 * half + 2 * arc
  let d = (((t % 1) + 1) % 1) * len,
    x: number,
    y: number
  if (d < half) [x, y] = [-OVAL.a + d, -OVAL.b]
  else if ((d -= half) < arc) {
    const g = -Math.PI / 2 + d / OVAL.b
    ;[x, y] = [OVAL.a + OVAL.b * Math.cos(g), OVAL.b * Math.sin(g)]
  } else if ((d -= arc) < half) [x, y] = [OVAL.a - d, OVAL.b]
  else {
    const g = Math.PI / 2 + (d - half) / OVAL.b
    ;[x, y] = [-OVAL.a + OVAL.b * Math.cos(g), OVAL.b * Math.sin(g)]
  }
  const c = Math.cos(OVAL.turn),
    sn = Math.sin(OVAL.turn)
  return [OVAL.cx + x * c - y * sn, OVAL.cy + x * sn + y * c]
}

type Blip = { x: number; y: number; dx: number; dy: number }
const BLIPS: Blip[] = []
const track = Array.from({ length: 60 }, (_, i) => oval(i / 60))
let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
while (BLIPS.length < 30) {
  const ang = rnd() * 2 * Math.PI,
    rad = 5 + 21 * Math.sqrt(rnd())
  const x = rad * Math.cos(ang),
    y = rad * Math.sin(ang)
  if (track.some(([a, b]) => Math.hypot(x - a, y - b) < 6.5)) continue
  if (BLIPS.some((o) => Math.hypot(x - o.x, y - o.y) < 6.2)) continue
  const h = rnd() * 2 * Math.PI
  BLIPS.push({ x, y, dx: Math.cos(h), dy: Math.sin(h) })
}
/** Blips on the glass per rung, not counting the one in the holding pattern. */
const COUNT = [1, 4, 6, 10, 26]

const SWEEP = (-52 * Math.PI) / 180

export const airports: LadderFigureDef = {
  id: 'airports',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    // The thumb hugs the scope: no control strip, so the screen is as big as the slot allows.
    const W = hero ? 92 : 75,
      D = hero ? 84 : 74,
      CU = W / 2,
      CV = 36.5,
      ZF = ZB - SLOPE * D,
      ZC = ZB - SLOPE * CV,
      R_BEZEL = hero ? 35.5 : 36
    const edge = 'crease'
    const ringAt = (a: number, r: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)]

    // The deck slopes down toward the viewer; the scope's local (x, y) lie on it.
    const deck = s.on([0, 0, ZB], X, DECK)
    const scope = (lift: number) => s.on([CU, CV, ZC + lift], X, DECK)
    const disc = (lift: number, r: number, n = 40) =>
      s.circle([CU, CV, ZC + lift], X, DECK, 0, 0, r, n)

    // Console body: plinth, then the sloped shell.
    if (hero) {
      shadowRect(s, 0, 0, W, D, 7)
      if (hero) s.box(-1.5, -1.5, 0, W + 3, D + 3, BASE)
      const corner = (x: number, y: number, z: number): P3 => [x, y, z]
      s.poly(
        [corner(W, 0, BASE), corner(W, D, BASE), corner(W, D, ZF), corner(W, 0, ZB)],
        'side',
        edge,
      )
      s.poly(
        [corner(0, D, BASE), corner(W, D, BASE), corner(W, D, ZF), corner(0, D, ZF)],
        'front',
        edge,
      )
      s.poly([deck(0, 0), deck(W, 0), deck(W, D), deck(0, D)], 'top', edge)
      s.poly2(
        hull(
          [
            corner(0, 0, ZB),
            corner(W, 0, ZB),
            corner(W, 0, BASE),
            corner(W, D, BASE),
            corner(0, D, BASE),
            corner(0, D, ZF),
          ].map(([x, y, z]) => s.P(x, y, z)),
        ),
        'none',
        'line',
      )

      // Panel seams on the deck, and a lip round the strip of controls.
      if (hero) {
        s.line([deck(0, 71), deck(W, 71)], 'crease', 0.8)
        s.line([deck(0, 73), deck(W, 73)], 'detail', 0.6)
        s.line([deck(8, 71), deck(8, 0)], 'crease', 0.6)
        s.line([deck(W - 8, 71), deck(W - 8, 0)], 'crease', 0.6)
        for (const [u, v] of [
          [4, 4],
          [W - 4, 4],
          [4, 66],
          [W - 4, 66],
          [4, D - 4],
          [W - 4, D - 4],
        ]) {
          const c = s.circle([u, v, ZB - SLOPE * v + 0.05], X, DECK, 0, 0, 1.1, 8)
          s.poly(c, 'detail', 'line')
          s.line([c[2], c[6]], 'line', 0.5)
        }
      }

      // Front face: vent slots on the left, a label plate with three rules on the right, a seam between.
      const face = s.on([0, D, 0], X, [0, 0, 1])
      if (hero) {
        for (let i = 0; i < 5; i++) {
          const z = 7.5 + i * 3
          s.poly([face(8, z), face(30, z), face(30, z + 1.2), face(8, z + 1.2)], 'shade', 'crease')
        }
        s.line([face(40, BASE), face(40, ZF)], 'crease', 0.7)
        s.poly([face(54, 8), face(84, 8), face(84, 17), face(54, 17)], 'top', 'line')
        for (const [i, len] of [22, 17, 20].entries()) {
          const z = 15 - i * 2.6
          s.line([face(57, z), face(57 + len, z)], 'detail', 0.8)
        }
        for (const [u, z] of [
          [55.6, 9.4],
          [82.4, 9.4],
          [55.6, 15.6],
          [82.4, 15.6],
        ])
          s.poly(s.circle(face(u, z), X, [0, 0, -1], 0, 0, 0.6, 6), 'detail', 'none')
        // Side face seam.
        const side = s.on([W, 0, 0], Y, [0, 0, 1])
        s.line([side(44, BASE), side(44, ZB - SLOPE * 44)], 'crease', 0.7)
        s.poly([side(8, 8), side(36, 8), side(36, 24), side(8, 24)], 'top', 'crease')
        for (const [u, z] of [
          [10, 10],
          [34, 10],
          [10, 22],
          [34, 22],
        ])
          s.poly(s.circle(side(u, z), Y, [0, 0, -1], 0, 0, 0.6, 6), 'detail', 'none')
        for (let i = 0; i < 4; i++)
          s.poly(
            [
              side(52, 9 + i * 2.8),
              side(80, 9 + i * 2.8),
              side(80, 10.2 + i * 2.8),
              side(52, 10.2 + i * 2.8),
            ],
            'shade',
            'crease',
          )
      }
    }

    // The scope: bezel wall, bezel top, the dark inner wall, then the glass below it.
    const wall = (lo: P3[], up: P3[]) => s.poly2(hull(s.pp([...lo, ...up])), 'front', 'none')
    const lowRim = disc(0, R_BEZEL),
      upRim = disc(LIFT, R_BEZEL - 1.2)
    const rimTop = disc(LIFT, R_GLASS, 48),
      rimLow = disc(1.4, R_GLASS, 48)
    if (hero) {
      wall(lowRim, upRim)
      s.poly2(hull(s.pp([...lowRim, ...upRim])), 'none', 'line')
      s.poly(upRim, 'top', 'line')
      s.poly(disc(LIFT, R_GLASS + 1.4, 48), 'none', 'crease', undefined, 0.7)
      s.poly2(hull(s.pp([...rimTop, ...rimLow])), 'shade', 'none')
      s.poly(rimTop, 'none', 'line')
    } else {
      // A thumb draws the bezel as two strokes only: its outline and the glass edge.
      s.poly2(hull(s.pp([...lowRim, ...upRim])), 'front', 'line')
      s.poly(upRim, 'top', 'none')
    }
    s.poly(rimLow, 'glass', 'line')

    // On the glass.
    const g = (x: number, y: number): P3 => scope(1.5)(x, y)
    const ring = (r: number, w = 0.7) =>
      s.poly(s.circle([CU, CV, ZC + 1.5], X, DECK, 0, 0, r, 40), 'none', 'detail', undefined, w)
    if (hero) {
      ring(9)
      ring(18)
      ring(26.5, 0.6)
      s.line([g(-26, 0), g(26, 0)], 'detail', 0.6)
      s.line([g(0, -26), g(0, 26)], 'detail', 0.6)
      const ticks: P3[][] = []
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * 2 * Math.PI,
          long = i % 9 === 0,
          mid = i % 3 === 0
        const [x0, y0] = ringAt(a, 28.6),
          [x1, y1] = ringAt(a, long ? 24.6 : mid ? 26.4 : 27.4)
        ticks.push([g(x0, y0), g(x1, y1)])
      }
      s.segs(ticks, 'crease', 0.7)
    } else {
      ring(17, 1)
    }

    // The holding pattern from rung 3: a solid trail behind the blip, each short run fainter and thinner until it is gone.
    // At rung 3 the head of the trail is the new thing and is lit; later rungs draw it in plain tone.
    const holding = rung >= 3
    const N = hero ? 40 : 22,
      headRuns = rung === 3 ? (hero ? 12 : 8) : 0
    const run = (i: number, paint: 'line' | 'accent') => {
      const f = i / N,
        a = oval(-f * 0.96),
        b = oval(-((i + 1) / N) * 0.96)
      const op = 0.9 * (1 - f) ** 1.15
      if (op < 0.02) return
      s.poly([g(a[0], a[1]), g(b[0], b[1])], 'none', paint, op, (hero ? 1.3 : 1.7) * (1 - 0.55 * f))
    }
    if (holding) for (let i = headRuns; i < N; i++) run(i, 'line')

    // The sweep: a faint wedge from the centre, plain tone (hero only).
    if (hero) {
      const wedge = (span: number): P3[] => {
        const pts: P3[] = [g(0, 0)]
        for (let i = 0; i <= 14; i++) {
          const [x, y] = ringAt(SWEEP - span + (span * i) / 14, R_GLASS - 1.2)
          pts.push(g(x, y))
        }
        return pts
      }
      s.poly(wedge(0.8), 'detail', 'none', undefined, undefined, 0.2)
      s.poly(wedge(0.5), 'detail', 'none', undefined, undefined, 0.3)
      s.poly(wedge(0.2), 'detail', 'none', undefined, undefined, 0.4)
      const [x, y] = ringAt(SWEEP, R_GLASS - 1.2)
      s.line([g(0, 0), g(x, y)], 'crease', 1)
    }

    // Blips, with a short fading tail on every other one. The newest ones are lit; rung 5 lights the note instead.
    const dot = (x: number, y: number, r: number, paint: 'ink' | 'accent' = 'ink') =>
      s.poly(s.circle([CU, CV, ZC + 1.6], X, DECK, x, y, r, 10), paint, 'none')
    const br = hero ? 1.5 : 3.8
    // Only the single newest blip is lit (rungs 1, 2, 4); rung 3 lights the holding pattern, rung 5 the note.
    const litIdx = rung === 1 || rung === 2 || rung === 4 ? COUNT[rung - 1] - 1 : -1
    BLIPS.slice(0, COUNT[rung - 1]).forEach((b, i) => {
      if (hero && i % 2 === 0)
        for (let j = 0; j < 3; j++)
          s.poly(
            [
              g(b.x - b.dx * (j * 2.4 + 1), b.y - b.dy * (j * 2.4 + 1)),
              g(b.x - b.dx * (j * 2.4 + 3.4), b.y - b.dy * (j * 2.4 + 3.4)),
            ],
            'none',
            'line',
            0.55 - j * 0.2,
            0.8,
          )
      if (i !== litIdx) dot(b.x, b.y, br)
    })
    const [hx, hy] = oval(0)
    if (holding && rung !== 3) {
      dot(hx, hy, br + 0.6)
      if (hero)
        s.poly(
          s.circle([CU, CV, ZC + 1.6], X, DECK, hx, hy, br + 2.4, 14),
          'none',
          'line',
          0.6,
          0.6,
        )
    }
    if (rung < 5)
      s.group('lit', () => {
        if (rung === 3) for (let i = 0; i < headRuns; i++) run(i, 'accent')
        s.glow(hero ? 3 : 2, () => {
          if (litIdx >= 0) dot(BLIPS[litIdx].x, BLIPS[litIdx].y, br + 0.5, 'accent')
          if (rung === 3) dot(hx, hy, br + 1.1, 'accent')
        })
        if (litIdx >= 0) dot(BLIPS[litIdx].x, BLIPS[litIdx].y, br + 0.5, 'accent')
        if (rung === 3) {
          dot(hx, hy, br + 1.1, 'accent')
          if (hero)
            s.poly(
              s.circle([CU, CV, ZC + 1.6], X, DECK, hx, hy, br + 2.6, 14),
              'none',
              'accent',
              0.8,
              0.7,
            )
        }
      })

    // Bezel screws and the glass edge, hero only.
    if (hero) {
      for (const deg of [45, 135, 225, 315, 0, 90, 180, 270]) {
        const a = (deg * Math.PI) / 180,
          [x, y] = ringAt(a, 32.2)
        const c = s.circle([CU, CV, ZC + LIFT + 0.02], X, DECK, x, y, 0.95, 8)
        s.poly(c, 'detail', 'line')
        const [sx, sy] = ringAt(a + Math.PI / 2, 0.8)
        const at = scope(LIFT + 0.02)
        s.line([at(x - sx, y - sy), at(x + sx, y + sy)], 'line', 0.5)
      }
    }

    // Controls on the front strip: three knurled knobs, then a row of toggles.
    if (hero)
      for (const [u, shade] of [
        [14, 0],
        [28, 1],
        [42, 2],
      ] as const) {
        const v = 78,
          z = ZB - SLOPE * v
        s.poly(s.circle([u, v, z + 0.4], X, Y, 0, 0, 6.4, 18), 'detail', 'line')
        const rim = s.circle([u, v, z + 3.6], X, Y, 0, 0, 4.6, 24)
        const base = s.circle([u, v, z + 0.4], X, Y, 0, 0, 4.6, 24)
        s.poly2(hull(s.pp([...rim, ...base])), 'front', 'line')
        if (hero) {
          const kn: P3[][] = []
          for (let a = -40; a <= 130; a += 14) {
            const t = (a * Math.PI) / 180
            kn.push([
              [u + 4.6 * Math.cos(t), v + 4.6 * Math.sin(t), z + 0.9],
              [u + 4.6 * Math.cos(t), v + 4.6 * Math.sin(t), z + 3.3],
            ])
          }
          s.segs(kn, 'crease', 0.6)
        }
        s.poly(rim, 'top', 'line')
        const t = (-35 + shade * 50) * (Math.PI / 180)
        s.line(
          [
            [u, v, z + 3.65],
            [u + 4 * Math.cos(t), v + 4 * Math.sin(t), z + 3.65],
          ],
          'line',
          1,
        )
      }
    if (hero)
      for (const [i, u] of [58, 67, 76, 85].entries()) {
        const v = 78,
          z = ZB - SLOPE * v
        s.poly(s.circle([u, v, z + 0.3], X, Y, 0, 0, 2.6, 12), 'detail', 'line')
        const lean = i % 2 ? 1.6 : -1.6
        s.line(
          [
            [u, v, z + 0.8],
            [u + lean * 0.6, v + lean, z + 5.2],
          ],
          'line',
          1.5,
        )
        if (hero)
          s.poly(s.circle([u + lean * 0.6, v + lean, z + 5.4], X, Y, 0, 0, 1, 6), 'top', 'line')
      }

    // Top rung: a sticky note on the bezel, one corner curled, ruled lines, no words.
    if (rung === 5) {
      const NL = LIFT + 0.4
      const ca = 0.2,
        cs = Math.cos(ca),
        sn = Math.sin(ca)
      const cx = -31.5,
        cy = 15
      const np = (u: number, v: number): P3 => scope(NL)(cx + u * cs - v * sn, cy + u * sn + v * cs)
      const sp = (u: number, v: number): P3 =>
        scope(NL - 3.2)(cx + 1.8 + u * cs - v * sn, cy + 1.8 + u * sn + v * cs)
      const h = hero ? 7.8 : 10.5,
        c = h - 4.2
      s.group('lit', () => {
        s.poly([sp(-h, -h), sp(h, -h), sp(h, h), sp(-h, h)], 'shadow', 'none')
        // An outline with a faint tint, not a slab: the bezel stays visible through it.
        const note = [np(-h, -h), np(h, -h), np(h, c), np(c, h), np(-h, h)]
        s.poly(note, 'accent', 'none', undefined, undefined, 0.22)
        s.poly(note, 'none', 'accent', undefined, hero ? 1 : undefined)
        s.poly([np(h, c), np(c, h), np(c, c)], 'none', 'accent', undefined, hero ? 0.8 : undefined)
        if (hero) {
          s.line([np(-5.8, -2.6), np(5.8, -2.6)], 'accent', 0.7)
          s.line([np(-5.8, 1), np(2.4, 1)], 'accent', 0.7)
        } else {
          s.line([np(-h + 2.5, -2), np(h - 2.5, -2)], 'accent', 1.2)
        }
      })
    }

    return s.done()
  },
}
