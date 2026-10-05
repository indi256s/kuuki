import { describe, expect, it } from 'vitest'
import { mapOptions } from './options'

describe('map interaction options', () => {
  it('lets plain wheel and one-finger swipes scroll the page; zoom needs a modifier, two fingers or the controls', () => {
    const options = mapOptions('en')
    // MapLibre ScrollZoomHandler returns before preventDefault() unless Ctrl/⌘ is held when cooperative gestures are on;
    // TouchPanHandler then needs two touches and the canvas gets touch-action: pan-x pan-y.
    expect(options.cooperativeGestures).toBe(true)
    expect(options.scrollZoom).toBe(true)
    expect(options.dragRotate).toBe(false)
    expect(options.touchPitch).toBe(false)
  })

  it('localizes the gesture hint', () => {
    expect(mapOptions('ru').locale?.['CooperativeGesturesHandler.MobileHelpText']).toBe('Чтобы сдвинуть карту, используйте два пальца')
    expect(mapOptions('en').locale?.['CooperativeGesturesHandler.WindowsHelpText']).toBe('Use Ctrl + scroll to zoom the map')
  })
})
