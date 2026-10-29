import { OrthographicCamera } from 'three'
import { projectPoint } from '../../../lib/airport-models/geometry'
import type { AirportFeature, BoundsM, CameraPose, PointM } from '../../../lib/airport-models/model'
import type { VisibleInsets } from './types'

export function applyCamera(
  camera: OrthographicCamera,
  pose: CameraPose,
  width: number,
  height: number,
  distance: number,
) {
  const half = pose.verticalSpanM / 2
  camera.left = (-half * width) / height
  camera.right = -camera.left
  camera.top = half
  camera.bottom = -half
  camera.near = 0.1
  camera.far = distance * 3
  const cos = Math.cos(pose.elevation)
  camera.position.set(
    pose.targetM[0] - Math.sin(pose.azimuth) * cos * distance,
    Math.sin(pose.elevation) * distance,
    -pose.targetM[1] + Math.cos(pose.azimuth) * cos * distance,
  )
  camera.lookAt(pose.targetM[0], 0, -pose.targetM[1])
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

function featurePoints(feature: AirportFeature): { point: PointM; height: number }[] {
  if (feature.type === 'point') return [{ point: feature.point, height: 0 }]
  if (feature.type === 'line') return feature.points.map((point) => ({ point, height: 0 }))
  const heights =
    feature.type === 'building' ? [feature.minHeight.metres, feature.height.metres] : [0]
  return feature.polygons.flatMap((polygon) =>
    polygon.outer.flatMap((point) => heights.map((height) => ({ point, height }))),
  )
}

/** Explicit fit only; opening a panel never calls this or changes metres per pixel. */
export function focusPose(
  feature: AirportFeature,
  pose: CameraPose,
  width: number,
  height: number,
  insets: Partial<VisibleInsets> = {},
): CameraPose {
  const left = Math.max(0, insets.left ?? 0),
    right = Math.max(0, insets.right ?? 0)
  const top = Math.max(0, insets.top ?? 0),
    bottom = Math.max(0, insets.bottom ?? 0)
  const availableWidth = Math.max(1, width - left - right),
    availableHeight = Math.max(1, height - top - bottom)
  const points = featurePoints(feature).map(({ point, height: h }) => projectPoint(point, h, pose))
  const bounds: BoundsM = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of points) {
    bounds[0] = Math.min(bounds[0], x)
    bounds[1] = Math.min(bounds[1], y)
    bounds[2] = Math.max(bounds[2], x)
    bounds[3] = Math.max(bounds[3], y)
  }
  if (!points.length) return pose
  const ppm =
    Math.min(
      availableWidth / Math.max(80, bounds[2] - bounds[0]),
      availableHeight / Math.max(80, bounds[3] - bounds[1]),
    ) / 1.25
  const x = (bounds[0] + bounds[2]) / 2 - (left - right) / 2 / ppm
  const y = (bounds[1] + bounds[3]) / 2 - (bottom - top) / 2 / ppm
  const northPlane = y / Math.sin(pose.elevation)
  return {
    ...pose,
    verticalSpanM: height / ppm,
    targetM: [
      pose.targetM[0] + x * Math.cos(pose.azimuth) + northPlane * Math.sin(pose.azimuth),
      pose.targetM[1] - x * Math.sin(pose.azimuth) + northPlane * Math.cos(pose.azimuth),
    ],
  }
}
