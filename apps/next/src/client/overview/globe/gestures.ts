import type { Map } from 'maplibre-gl'

export function gestureAxis(dx: number, dy: number, threshold = 10): 'x' | 'y' | null {
  return Math.max(Math.abs(dx), Math.abs(dy)) < threshold ? null : Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
}

/**
 * The globe never tilts or rolls: `globeZoom` fits the sphere at pitch 0, so any pitch or bearing pushes it off-centre inside its circle.
 * On touch, the card sits in a scrolling page, so only a horizontal one-finger drag turns it; vertical and two-finger gestures belong to the page.
 * Fullscreen has nothing to scroll, so there the globe takes one-finger drag and pinch.
 */
export function attachGlobeGestures(map: Map, host: HTMLElement, fullscreen: boolean, coarse: boolean) {
  map.cooperativeGestures.disable()
  if (fullscreen) map.scrollZoom.enable(); else map.scrollZoom.disable()
  map.dragRotate.disable()
  map.touchPitch.disable()
  map.touchZoomRotate.disableRotation()
  const pageScrolls = coarse && !fullscreen
  if (pageScrolls) { map.dragPan.disable(); map.touchZoomRotate.disable() } else { map.dragPan.enable(); map.touchZoomRotate.enable(); map.touchZoomRotate.disableRotation() }
  if (!pageScrolls) return undefined
  const pointers = new Set<number>()
  let start: { x: number; y: number; lng: number; axis: 'x' | 'y' | null } | null = null
  const down = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    pointers.add(event.pointerId)
    start = pointers.size === 1 ? { x: event.clientX, y: event.clientY, lng: map.getCenter().lng, axis: null } : null
  }
  const move = (event: PointerEvent) => {
    if (!start || pointers.size !== 1 || !pointers.has(event.pointerId)) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    start.axis ??= gestureAxis(dx, dy)
    if (start.axis !== 'x') return
    event.preventDefault()
    const radius = Math.max(1, Math.min(host.clientWidth, host.clientHeight) / 2)
    map.jumpTo({ center: [start.lng - dx / radius * 180 / Math.PI, map.getCenter().lat] })
  }
  const end = (event: PointerEvent) => { pointers.delete(event.pointerId); start = null }
  host.addEventListener('pointerdown', down)
  host.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  return () => {
    host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
  }
}
