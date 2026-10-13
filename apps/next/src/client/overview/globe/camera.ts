/**
 * The zoom at which the perspective sphere has a given on-screen size. MapLibre uses 512px tiles.
 * `contain` shows the whole sphere with a 16px margin: the resting view and zoom-out limit.
 * `cover` fills the whole viewport, corners included, and anchors the zoom-in limit.
 */
export function globeZoom(
  width: number,
  height: number,
  latitude: number,
  fieldOfView: number,
  fit: 'cover' | 'contain' = 'contain',
): number {
  latitude = Math.max(-85.051129, Math.min(85.051129, latitude))
  const distance = height / (2 * Math.tan((fieldOfView * Math.PI) / 360))
  const visibleRadius =
    fit === 'cover' ? Math.hypot(width, height) / 2 : Math.max(1, Math.min(width, height) / 2 - 16)
  const radius =
    visibleRadius * (visibleRadius / distance + Math.sqrt(1 + (visibleRadius / distance) ** 2))
  return Math.log2((2 * Math.PI * radius * Math.cos((latitude * Math.PI) / 180)) / 512)
}

/** How far the reader may zoom in past the cover fit: a few cities' worth of detail. */
export const GLOBE_ZOOM_RANGE = 5
