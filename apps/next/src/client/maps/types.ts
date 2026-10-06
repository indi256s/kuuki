import type { ProjectedRoute } from '@kuuki/shared'
export type { ProjectedRoute, RouteProjection } from '@kuuki/shared'

/** Cheap list cue; geometry generator still validates the actual sampled line. */
export function hasDrawableEndpoints(route: ProjectedRoute): boolean {
  const { from, to } = route
  if (!from || !to || [...from, ...to].some(value => !Number.isFinite(value)) ||
    Math.abs(from[0]) > 180 || Math.abs(to[0]) > 180 || Math.abs(from[1]) > 90 || Math.abs(to[1]) > 90) return false
  const [a, b, c, d] = [from[0], from[1], to[0], to[1]].map(value => value * Math.PI / 180)
  const dot = Math.sin(b) * Math.sin(d) + Math.cos(b) * Math.cos(d) * Math.cos(a - c)
  return dot < 0.99999999 && dot > -0.99999999
}
