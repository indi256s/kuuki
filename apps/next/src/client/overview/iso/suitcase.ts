import { Scene, roundRect, type IsoFigureData, type P3, type Paint } from './scene'
import { NZ, X, Y, cylY, cylZ, rrOn, shadowRect } from './solids'

/** How far the telescopic handle rises on hover, in iso units. */
const EXT = 22
const W = 116,
  D = 40,
  H = 82,
  BASE = 10,
  TOP = BASE + H,
  // The handle housing on the lid; the posts disappear into it.
  HOUSE_H = 4,
  HT = TOP + HOUSE_H,
  // Rest height of the grip's underside above the housing: the handle is collapsed, a sliver of post shows.
  GRIP_Z = HT + 4,
  GUARD = 14

type Slot = {
  // Fixed per slot: a sticker never moves or changes shape when another is added or lit.
  shape: 'circle' | 'rect'
  u: number
  v: number
  w: number
  h: number
  r: number
  tone: Paint
  size: number
}
const SLOTS: readonly Slot[] = [
  { shape: 'circle', u: 36, v: 22, w: 20, h: 20, r: 10, tone: 'ghost', size: 6.5 },
  { shape: 'rect', u: 62, v: 12, w: 26, h: 16, r: 3, tone: 'side', size: 6.5 },
  { shape: 'rect', u: 28, v: 52, w: 24, h: 14, r: 7, tone: 'side', size: 6.5 },
  { shape: 'rect', u: 64, v: 46, w: 30, h: 20, r: 3, tone: 'ghost', size: 8 },
]

/** The shell outline round the visible corners at height z: from the left silhouette, along the front, round the near corner, up the right face to the right silhouette. */
function wrap(z: number): P3[] {
  const out: P3[] = []
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 5; i++) {
      const a = ((a0 + ((a1 - a0) * i) / 5) * Math.PI) / 180
      out.push([cx + 8 * Math.cos(a), cy + 8 * Math.sin(a), z])
    }
  }
  arc(8, D - 8, 135, 90)
  arc(W - 8, D - 8, 90, 0)
  arc(W - 8, 8, 0, -45)
  return out
}

/** A wheel unit under the case: fork, tyre, rim and axle cap, then the bridge and swivel that meet the shell. */
function wheel(s: Scene, cx: number, y0: number) {
  const d = 4.5,
    cz = 4.6
  s.box(cx - 1.2, y0 - 1.1, 3.4, 2.4, 1.1, 5, { top: 'side', front: 'side', side: 'detail' })
  cylY(s, cx, y0, cz, 3.6, d, { face: 'front', body: 'side' }, 16)
  s.poly(s.circle([cx, y0 + d, cz], X, NZ, 0, 0, 2.1, 12), 'top', 'line', undefined, 0.6)
  s.box(cx - 1.2, y0 + d, 3.2, 2.4, 1.1, 5.2, { top: 'top', front: 'front', side: 'side' })
  const cap = s.circle([cx, y0 + d + 1.1, cz], X, NZ, 0, 0, 0.9, 8)
  s.poly(cap, 'detail', 'line', undefined, 0.5)
  s.box(cx - 3, y0 - 1.1, 8.4, 6, d + 2.2, 1, { top: 'top', front: 'front', side: 'side' })
  cylZ(s, cx, y0 + d / 2, 9.4, 2.2, 0.6, { top: 'side', body: 'front' }, 10)
}

/** A corner cap: wraps `path` (plan points) from z0 and rises to GUARD at its apex, flat across the corner. `dir` is 1 up from a bottom edge, -1 down from a top edge. */
function guard(
  s: Scene,
  path: (t: number) => [number, number],
  len: number,
  z0: number,
  dir: 1 | -1,
) {
  const n = 18,
    low: P3[] = [],
    high: P3[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len,
      [x, y] = path(t),
      h = GUARD * Math.min(1, 2 * (1 - Math.abs(t - len / 2) / (len / 2)))
    low.push([x, y, z0])
    high.push([x, y, z0 + dir * h])
  }
  s.poly([...low, ...high.reverse()], 'side', 'line', undefined, 0.8)
}

