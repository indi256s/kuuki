export type Point = readonly [number, number]
export type Ring = readonly Point[]

export const PULL_SLOP = 6

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

export function pathOf(rings: readonly Ring[]): string {
  return rings
    .filter((ring) => ring.length > 2)
    .map((ring) => `M${ring.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`)
    .join('')
}

const round = (value: number) => Math.round(value * 10) / 10
