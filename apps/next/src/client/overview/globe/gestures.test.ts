// @vitest-environment jsdom
import type { Map } from 'maplibre-gl'
import { expect, it, vi } from 'vitest'
import { attachGlobeGestures, gestureAxis } from './gestures'
it('axis locks only after 10px, using the dominant axis', () => {
  expect(gestureAxis(3, 4)).toBeNull()
  expect(gestureAxis(12, 3)).toBe('x')
  expect(gestureAxis(4, 11)).toBe('y')
})
it('coarse vertical stays native, horizontal spins negatively, second finger releases to native handlers', () => {
  const handler = () => ({ enable: vi.fn(), disable: vi.fn(), enableRotation: vi.fn() })
  const map = { cooperativeGestures: handler(), scrollZoom: handler(), dragRotate: handler(), touchZoomRotate: handler(), touchPitch: handler(), dragPan: handler(),
    getCenter: () => ({ lng: 20, lat: 10 }), jumpTo: vi.fn() }
  const host = document.createElement('div'); document.body.appendChild(host)
  Object.defineProperties(host, { clientWidth: { value: 400 }, clientHeight: { value: 400 } })
  const detach = attachGlobeGestures(map as unknown as Map, host, false, true)
  const pointer = (type: string, id: number, x: number, y: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y }); host.dispatchEvent(event); return event
  }
  pointer('pointerdown', 1, 0, 0)
  expect(pointer('pointermove', 1, 3, 20).defaultPrevented).toBe(false)
  pointer('pointerup', 1, 3, 20)
  pointer('pointerdown', 2, 0, 0)
  expect(pointer('pointermove', 2, 20, 3).defaultPrevented).toBe(true)
  expect(map.jumpTo.mock.calls[0][0].center[0]).toBeCloseTo(20 - 20 / 200 * 180 / Math.PI)
  pointer('pointerdown', 3, 1, 0)
  expect(pointer('pointermove', 2, 40, 3).defaultPrevented).toBe(false)
  expect(map.jumpTo).toHaveBeenCalledTimes(1)
  expect(map.touchZoomRotate.enableRotation).toHaveBeenCalled()
  expect(map.touchPitch.enable).toHaveBeenCalled()
  expect(map.dragPan.disable).toHaveBeenCalled()
  expect(map.scrollZoom.disable).toHaveBeenCalled()
  detach(); pointer('pointerdown', 4, 0, 0); pointer('pointermove', 4, 30, 0)
  expect(map.jumpTo).toHaveBeenCalledTimes(1)
  host.remove()
})
