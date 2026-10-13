import type { Box, Pt, SvgNode, Weight } from '../grid'

export type Params = Record<string, unknown>
/** A kit module: pure function from a box and parameters to nodes. Ground is the bottom of the box. */
export type KitModule = (box: Box, params: Params) => SvgNode[]

export const num = (p: Params, key: string, fallback: number): number => {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
export const bool = (p: Params, key: string, fallback: boolean): boolean => {
  const v = p[key]
  return typeof v === 'boolean' ? v : fallback
}
export function str<T extends string>(
  p: Params,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = p[key]
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}
export const weight = (p: Params, key: string, fallback: Weight): Weight =>
  str(p, key, ['fine', 'hair', 'line', 'bold'] as const, fallback)
export const nums = (p: Params, key: string, fallback: number[]): number[] => {
  const v = p[key]
  return Array.isArray(v) && v.every((n) => typeof n === 'number') ? (v as number[]) : fallback
}
export const pairs = (p: Params, key: string, fallback: Pt[]): Pt[] => {
  const v = p[key]
  return Array.isArray(v) &&
    v.every((a) => Array.isArray(a) && a.length === 2 && a.every((n) => typeof n === 'number'))
    ? (v as Pt[])
    : fallback
}

/** x on the polyline `edge` (sorted by y ascending) at height y. */
export function xAtY(edge: Pt[], y: number): number {
  for (let i = 0; i + 1 < edge.length; i++) {
    const a = edge[i],
      b = edge[i + 1]
    if ((a[1] <= y && y <= b[1]) || (b[1] <= y && y <= a[1])) {
      if (a[1] === b[1]) return a[0]
      return a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
    }
  }
  return edge[edge.length - 1][0]
}
