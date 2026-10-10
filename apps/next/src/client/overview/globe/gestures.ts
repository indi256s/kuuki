import type { Map } from 'maplibre-gl'

/**
 * The globe never tilts or rolls: `globeZoom` fits the sphere at pitch 0, so any pitch or bearing would skew the cover fit.
 * Zoom only grows the sphere past the fit (see `GLOBE_ZOOM_RANGE`); it never tilts.
 * A one-finger drag turns the globe in both directions, also on touch, so the page scrolls only from outside the globe. A pinch zooms it.
 * With a mouse, the inline card zooms on Ctrl/⌘ + wheel or trackpad pinch (cooperative gestures), so a plain wheel still scrolls the page.
 * Fullscreen has nothing to scroll, so there a plain wheel zooms too.
 */
export function attachGlobeGestures(map: Map, fullscreen: boolean, coarse: boolean) {
  if (coarse || fullscreen) map.cooperativeGestures.disable()
  else map.cooperativeGestures.enable()
  map.scrollZoom.enable()
  map.dragRotate.disable()
  map.touchPitch.disable()
  // Shift + arrows would otherwise tilt and turn it; arrows and +/− still pan and zoom.
  map.keyboard.disableRotation()
  map.touchZoomRotate.enable()
  map.touchZoomRotate.disableRotation()
  map.dragPan.enable()
}
