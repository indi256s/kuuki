import { Scene, type P3 } from './scene'

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
}

/** How far the snooze bar travels, in iso units: a hover hint and a full press. */
export const SNOOZE_DIP = 1.5,
  SNOOZE_PRESS = 2.5

/**
 * Earliest departure: an alarm clock whose seven-segment display shows `time` ("HH:MM").
 * With `alt`, the display holds both readings: segments lit in both stay in `lit-both`, the rest split into `lit-a` (only `time`) and `lit-b` (only `alt`), so CSS can morph one reading into the other segment by segment.
 * Parts: `body`, `snooze` (carries --dip-y/--press-y), `display`, `lit-both`, `lit-a`, `lit-b`, `colon`.
 */
export function clock(time: string, k = 1, alt?: string) {
  const s = new Scene(k)
  s.group('body', () => {
    s.rbox(0, 0, 0, 118, 76, 5, 7, { top: 'front' })
    s.rbox(14, 16, 5, 88, 40, 40, 8)
  })
  // The clip is the bar's own column above the body, so a press sinks it into the top instead of sliding over it.
  const column: P3[] = []
  for (const x of [44, 72])
    for (const y of [26, 38]) for (const z of [45, 50]) column.push([x, y, z])
  s.group('snooze', () => s.box(44, 26, 45, 28, 12, 3.5), {
    clip: column,
    vars: {
      '--dip-y': `${s.vector(0, 0, -SNOOZE_DIP)[1]}px`,
      '--press-y': `${s.vector(0, 0, -SNOOZE_PRESS)[1]}px`,
    },
  })
  const O: P3 = [22, 56, 41],
    U: P3 = [1, 0, 0],
    V: P3 = [0, 0, -1]
  const at = s.on(O, U, V)
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
  s.group('display', () => {
    s.poly([at(0, 0), at(72, 0), at(72, 32), at(0, 32)], 'glass', 'line')
    s.segs(ghost, 'ghost', 2.2)
  })
  const lit = (part: string, list: P3[][]) =>
    s.group(part, () => {
      if (!list.length) return
      s.glow(3.5, () => s.segs(list, 'accent', 2.4))
      s.segs(list, 'accent', 2.4)
    })
  lit('lit-both', both)
  lit('lit-a', onlyA)
  lit('lit-b', onlyB)
  s.group('colon', () => {
    for (const v of [12, 20]) s.poly(s.circle(O, U, V, 35.5, v, 1.3, 10), 'accent', 'accent')
  })
  return s.done()
}
