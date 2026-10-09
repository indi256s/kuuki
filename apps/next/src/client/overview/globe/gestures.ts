import type { Map } from 'maplibre-gl'

export function gestureAxis(dx: number, dy: number, threshold = 10): 'x' | 'y' | null {
  return Math.max(Math.abs(dx), Math.abs(dy)) < threshold
    ? null
    : Math.abs(dx) > Math.abs(dy)
      ? 'x'
      : 'y'
}

/**
 * The globe never tilts or rolls: `globeZoom` fits the sphere at pitch 0, so any pitch or bearing pushes it off-centre inside its circle.
 * Zoom only grows the sphere past the rim (see `GLOBE_ZOOM_RANGE`); it never tilts.
 * On touch, the card sits in a scrolling page, so a horizontal one-finger drag turns it, a pinch zooms it, and vertical one-finger swipes belong to the page.
 * With a mouse, the inline card zooms on Ctrl/⌘ + wheel or trackpad pinch (cooperative gestures), so a plain wheel still scrolls the page.
 * Fullscreen has nothing to scroll, so there the globe takes one-finger drag, plain wheel and pinch.
 */
export function attachGlobeGestures(
  map: Map,
  host: HTMLElement,
  fullscreen: boolean,
  coarse: boolean,
) {
  if (coarse || fullscreen) map.cooperativeGestures.disable()
  else map.cooperativeGestures.enable()
  map.scrollZoom.enable()
  map.dragRotate.disable()
  map.touchPitch.disable()
  // Shift + arrows would otherwise tilt and turn it; arrows and +/− still pan and zoom.
  map.keyboard.disableRotation()
  const pageScrolls = coarse && !fullscreen
  map.touchZoomRotate.enable()
  map.touchZoomRotate.disableRotation()
  if (pageScrolls) map.dragPan.disable()
  else map.dragPan.enable()
  if (!pageScrolls) return undefined
  const pointers = new Set<number>()
  let start: { x: number; y: number; lng: number; axis: 'x' | 'y' | null } | null = null
  const down = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    pointers.add(event.pointerId)
    start =
      pointers.size === 1
        ? { x: event.clientX, y: event.clientY, lng: map.getCenter().lng, axis: null }
        : null
  }
  const move = (event: PointerEvent) => {
    if (!start || pointers.size !== 1 || !pointers.has(event.pointerId)) return
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y
    start.axis ??= gestureAxis(dx, dy)
    if (start.axis !== 'x') return
    event.preventDefault()
    // The sphere's on-screen radius at the current zoom, so one finger-width turns it the same amount at any zoom.
    const radius = Math.max(
      1,
      (512 * 2 ** map.getZoom()) / (2 * Math.PI * Math.cos((map.getCenter().lat * Math.PI) / 180)),
    )
    map.jumpTo({ center: [start.lng - ((dx / radius) * 180) / Math.PI, map.getCenter().lat] })
  }
  const end = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    start = null
  }
  host.addEventListener('pointerdown', down)
  host.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  return () => {
    host.removeEventListener('pointerdown', down)
    host.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
  }
}
