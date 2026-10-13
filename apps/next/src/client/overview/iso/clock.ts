import { Scene, hull, roundRect, type P3 } from './scene'

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'
const SEG: Record<Seg, [readonly [number, number], readonly [number, number]]> = {
  a: [
    [1, 0],
    [9, 0],
  ],
  b: [
    [10, 1.2],
    [10, 8],
  ],
  c: [
    [10, 10],
    [10, 16.8],
  ],
  d: [
    [1, 18],
    [9, 18],
  ],
  e: [
    [0, 10],
    [0, 16.8],
  ],
  f: [
    [0, 1.2],
    [0, 8],
  ],
  g: [
    [1.2, 9],
    [8.8, 9],
  ],
}
const DIGIT: Record<string, string> = {
  0: 'abcdef',
  1: 'bc',
  2: 'abged',
  3: 'abgcd',
  4: 'fgbc',
  5: 'afgcd',
  6: 'afgedc',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
  '-': 'g',
}

/** How far the snooze bar travels, in iso units: a hover hint and a full press. */
const SNOOZE_DIP = 2,
  SNOOZE_PRESS = 3.25

/**
 * An alarm clock whose seven-segment display shows `time` ("HH:MM"; blanks leave it dark).
 * With `alt`, the display holds both readings: segments lit in both stay in `lit-both`, the rest split into `lit-a` (only `time`) and `lit-b` (only `alt`), so CSS can morph one reading into the other segment by segment.
 * The chapter figure keeps `lit-a` and `lit-b` mounted and swaps which one is shown, so a pick morphs the display. The colon belongs to `lit-both`. Each lit part holds a `backlight` (its glow) that CSS can raise; from k = 1 the display sits recessed behind a rim.
 * The body is a bedside alarm clock: feet, a bevelled bezel with screws round the display, a speaker grille and a set knob on its right wall, buttons on top, a mains cord with its plug.
 * Parts: `body`, `snooze` (carries --dip-y/--press-y), `display`, `lit-both`, `lit-a`, `lit-b`, `backlight`.
 */
