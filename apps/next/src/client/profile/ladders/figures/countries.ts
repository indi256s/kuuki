import { Scene, roundRect, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import { X, Y, cylZ, shadowRect } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

type Kind = 'ring' | 'dbl' | 'oval' | 'rrect'
type Mark = { u: number; v: number; kind: Kind; deg: number }
type At = (u: number, v: number) => P3

/** Sheet (a visa page) and its fold, in iso units; the sheet lies on x 0..SW, y SY0..SY0 + SD. */
const SW = 92,
  SD = 100,
  SY0 = 40,
  SH = 0.9,
  FOLD = 9
/** The tin: x PX..PX + PW, y 0..PD, a shallow pan with its lid lying beside it, inside up, on y LY..LY + LD. */
const PX = 100,
  PD = 58,
  PW = 48,
  TIN = 5,
  BEAD = 1.4,
  LY = PD + 8,
  LD = 46,
  LH = 3.2
/** The stamp stands on the pad at (STX, STY). */
const STX = PX + 28,
  STY = 17,
  FELT_Z = TIN - 1.4

/** Impressions per rung, in the order they were stamped: 15 on the sheet, then 2 on the lid. The thumb sheet holds 9, so its steps are 1, 3, 5, 7, then all 9 and the lid. */
const COUNTS = [1, 3, 6, 10, 17]
const THUMB_COUNTS = [1, 3, 5, 7, 11]
const THUMB_SCALE = 1.2
const CELLS: [number, number][] = [
  [1, 2],
  [0, 4],
  [2, 2],
  [0, 1],
  [2, 4],
  [1, 0],
  [1, 4],
  [0, 3],
  [2, 1],
  [1, 1],
  [1, 3],
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 3],
]
const KINDS: Kind[] = [
  'ring',
  'rrect',
  'oval',
  'dbl',
  'rrect',
  'ring',
  'oval',
  'dbl',
  'ring',
  'rrect',
  'oval',
  'ring',
  'dbl',
  'rrect',
  'oval',
]
const SHEET_MARKS: Mark[] = CELLS.map(([c, r], i) => ({
  u: 17 + c * 29 + (((i * 13) % 7) - 3) * 1.1,
  v: 12 + r * 19 + (((i * 5) % 5) - 2) * 0.9,
  kind: KINDS[i],
  deg: ((i * 47) % 29) - 14,
}))
const LID_MARKS: Mark[] = [
  { u: 16, v: 13, kind: 'rrect', deg: 6 },
  { u: 34, v: 31, kind: 'ring', deg: -9 },
]
const THUMB_LID_MARKS: Mark[] = [
  { u: 15, v: 15, kind: 'ring', deg: 6 },
  { u: 33, v: 31, kind: 'ring', deg: -9 },
]
/** The 56px slot: nine bigger cells on a shorter sheet, so each impression stays a readable ring. */
const THUMB_MARKS: Mark[] = CELLS.map(([c, r], i): [number, number, number] => [c, r, i])
  .filter(([, r]) => r < 3)
  .map(([c, r, i]) => ({
    u: 17 + c * 29,
    v: 15 + r * 28,
    kind: KINDS[i] === 'dbl' ? 'ring' : KINDS[i],
    deg: ((i * 47) % 29) - 14,
  }))

const R = 8.5,
  RI = 6.4,
  OVAL: Pt = [12, 7.5]
const ellipse = (rx: number, ry: number, n = 28): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI
    return [rx * Math.cos(a), ry * Math.sin(a)]
  })
const outlineOf = (kind: Kind): Pt[] =>
  kind === 'oval'
    ? ellipse(...OVAL)
    : kind === 'rrect'
      ? roundRect(-12, -7.5, 24, 15, 3.5)
      : ellipse(R, R, 24)
/** Rule lines in impression-local coordinates: [v, u0, u1]. Two chords end on the ring; the short middle rule stands for text. */
function rulesOf(kind: Kind): [number, number, number][] {
  const chord = (rx: number, ry: number, v: number): [number, number, number] => {
    const hw = rx * Math.sqrt(1 - (v / ry) ** 2)
    return [v, -hw, hw]
  }
  if (kind === 'ring') return [chord(R, R, -3.6), [0.4, -4.6, 4.6], chord(R, R, 3.8)]
  if (kind === 'dbl') return [chord(RI, RI, -2.6), [0.6, -3.4, 3.4], chord(RI, RI, 3.4)]
  if (kind === 'oval') return [chord(...OVAL, -3.2), [0.4, -6.5, 6.5], chord(...OVAL, 3.8)]
  return [
    [-3.6, -12, 12],
    [0, -7.5, 7.5],
    [3.6, -12, 12],
  ]
}

