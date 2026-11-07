// Fold geometry of the atlas sticker: pure screen-space maths, no DOM. A sticker peeled by its tab folds along the
// perpendicular bisector of grab → pointer; the grab side is the flap (reflected over that line), the rest stays stuck.

export type Point = readonly [number, number]
export type Ring = readonly Point[]

/** A completed tear needs the fold to have crossed this share of the sticker. */
export const TEAR_THRESHOLD = 0.4
/** A pointer that moves further than this (px) after pressing a tab is a pull, not a tap. */
export const PULL_SLOP = 6

/** Projects geographic rings ([lon, lat]) into screen rings with the map's own projection. */
export function projectOutline(
  rings: readonly (readonly (readonly number[])[])[],
  project: (lngLat: [number, number]) => { x: number; y: number },
): Point[][] {
  return rings.map((ring) =>
    ring.map(([lon, lat]) => {
      const { x, y } = project([lon, lat])
      return [x, y] as const
    }),
  )
}

export function bounds(rings: readonly Ring[]) {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity
  for (const ring of rings)
    for (const [x, y] of ring) {
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

export type Fold = {
  /** A point on the fold line (the midpoint of grab → pointer). */
  origin: Point
  /** Unit pull direction, grab → pointer; also the fold line's normal. */
  normal: Point
  /** SVG `matrix(a b c d e f)` reflecting a point over the fold line. */
  matrix: [number, number, number, number, number, number]
  /** 0 before the fold reaches the sticker, 1 once it has crossed it. */
  progress: number
}

/** Extent of the sticker along `normal`, measured from `grab`. */
function extent(rings: readonly Ring[], grab: Point, normal: Point) {
  let min = Infinity,
    max = -Infinity
  for (const ring of rings)
    for (const [x, y] of ring) {
      const along = (x - grab[0]) * normal[0] + (y - grab[1]) * normal[1]
      min = Math.min(min, along)
      max = Math.max(max, along)
    }
  return { min: Math.max(0, min), max: Math.max(0, max) }
}

/** The fold for a pull from `grab` to `pointer`; null while they coincide (no direction yet). */
export function fold(rings: readonly Ring[], grab: Point, pointer: Point): Fold | null {
  const dx = pointer[0] - grab[0],
    dy = pointer[1] - grab[1]
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) return null
  const normal: Point = [dx / length, dy / length]
  const origin: Point = [grab[0] + dx / 2, grab[1] + dy / 2]
  const { min, max } = extent(rings, grab, normal)
  // Pulling away from the sticker never peels it.
  const progress = max > min ? clamp01((length / 2 - min) / (max - min)) : 0
  const [nx, ny] = normal
  const offset = 2 * (origin[0] * nx + origin[1] * ny)
  return {
    origin,
    normal,
    matrix: [
      1 - 2 * nx * nx,
      -2 * nx * ny,
      -2 * nx * ny,
      1 - 2 * ny * ny,
      offset * nx,
      offset * ny,
    ],
    progress,
  }
}

/** The pointer position at which a pull from `grab` along `direction` reaches `progress`: drives a tear by itself. */
export function pointerAt(
  rings: readonly Ring[],
  grab: Point,
  direction: Point,
  progress: number,
): Point {
  const length = Math.hypot(direction[0], direction[1]) || 1
  const normal: Point = [direction[0] / length, direction[1] / length]
  const { min, max } = extent(rings, grab, normal)
  const distance = 2 * (min + clamp01(progress) * (max - min))
  return [grab[0] + normal[0] * distance, grab[1] + normal[1] * distance]
}

/**
 * A polygon covering the half-plane on one side of the fold line: `stuck` is beyond the fold (away from the grab),
 * `flap` is the grab side. Large enough to cover any sticker on screen.
 */
export function halfPlane(fold: Pick<Fold, 'origin' | 'normal'>, side: 'stuck' | 'flap'): Point[] {
  const size = 1e5
  const [ox, oy] = fold.origin
  const [nx, ny] = fold.normal
  const sign = side === 'stuck' ? 1 : -1
  const tx = -ny,
    ty = nx
  return [
    [ox + tx * size, oy + ty * size],
    [ox - tx * size, oy - ty * size],
    [ox - tx * size + sign * nx * size, oy - ty * size + sign * ny * size],
    [ox + tx * size + sign * nx * size, oy + ty * size + sign * ny * size],
  ]
}

export function pathOf(rings: readonly Ring[]): string {
  return rings
    .filter((ring) => ring.length > 2)
    .map((ring) => `M${ring.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`)
    .join('')
}

const round = (value: number) => Math.round(value * 10) / 10
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
