import { describe, expect, it } from 'vitest'
import { fold, pointerAt, TEAR_THRESHOLD, type Point, type Ring } from './peel'

// A 100 × 100 sticker; the tab hangs under its bottom edge and is pulled up across it.
const square: Ring[] = [
  [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
]
const grab: Point = [50, 110]
const up: Point = [0, -1]

const reflect = (matrix: number[], [x, y]: Point): Point => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
]

describe('fold', () => {
  it('has no progress at the grab point or when pulled away from the sticker', () => {
    expect(fold(square, grab, grab)).toBeNull()
    expect(fold(square, grab, [50, 108])?.progress).toBe(0)
    expect(fold(square, grab, [50, 400])?.progress).toBe(0)
  })

  it('reflects the fold line onto itself and the grab onto the pointer', () => {
    const pointer: Point = [70, 20]
    const folded = fold(square, grab, pointer)!
    const [ox, oy] = folded.origin
    const along: Point = [ox - folded.normal[1] * 30, oy + folded.normal[0] * 30]
    for (const point of [folded.origin, along]) {
      const [x, y] = reflect(folded.matrix, point)
      expect(x).toBeCloseTo(point[0])
      expect(y).toBeCloseTo(point[1])
    }
    const [gx, gy] = reflect(folded.matrix, grab)
    expect(gx).toBeCloseTo(pointer[0])
    expect(gy).toBeCloseTo(pointer[1])
  })

  it('crosses the tear threshold exactly where pointerAt puts it', () => {
    const atThreshold = pointerAt(square, grab, up, TEAR_THRESHOLD)
    expect(fold(square, grab, atThreshold)?.progress).toBeCloseTo(TEAR_THRESHOLD)
    const short = pointerAt(square, grab, up, TEAR_THRESHOLD - 0.01)
    expect(fold(square, grab, short)!.progress).toBeLessThan(TEAR_THRESHOLD)
    expect(fold(square, grab, pointerAt(square, grab, up, 1))?.progress).toBe(1)
  })
})