export function clock(time: string, k = 1, alt?: string) {
  const s = new Scene(k)
  const X: P3 = [1, 0, 0],
    Y: P3 = [0, 1, 0],
    Z: P3 = [0, 0, 1]
  // The case: x 8..108, y 16..56, z 5..45. Its front wall carries the display, its right wall the grille and the knob.
  const BX = 8,
    BY = 16,
    BW = 100,
    BD = 40,
    ZB = 5,
    ZT = 45,
    YF = BY + BD
  // The bezel stands 1.4 proud of the front wall, so the opening (and the display's clip) lies on YB.
  const YB = YF + 1.4
  const cyl = (
    cx: number,
    cy: number,
    r: number,
    z0: number,
    z1: number,
    side: 'front' | 'side' = 'front',
  ) => {
    const a = s.circle([cx, cy, z0], X, Y, 0, 0, r, 20),
      b = s.circle([cx, cy, z1], X, Y, 0, 0, r, 20)
    s.poly2(hull(s.pp([...a, ...b])), side, 'line')
    s.poly(b, 'top', 'line')
  }
  /** Cylinder lying along x from x0 to x1, centred at (y, z) of the wall it stands on; its ridges run along it. */
  const axle = (x0: number, x1: number, y: number, z: number, r: number, ridges = 0) => {
    const a = s.circle([x0, 0, 0], Y, Z, y, z, r, 24),
      b = s.circle([x1, 0, 0], Y, Z, y, z, r, 24)
    s.poly2(hull(s.pp([...a, ...b])), 'front', 'line')
    for (let i = 0; i < 24; i += 2) {
      const t = (i / 24) * 2 * Math.PI
      if (ridges && Math.cos(t) + Math.sin(t) > 0.2) s.line([a[i], b[i]], 'crease', 0.7)
    }
    s.poly(b, 'top', 'line')
  }

  s.group('body', () => {
    s.poly(
      [
        [3, 13, 0],
        [114, 13, 0],
        [114, 64, 0],
        [3, 64, 0],
      ],
      'shadow',
      'none',
    )
    // Feet, back to front.
    for (const [x, y] of [
      [18, 24],
      [98, 24],
      [18, 48],
      [98, 48],
    ])
      cyl(x, y, 4.4, 0, ZB, 'side')
    s.rbox(BX, BY, ZB, BW, BD, ZT - ZB, 8)
    // The seam where the base shell meets the case: round the visible corners, edge to edge.
    const plan = roundRect(BX, BY, BW, BD, 8)
    const faces = plan.map(([x0, y0], i) => {
      const [x1, y1] = plan[(i + 1) % plan.length]
      return y1 - y0 + (x0 - x1) > 1e-6
    })
    const first = faces.findIndex((f, i) => f && !faces[(i + plan.length - 1) % plan.length])
    const run = [first]
    while (faces[run[run.length - 1]]) run.push((run[run.length - 1] + 1) % plan.length)
    s.line(
      run.map((i): P3 => [...plan[i], 12]),
      'crease',
    )
    // Speaker grille on the right wall: a plate with closed slots.
    const wall = (u: number, v: number): P3 => [BX + BW, u, v]
    s.poly([wall(27, 11), wall(45, 11), wall(45, 31), wall(27, 31)], 'none', 'crease')
    for (let i = 0; i < 6; i++)
      s.poly(
        roundRect(29.5, 13.4 + i * 3.1, 13, 1.7, 0.8, 3).map(([u, v]) => wall(u, v)),
        'shade',
        'crease',
      )
    // The set knob above it.
    axle(BX + BW, BX + BW + 3, 36, 38, 3.4, 1)
    // The cord leaves through a grommet at the back of the right wall.
    s.poly(s.circle([BX + BW, 0, 0], Y, Z, 28, 12, 2.4, 10), 'shade', 'detail')
    // Buttons along the back of the top.
    for (const x of [86, 96]) cyl(x, 24, 2.8, ZT, ZT + 2.2)
    // The slot: a recess with walls, exactly as wide as the bar's column, so the bar stands in it with a margin of 2.
    const slot = roundRect(42, 27, 32, 16, 1.5)
    s.poly(
      slot.map(([x, y]): P3 => [x, y, ZT]),
      'shade',
      'detail',
    )
    // Walls facing the viewer are the far ones: outward normal (dy, -dx) pointing away (nx + ny < 0).
    const far = slot.map(([x0, y0], i) => {
      const [x1, y1] = slot[(i + 1) % slot.length]
      return y1 - y0 + (x0 - x1) < -1e-6
    })
    const start = far.findIndex((f, i) => f && !far[(i + slot.length - 1) % slot.length])
    const wallRun = [start]
    while (far[wallRun[wallRun.length - 1]])
      wallRun.push((wallRun[wallRun.length - 1] + 1) % slot.length)
    s.poly(
      [
        ...wallRun.map((i): P3 => [...slot[i], ZT]),
        ...[...wallRun].reverse().map((i): P3 => [...slot[i], ZT - 2.5]),
      ],
      'side',
      'none',
    )
    // The cord: out of the grommet, down to the floor and over to the plug, which lies on it.
    const cord: P3[] = [
      [108, 28, 12],
      [112, 28, 12],
      [115.5, 28.5, 10],
      [117.5, 30, 6],
      [118.5, 33, 2.4],
      [119.5, 38, 1.4],
      [122, 43, 1.3],
      [124.5, 47, 1.3],
      [125.5, 51, 1.3],
    ]
    s.line(cord, 'line', 3)
    s.line(cord, 'front', 1.4)
    s.box(122, 51, 0, 7, 7, 4)
    s.box(123.6, 49.2, 0.4, 3.8, 1.8, 2.6, { stroke: 'crease' })
    for (const x of [123.4, 127.2])
      s.poly(
        [
          [x, 58, 2],
          [x + 1.2, 58, 2],
          [x + 1.2, 62, 2],
          [x, 62, 2],
        ],
        'side',
        'line',
      )
  })
  // The clip is the bar's own column over the slot, so a press sinks it into the opening instead of sliding over the top.
  const column: P3[] = []
  for (const x of [42, 74])
    for (const y of [27, 43]) for (const z of [ZT, ZT + 5]) column.push([x, y, z])
  s.group('snooze', () => s.box(44, 29, 41, 28, 12, 7.5), {
    clip: column,
    vars: {
      '--dip-y': `${s.vector(0, 0, -SNOOZE_DIP)[1]}px`,
      '--press-y': `${s.vector(0, 0, -SNOOZE_PRESS)[1]}px`,
    },
  })
  // The display plane sits on the bezel's opening at y = YB; from k = 1 it is one unit deeper, with everything on it clipped to the 72×32 aperture.
  const recess = k >= 1
  const U: P3 = [1, 0, 0],
    V: P3 = [0, 0, -1]
  const wall = s.on([22, YB, 41], U, V)
  const O: P3 = [22, recess ? YB - 1 : YB, 41]
  const at = s.on(O, U, V)
  const aperture = [wall(0, 0), wall(72, 0), wall(72, 32), wall(0, 32)]
  const clip = recess ? aperture : undefined
  // Each digit cell starts 14 units after the last; the colon adds 5 more after the hours.
  const cells = [7, 21, 40, 54]
  const seg = (cell: number, key: Seg) => SEG[key].map(([u, v]) => at(cell + u * 1.05, 7 + v))
  const a = time.replace(':', ''),
    b = (alt ?? time).replace(':', '')
  const ghost: P3[][] = [],
    both: P3[][] = [],
    onlyA: P3[][] = [],
    onlyB: P3[][] = []
  cells.forEach((cell, i) => {
    for (const key of Object.keys(SEG) as Seg[]) {
      const inA = DIGIT[a[i]]?.includes(key) ?? false,
        inB = DIGIT[b[i]]?.includes(key) ?? false
      const path = seg(cell, key)
      // Unlit segments stay visible as ghosts; a lit one covers its ghost exactly.
      ghost.push(path)
      if (inA && inB) both.push(path)
      else if (inA) onlyA.push(path)
      else if (inB) onlyB.push(path)
    }
  })
  const face = () => {
    s.poly([at(0, 0), at(72, 0), at(72, 32), at(0, 32)], 'glass', 'line')
    s.segs(ghost, 'ghost', 2.2)
  }
  s.group('display', () => {
    if (!recess) return face()
    // The backing darkens the wall tone where the plane is offset, the plane covers the rest, and the rim outline closes the opening.
    s.poly(aperture, 'shade', 'none')
    s.group('face', face, { clip })
    s.poly(aperture, 'none', 'line')
  })
  // The colon is lit in both readings, so it glows with the digits.
  const dots = [12, 20].map((v) => s.circle(O, U, V, 35.5, v, 1.3, 10))
  const lit = (part: string, list: P3[][], colon: P3[][] = []) =>
    s.group(
      part,
      () => {
        if (!list.length && !colon.length) return
        const draw = () => {
          if (list.length) s.segs(list, 'accent', 2.4)
          for (const dot of colon) s.poly(dot, 'accent', 'accent')
        }
        s.group('backlight', () => s.glow(2.9, draw))
        draw()
      },
      { clip },
    )
  // A blank display (no digits) is unlit, colon included.
  lit('lit-both', both, (a + b).trim() ? dots : [])
  lit('lit-a', onlyA)
  lit('lit-b', onlyB)
  // The bezel closes the opening: four bevelled strips, with a screw in each corner.
  s.box(18, YF, 41, 80, 1.4, 2.5)
  s.box(18, YF, 6.5, 80, 1.4, 2.5)
  s.box(18, YF, 9, 4, 1.4, 32)
  s.box(94, YF, 9, 4, 1.4, 32)
  for (const [x, z] of [
    [20.2, 42.25],
    [95.8, 42.25],
    [20.2, 7.75],
    [95.8, 7.75],
  ])
    s.poly(s.circle([x, YB, z], X, Z, 0, 0, 0.55, 8), 'detail', 'line')
  return s.done()
}
