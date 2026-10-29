import type { AirportFeature, BuildingVolume, CameraPose, PointM } from './model'

export function buildingVolumes(
  feature: Extract<AirportFeature, { type: 'building' }>,
): BuildingVolume[] {
  if (!feature.renderFootprint) return []
  return (
    feature.volumeSlices ?? [
      {
        polygons: feature.polygons,
        minHeightM: feature.minHeight.metres,
        heightM: feature.height.metres,
      },
    ]
  )
}

/** Plan [east,north] maps to Three world (east,height,-north). */
export function worldPoint(point: PointM, height = 0): [number, number, number] {
  return [point[0], height, -point[1]]
}
/** Orthographic camera plane, metres; azimuth 0 places the camera south; positive angles move west. */
export function projectPoint(point: PointM, height: number, camera: CameraPose): PointM {
  const east = point[0] - camera.targetM[0]
  const north = point[1] - camera.targetM[1]
  const { azimuth: a, elevation: e } = camera
  return [
    east * Math.cos(a) - north * Math.sin(a),
    (east * Math.sin(a) + north * Math.cos(a)) * Math.sin(e) + height * Math.cos(e),
  ]
}
export function signedArea(ring: PointM[]): number {
  return (
    ring
      .slice(1)
      .reduce((sum, point, i) => sum + ring[i]![0] * point[1] - point[0] * ring[i]![1], 0) / 2
  )
}
export function containsPoint(ring: PointM[], point: PointM): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside
  }
  return inside
}
