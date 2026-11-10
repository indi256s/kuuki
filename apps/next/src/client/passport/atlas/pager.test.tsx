// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AtlasPager } from './pager'

vi.mock('motion/react', () => ({
  useReducedMotion: () => false,
  animate: () => ({ stop() {} }),
}))
vi.mock('../../maps/mapcn', () => ({ useMap: () => ({ map, ready: true }) }))

const container = document.createElement('div')
const canvas = document.createElement('canvas')
container.appendChild(canvas)
Object.defineProperty(container, 'clientWidth', { value: 400 })
const map = {
  getContainer: () => container,
  getCanvas: () => canvas,
  getCenter: () => ({ lng: 0, lat: 20 }),
  getZoom: () => 2,
  cameraForBounds: () => ({ center: [0, 20], zoom: 2 }),
  jumpTo() {},
  on() {},
  off() {},
  cooperativeGestures: { enable() {}, disable() {} },
  doubleClickZoom: { enable() {}, disable() {} },
  dragPan: { enable() {}, disable() {} },
}

// jsdom lacks PointerEvent; retain the primary-pointer flag the pager uses to recognize pinches.
if (!('PointerEvent' in window))
  Object.assign(window, {
    PointerEvent: class extends MouseEvent {
      pointerId: number
      isPrimary: boolean
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.isPrimary = init.isPrimary ?? true
      }
    },
  })

afterEach(() => {
  canvas.onclick = null
  container.remove()
})

it.each(['swipe', 'scroll', 'pinch', 'cancel'] as const)(
  'does not deliver a %s release as a country click, and accepts the next tap',
  (gesture) => {
    document.body.appendChild(container)
    const selectCountry = vi.fn()
    canvas.onclick = selectCountry
    const view = render(
      <AtlasPager
        locale="en"
        pages={[{ id: 'world', codes: ['DE'] }]}
        page={0}
        onPage={vi.fn()}
        reframe={0}
        onProgress={vi.fn()}
        frameOf={() => [0, 0, 10, 10]}
        interrupt={vi.fn()}
        onPageZoom={vi.fn()}
      />,
    )
    const press = { pointerId: 1, isPrimary: true, button: 0, clientX: 200, clientY: 100 }
    fireEvent.pointerDown(canvas, press)
    if (gesture === 'swipe') {
      fireEvent.pointerMove(canvas, { ...press, clientX: 180 })
      fireEvent.pointerMove(canvas, { ...press, clientX: 80 })
    } else if (gesture === 'scroll') {
      fireEvent.pointerMove(canvas, { ...press, clientY: 130 })
    } else if (gesture === 'pinch') {
      fireEvent.pointerDown(canvas, { ...press, pointerId: 2, isPrimary: false })
    } else {
      fireEvent.pointerCancel(canvas, press)
    }
    fireEvent.pointerUp(canvas, press)
    // Touch browsers can deliver a compatibility click after pointerup. MapLibre listens inside this container.
    fireEvent.click(canvas, { detail: 1 })
    expect(selectCountry).not.toHaveBeenCalled()

    // Keyboard activation has no pointer press and must stay available after a gesture.
    fireEvent.click(canvas, { detail: 0 })
    expect(selectCountry).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(canvas, press)
    fireEvent.pointerUp(canvas, press)
    fireEvent.click(canvas, { detail: 1 })
    expect(selectCountry).toHaveBeenCalledTimes(2)

    view.unmount()
  },
)