/** The visible run of a counter-clockwise plan loop: every edge whose outward normal faces the viewer. */
function nearRun(loop: readonly Pt[], z: number): P3[] {
  const out: P3[] = []
  loop.forEach(([x0, y0], i) => {
    const [x1, y1] = loop[(i + 1) % loop.length]
    if (y1 - y0 + (x0 - x1) > 1e-6) out.push([x0, y0, z], [x1, y1, z])
  })
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1])
}

export const countries: LadderFigureDef = {
  id: 'countries',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const sheetMarks = hero ? SHEET_MARKS : THUMB_MARKS,
      marks = [...sheetMarks, ...(hero ? LID_MARKS : THUMB_LID_MARKS)],
      sd = hero ? SD : 86,
      sc = hero ? 1 : THUMB_SCALE
    const count = rung === 5 ? marks.length : (hero ? COUNTS : THUMB_COUNTS)[rung - 1],
      fresh = count - 1

    const dot = (x: number, y: number, z: number, r = 0.5) =>
      s.poly(s.circle([x, y, z], X, Y, 0, 0, r, 8), 'detail', 'line')
    const rect = (x0: number, y0: number, x1: number, y1: number, z: number): P3[] => [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ]
    /** Half of a ring round an upright cylinder, the near side. */
    const ring = (cx: number, cy: number, r: number, z: number, paint: Paint = 'crease') => {
      const pts: P3[] = []
      for (let i = 0; i <= 14; i++) {
        const a = (-45 + (180 * i) / 14) * (Math.PI / 180)
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z])
      }
      s.line(pts, paint, 0.9)
    }

    /** One stamp impression on the plane `at`: a ring with ruled lines inside. The freshest one is accent. */
    const print = (at: At, m: Mark, isFresh: boolean) => {
      const a = (m.deg * Math.PI) / 180,
        c = Math.cos(a),
        sn = Math.sin(a)
      const loc = ([u, v]: Pt): P3 => at(m.u + (u * c - v * sn) * sc, m.v + (u * sn + v * c) * sc)
      const rings = [outlineOf(m.kind), ...(m.kind === 'dbl' ? [ellipse(RI, RI, 20)] : [])]
      const rules = hero
        ? rulesOf(m.kind).map(([v, u0, u1]): P3[] => [loc([u0, v]), loc([u1, v])])
        : []
      if (isFresh) {
        s.glow(3, () => {
          for (const r of rings) s.poly(r.map(loc), 'none', 'accent', undefined, 1.6)
        })
        for (const r of rings) s.poly(r.map(loc), 'none', 'accent', undefined, hero ? 1.6 : 2.6)
        if (rules.length) s.segs(rules, 'accent', 1.1)
      } else {
        for (const r of rings) s.poly(r.map(loc), 'none', 'crease', undefined, hero ? 1.1 : 1.8)
        if (rules.length) s.segs(rules, 'detail', 0.8)
      }
    }
    /** Draws marks from `from` to `to` (exclusive) on one surface; the freshest, if among them, sits in the lit group. */
    const stamp = (at: At, from: number, to: number) => {
      for (let i = from; i < Math.min(to, count); i++) {
        if (i === fresh) s.group('lit', () => print(at, marks[i], true))
        else print(at, marks[i], false)
      }
    }

    // Contact shadows: the sheet, the tin.
    shadowRect(s, 0, SY0, SW, sd, 3)
    shadowRect(s, PX - 3, 0, PW + 5, PD, 3)
    shadowRect(s, PX - 3, LY, PW + 5, LD, 3)

    // The sheet: a visa page with a folded corner, a border rule and a stitched gutter.
    const sheetAt: At = (u, v) => [u, SY0 + v, SH]
    const Y1 = SY0 + sd
    s.poly(
      [
        [SW, SY0, 0],
        [SW, Y1, 0],
        [SW, Y1, SH],
        [SW, SY0, SH],
      ],
      'side',
      'line',
    )
    s.poly(
      [
        [0, Y1, 0],
        [SW, Y1, 0],
        [SW, Y1, SH],
        [0, Y1, SH],
      ],
      'front',
      'line',
    )
    s.poly(
      [
        [FOLD, SY0, SH],
        [SW, SY0, SH],
        [SW, Y1, SH],
        [0, Y1, SH],
        [0, SY0 + FOLD, SH],
      ],
      'top',
      'line',
    )
    s.line(
      [
        [FOLD, SY0, SH],
        [SW, SY0, SH],
        [SW, Y1, SH],
        [0, Y1, SH],
        [0, SY0 + FOLD, SH],
        [FOLD, SY0, SH],
      ],
      'line',
      hero ? 1.2 : 1.4,
    )
    const b = 4.5
    s.poly(rect(b, SY0 + b, SW - b, Y1 - b, SH), 'none', 'detail')
    if (hero) {
      s.poly(rect(b + 1.8, SY0 + b + 1.8, SW - b - 1.8, Y1 - b - 1.8, SH), 'none', 'detail', 0.6)
      for (let v = 16; v <= sd - 8; v += 8) dot(2.3, SY0 + v, SH, 0.55)
    }
    stamp(sheetAt, 0, Math.min(fresh, sheetMarks.length))
    if (fresh < sheetMarks.length) stamp(sheetAt, fresh, fresh + 1)
    // The folded corner lies over the border and the first impressions.
    s.poly(
      [
        [FOLD, SY0, SH],
        [0, SY0 + FOLD, SH],
        [FOLD, SY0 + FOLD, SH],
      ],
      'side',
      'line',
    )

    // The tin: a shallow pan, rolled bead, opening, the inked pad sunk inside.
    s.rbox(PX, 0, 0, PW, PD, TIN - BEAD, 4.5, { top: 'front' })
    if (hero) {
      s.line(nearRun(roundRect(PX, 0, PW, PD, 4.5), 1.9), 'crease', 0.8)
      s.line(nearRun(roundRect(PX, 0, PW, PD, 4.5), 3.3), 'crease', 0.6)
    }
    s.rbox(PX - 0.6, -0.6, TIN - BEAD, PW + 1.2, PD + 1.2, BEAD, 5, { top: 'top' })
    s.poly(
      roundRect(PX + 3, 3, PW - 6, PD - 6, 4).map(([x, y]): P3 => [x, y, TIN]),
      'side',
      'crease',
    )
    s.poly(
      roundRect(PX + 4.6, 4.6, PW - 9.2, PD - 9.2, 3).map(([x, y]): P3 => [x, y, FELT_Z]),
      'shade',
      'crease',
    )
    if (hero) {
      // Pad: a few lines that fade out along their length.
      const fade = [0.9, 0.55, 0.22]
      for (const [x, y0] of [
        [PX + 9, 8],
        [PX + 14, 31],
        [PX + 38, 10],
        [PX + 41, 33],
        [PX + 22, 41],
      ]) {
        const len = 10
        for (let j = 0; j < 3; j++)
          s.poly(
            [
              [x, y0 + (len * j) / 3, FELT_Z],
              [x + 0.3, y0 + (len * (j + 0.5)) / 3, FELT_Z],
              [x + 0.6, y0 + (len * (j + 1)) / 3, FELT_Z],
            ],
            'none',
            'detail',
            fade[j],
            0.8,
          )
      }
    }

    // The stamp, standing on the pad: rubber die, rubber-mounted base, a short wooden knob.
    const z0 = FELT_Z
    cylZ(s, STX, STY, z0, R, 1.6, { top: 'side', body: 'side' }, 24)
    const zb = z0 + 1.6
    s.rbox(STX - 10.5, STY - 10.5, zb, 21, 21, 3.4, 3.4, { top: 'top' })
    s.rbox(STX - 8.8, STY - 8.8, zb + 3.4, 17.6, 17.6, 1.2, 2.6, { top: 'front' })
    if (hero)
      for (const [dx, dy] of [
        [-9.4, -9.4],
        [9.4, -9.4],
        [-9.4, 9.4],
        [9.4, 9.4],
      ])
        dot(STX + dx, STY + dy, zb + 3.4, 0.45)
    const zh = zb + 4.6
    cylZ(s, STX, STY, zh, 5.2, 1.4, { top: 'top', body: 'front' }, 20)
    cylZ(s, STX, STY, zh + 1.4, 3.4, 2.2, { top: 'front', body: 'side' }, 20)
    const zg = zh + 3.6
    const grip: [number, number][] = [
      [5, 1.4],
      [6.4, 2.2],
      [7, 3.2],
      [6.4, 2.2],
      [4.6, 1.4],
    ]
    let zz = zg
    for (const [r, h] of grip) {
      cylZ(s, STX, STY, zz, r, h, { top: 'top', body: 'front' }, 24)
      zz += h
    }
    if (hero) {
      ring(STX, STY, 7, zg + 4.4)
      ring(STX, STY, 7, zg + 5.4)
    }

    // The lid, upside down beside the tin: its inside faces up and takes the spilled impressions.
    s.rbox(PX, LY, 0, PW, LD, LH, 4.5, { top: 'top' })
    s.poly(
      roundRect(PX + 3, LY + 3, PW - 6, LD - 6, 2.6).map(([x, y]): P3 => [x, y, LH]),
      'side',
      'crease',
    )
    if (hero) {
      s.poly(
        roundRect(PX + 1.6, LY + 1.6, PW - 3.2, LD - 3.2, 3.4).map(([x, y]): P3 => [x, y, LH]),
        'none',
        'detail',
        0.8,
      )
      s.line(nearRun(roundRect(PX, LY, PW, LD, 4.5), 1.4), 'crease', 0.6)
    }
    stamp((u, v) => [PX + u, LY + v, LH], sheetMarks.length, fresh + 1)
    return s.done()
  },
}
