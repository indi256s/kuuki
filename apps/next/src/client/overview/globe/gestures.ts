import type { Map } from 'maplibre-gl'

export function attachGlobeGestures(map: Map, fullscreen: boolean, coarse: boolean) {
  if (coarse || fullscreen) map.cooperativeGestures.disable()
  else map.cooperativeGestures.enable()
  map.scrollZoom.enable()
  map.dragRotate.disable()
  map.touchPitch.disable()
  map.keyboard.disableRotation()
  map.touchZoomRotate.enable()
  map.touchZoomRotate.disableRotation()
  map.dragPan.enable()
}
