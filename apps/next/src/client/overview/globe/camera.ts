/** Fit the perspective sphere so it covers the whole viewport, corners included. MapLibre uses 512px tiles. */
export function globeZoom(
  width: number,
  height: number,
  latitude: number,
  fieldOfView: number,
): number {
  latitude = Math.max(-85.051129, Math.min(85.051129, latitude))
  const distance = height / (2 * Math.tan((fieldOfView * Math.PI) / 360))
  const visibleRadius = Math.hypot(width, height) / 2
  const radius =
    visibleRadius * (visibleRadius / distance + Math.sqrt(1 + (visibleRadius / distance) ** 2))
  return Math.log2((2 * Math.PI * radius * Math.cos((latitude * Math.PI) / 180)) / 512)
}

/** How far the reader may zoom: never smaller than the cover fit, up to a few cities' worth of detail. */
export const GLOBE_ZOOM_RANGE = 5