/** Countries & territories: a hard-shell suitcase on wheels, an IATA sticker per country on its front (the newest lit), and a telescopic handle that rises on hover. Part: `handle`. */
export function suitcase(
  k: number,
  { stickers, lit }: { stickers: readonly string[]; lit: number | null },
): IsoFigureData {
  const s = new Scene(k)
  const g = 0.6,
    [extX, extY] = s.vector(0, 0, EXT)
  shadowRect(s, 0, 0, W, D, 3)

  // Wheels hang under the shell, so the shell comes after them and covers their tops.
  for (const [x, y] of [
    [14, 3],
    [14, 33],
    [W - 14, 3],
    [W - 14, 33],
  ])
    wheel(s, x, y)
  s.rbox(0, 0, BASE, W, D, H, 8, { top: 'top', wall: 'front', side: 'side' })

  // Moulded rim round the lid.
  s.poly(
    roundRect(4, 4, W - 8, D - 8, 4).map(([a, b]) => [a, b, TOP] as P3),
    'none',
    'detail',
    undefined,
    0.8,
  )

  // Front face: ribs from lid edge to base edge, then the zip seam with its teeth.
  const F: P3 = [0, D, TOP],
    at = s.on(F, X, NZ)
  for (const u of [21, 99]) s.line([at(u, 0), at(u, H)], 'detail', 0.8)
  const tapeA = TOP - 39.8,
    tapeB = TOP - 42.2
  s.line(wrap(tapeA), 'detail', 0.8)
  s.line(wrap(tapeB), 'detail', 0.8)
  const rowA = wrap(tapeA),
    teeth: P3[][] = []
  // Teeth bridge the two tape lines: one tick per sampled step along the seam, ending on both.
  for (let i = 0; i < rowA.length - 1; i++) {
    const [x0, y0] = rowA[i],
      [x1, y1] = rowA[i + 1],
      len = Math.hypot(x1 - x0, y1 - y0),
      n = Math.max(1, Math.round(len / 2.6))
    for (let j = 0; j < n; j++) {
      const f = (j + 0.5) / n,
        x = x0 + (x1 - x0) * f,
        y = y0 + (y1 - y0) * f
      teeth.push([
        [x, y, tapeA],
        [x, y, tapeB],
      ])
    }
  }
  s.segs(teeth, 'detail', 0.6)

  // Corner guards: caps at the lid and base corners, rivets on the front.
  const arcLen = (Math.PI * 8) / 2
  const nearRight = (t: number): [number, number] => {
    if (t < 12) return [W + g, D - 20 + t]
    if (t < 12 + arcLen) {
      const a = (t - 12) / 8
      return [W - 8 + (8 + g) * Math.cos(a), D - 8 + (8 + g) * Math.sin(a)]
    }
    return [W - 8 - (t - 12 - arcLen), D + g]
  }
  const left = (t: number): [number, number] => {
    if (t < 12) return [20 - t, D + g]
    const a = Math.PI / 2 + (t - 12) / 8
    return [8 + (8 + g) * Math.cos(a), D - 8 + (8 + g) * Math.sin(a)]
  }
  const rightLen = 24 + arcLen,
    leftLen = 12 + arcLen / 2
  for (const [z0, dir] of [
    [BASE, 1],
    [TOP, -1],
  ] as const) {
    guard(s, nearRight, rightLen, z0, dir)
    guard(s, left, leftLen, z0, dir)
  }
  const FG = s.on([0, D + g, TOP], X, NZ)
  for (const [u, v] of [
    [W - 14, 3],
    [W - 14, H - 3],
    [14, 3],
    [14, H - 3],
  ])
    s.poly(s.circle(FG(u, v), X, NZ, 0, 0, 0.9, 8), 'detail', 'line', undefined, 0.5)

  // Right face: carry handle on a mounting plate.
  const R: P3 = [W, 0, TOP]
  s.poly(rrOn(s, R, Y, NZ, 9, 24, 22, 14, 3), 'top', 'line', undefined, 0.8)
  for (const [u, v] of [
    [14, 26.2],
    [14, 35.8],
    [26, 26.2],
    [26, 35.8],
  ])
    s.poly(s.circle(R, Y, NZ, u, v, 0.8, 8), 'detail', 'line', undefined, 0.5)
  s.box(W, 11, TOP - 36, 3, 3, 10, { top: 'top', front: 'front', side: 'side' })
  s.box(W, 14, TOP - 33.5, 4.5, 12, 5, { top: 'top', front: 'front', side: 'side' })
  s.box(W, 26, TOP - 36, 3, 3, 10, { top: 'top', front: 'front', side: 'side' })
  const grip = s.on([W + 4.5, 0, TOP - 28.5], Y, NZ)
  s.segs(
    [17.5, 20, 22.5].map((u) => [grip(u, 0), grip(u, 5)]),
    'detail',
    0.8,
  )

  // Stickers: each slot keeps its place; an empty slot draws nothing.
  const sh = (sl: Slot, inset: number): P3[] =>
    sl.shape === 'circle'
      ? s.circle(F, X, NZ, sl.u, sl.v, sl.r - inset, 24)
      : rrOn(
          s,
          F,
          X,
          NZ,
          sl.u + inset,
          sl.v + inset,
          sl.w - 2 * inset,
          sl.h - 2 * inset,
          Math.max(sl.r - inset, 0.5),
        )
  stickers.slice(0, SLOTS.length).forEach((code, i) => {
    const sl = SLOTS[i],
      on = i === lit,
      inner = sh(sl, 1.3)
    if (on) s.glow(5, () => s.poly(inner, 'accent', 'none'))
    s.poly(sh(sl, 0), 'top', 'line', undefined, 0.7)
    s.poly(inner, on ? 'accent' : sl.tone, on ? 'accent' : 'none')
    s.poly(sh(sl, 2.8), 'none', on ? 'on-accent' : 'line', 0.55, 0.5)
    const cu = sl.u + (sl.shape === 'circle' ? 0 : sl.w / 2),
      cv = sl.v + (sl.shape === 'circle' ? 0 : sl.h / 2)
    s.text(code, at(cu, cv + sl.size * 0.35), X, NZ, {
      size: sl.size,
      fill: on ? 'on-accent' : 'muted',
      weight: 700,
      mono: true,
      anchor: 'middle',
    })
  })

  // Zip pull: a slider on the seam with a tab hanging below it.
  s.poly(rrOn(s, F, X, NZ, 56.4, 44.2, 3.2, 9, 1.2), 'shadow', 'none')
  s.poly(rrOn(s, F, X, NZ, 55.4, 43, 3.2, 9, 1.2), 'front', 'line', undefined, 0.8)
  s.poly(s.circle(F, X, NZ, 57, 49.5, 0.9, 8), 'glass', 'line', undefined, 0.5)
  s.poly(rrOn(s, F, X, NZ, 54.5, 38, 5, 6, 1.2), 'top', 'line', undefined, 0.8)

  // ID plate low on the front: a window with two written lines, a screw at each end.
  s.poly(rrOn(s, F, X, NZ, 42, 69, 32, 10, 1.5), 'top', 'line', undefined, 0.8)
  s.poly(rrOn(s, F, X, NZ, 48, 71, 20, 6, 0.5), 'glass', 'line', undefined, 0.6)
  s.segs(
    [73, 75.2].map((v) => [at(48, v), at(68, v)]),
    'muted',
    0.6,
  )
  for (const u of [45, 71])
    s.poly(s.circle(F, X, NZ, u, 74, 0.9, 8), 'detail', 'line', undefined, 0.5)

  // Luggage-tag loop: a strap loop standing on a block at the lid's front right.
  s.box(90, 26, TOP, 8, 6, 2.5, { top: 'side', front: 'front', side: 'side' })
  const loop: P3 = [94, 29, TOP + 2.5],
    V: P3 = [0, 0, 1]
  s.poly(s.circle(loop, X, V, 0, 3.6, 3.6, 16), 'side', 'line', undefined, 0.9)
  s.poly(s.circle(loop, X, V, 0, 3.6, 1.7, 12), 'glass', 'line', undefined, 0.6)

  // Handle housing: slots the posts slide into, screws on its face.
  s.rbox(30, 16, TOP, 56, 8, HOUSE_H, 2, { top: 'top', wall: 'front', side: 'side' })
  for (const x of [34.5, 74.5])
    s.poly(
      [
        [x, 17.4, HT],
        [x + 7, 17.4, HT],
        [x + 7, 22.6, HT],
        [x, 22.6, HT],
      ],
      'glass',
      'line',
      undefined,
      0.6,
    )
  const HF = s.on([0, 24, HT], X, NZ)
  for (const u of [33, 83])
    s.poly(s.circle(HF(u, 2), X, NZ, 0, 0, 0.8, 8), 'detail', 'line', undefined, 0.5)

  // The handle: posts, the grip and its release button move together. The posts run well below the housing top and are clipped there, so no gap opens as they rise and their hidden length never shows.
  const clip: P3[] = []
  for (const x of [30, 86]) for (const y of [18, 22]) clip.push([x, y, HT])
  for (const x of [26, 90]) for (const y of [12, 28]) clip.push([x, y, HT + 60])
  s.group(
    'handle',
    () => {
      for (const x of [36, 76]) {
        s.box(x, 18, GRIP_Z - 36, 4, 4, 36, { top: 'top', front: 'front', side: 'side' })
        // Stage rings sit inside the housing at rest and slide into view as the posts rise.
        for (const z of [HT - 8, HT - 16])
          s.line(
            [
              [x, 22, z],
              [x + 4, 22, z],
              [x + 4, 18, z],
            ],
            'detail',
            0.8,
          )
        s.box(x - 1, 17, GRIP_Z - 1.5, 6, 6, 1.5, { top: 'side', front: 'side', side: 'detail' })
      }
      s.rbox(32, 16, GRIP_Z, 52, 8, 6, 3, { top: 'top', wall: 'front', side: 'side' })
      const GF = s.on([0, 24, GRIP_Z + 6], X, NZ)
      s.segs(
        [38, 42, 74, 78].map((u) => [GF(u, 0), GF(u, 6)]),
        'detail',
        0.8,
      )
      cylZ(s, 58, 20, GRIP_Z + 6, 3.6, 0.8, { top: 'side', body: 'front' }, 14)
      s.poly(
        s.circle([58, 20, GRIP_Z + 6.8], X, Y, 0, 0, 1.4, 10),
        'detail',
        'line',
        undefined,
        0.5,
      )
    },
    { clip, vars: { '--extend-x': `${extX}px`, '--extend-y': `${extY}px` } },
  )
  // Bounds cover the raised grip.
  s.include([
    [32, 16, GRIP_Z + 6 + EXT],
    [84, 16, GRIP_Z + 6 + EXT],
    [84, 24, GRIP_Z + 6 + EXT],
  ])
  return s.done()
}
