import type { P3, Paint, Pt, Scene } from './scene'

// Helpers for figures drawn on a floor plan: plan polygons, lettering lying on the floor, and the unit axes. Browser-safe: no Node imports.

export const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  Zd: P3 = [0, 0, -1]

/** English three-letter months, the fallback for a figure whose caller did not pass localized ones. */
export const MON = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const

export const rad = (d: number) => (d * Math.PI) / 180

/** Maps plan coordinates (u, v) at height z to 3D; a plan turned by some angle supplies its own. */
export type PlanAt = (u: number, v: number, z: number) => P3

/** The unturned plan: u is x, v is y. */
export const onPlan: PlanAt = (u, v, z) => [u, v, z]

/** Plan polygon at height z. */
export const flat = (pts: readonly Pt[], z: number): P3[] => pts.map(([x, y]) => [x, y, z])

/** Text lying on a plan rectangle turned by `deg`, centred at (u, v) of that rectangle. */
export function flatText(
  s: Scene,
  at: PlanAt,
  deg: number,
  text: string,
  u: number,
  v: number,
  z: number,
  o: {
    size: number
    fill?: Paint
    weight?: number
    mono?: boolean
    anchor?: 'start' | 'middle' | 'end'
  },
) {
  const c = Math.cos(rad(deg)),
    q = Math.sin(rad(deg))
  s.text(text, at(u, v + o.size * 0.36, z), [c, q, 0], [-q, c, 0], {
    size: o.size,
    fill: o.fill ?? 'ink',
    weight: o.weight ?? 600,
    mono: o.mono ?? true,
    anchor: o.anchor ?? 'middle',
  })
}
