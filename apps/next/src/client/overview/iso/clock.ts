import { Scene, roundRect, type P3 } from './scene'

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
 * Parts: `body`, `snooze` (carries --dip-y/--press-y), `display`, `lit-both`, `lit-a`, `lit-b`, `backlight`.
 */
export function clock(time: string, k = 1, alt?: string) {
  const s = new Scene(k)
  s.group('body', () => {
    s.rbox(0, 0, 0, 118, 76, 5, 7, { wall: 'side', top: 'front' })
    s.rbox(14, 16, 5, 88, 40, 40, 8)
    // The slot rim: an opening one unit outside the bar, its far walls one unit deep, so a pressed bar sinks into it rather than into a solid top.
    const rim = roundRect(43, 25, 30, 14, 1.5)
    s.poly(
      rim.map(([x, y]): P3 => [x, y, 45]),
      'shadow',
      'detail',
    )
    // Walls facing the viewer are the far ones: outward normal (dy, -dx) pointing away (nx + ny < 0).
    const far = rim.map(([x0, y0], i) => {
      const [x1, y1] = rim[(i + 1) % rim.length]
      return y1 - y0 + (x0 - x1) < -1e-6
    })
    const start = far.findIndex((f, i) => f && !far[(i + rim.length - 1) % rim.length])
    const run = [start]
    while (far[run[run.length - 1]]) run.push((run[run.length - 1] + 1) % rim.length)
    s.poly(
      [
        ...run.map((i): P3 => [...rim[i], 45]),
        ...[...run].reverse().map((i): P3 => [...rim[i], 44]),
      ],
      'side',
      'none',
    )
  })
  // The clip is the bar's own column over the slot, so a press sinks it into the opening instead of sliding over the top.
  const column: P3[] = []
  for (const x of [43, 73])
    for (const y of [25, 39]) for (const z of [45, 50]) column.push([x, y, z])
  s.group('snooze', () => s.box(44, 26, 41, 28, 12, 7.5), {
    clip: column,
    vars: {
      '--dip-y': `${s.vector(0, 0, -SNOOZE_DIP)[1]}px`,
      '--press-y': `${s.vector(0, 0, -SNOOZE_PRESS)[1]}px`,
    },
  })
  // The display plane is flush with the front wall at y = 56; from k = 1 it sits one unit deeper behind a rim, with everything on it clipped to the 72×32 aperture.
  const recess = k >= 1
  const U: P3 = [1, 0, 0],
    V: P3 = [0, 0, -1]
  const wall = s.on([22, 56, 41], U, V)
  const O: P3 = [22, recess ? 55 : 56, 41]
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
    // The inner walls show where the plane is offset: the backing darkens the wall tone, the plane covers the rest, and the rim outline closes the opening.
    s.poly(aperture, 'shadow', 'none')
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
  return s.done()
}
