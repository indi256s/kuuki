// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AtlasPager } from './pager'

const motion = vi.hoisted(() => ({
  reduced: false,
  finish: null as (() => void) | null,
}))
vi.mock('motion/react', () => ({
  useReducedMotion: () => motion.reduced,
  animate: (_from: number, _to: number, options: { onComplete?: () => void }) => {
    const controls = { stop() {} }
    motion.finish = () => options.onComplete?.()
    return controls
  },
}))
vi.mock('../../maps/mapcn', () => ({ useMap: () => ({ map, ready: true }) }))

const container = document.createElement('div')
const canvas = document.createElement('canvas')
container.appendChild(canvas)
Object.defineProperty(container, 'clientWidth', { value: 400 })
const resizes = new Set<() => void>()
const jumps: { center: [number, number]; zoom: number }[] = []
let frameCenter: [number, number] = [0, 20]
const map = {
  getContainer: () => container,
  getCanvas: () => canvas,
  getCenter: () => ({ lng: 0, lat: 20 }),
  getZoom: () => 2,
  cameraForBounds: () => ({ center: frameCenter, zoom: 2 }),
  jumpTo: (camera: { center: [number, number]; zoom: number }) => jumps.push(camera),
  on: (type: string, handler: () => void) => {
    if (type === 'resize') resizes.add(handler)
  },
  off: (type: string, handler: () => void) => {
    if (type === 'resize') resizes.delete(handler)
  },
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
  motion.reduced = false
  motion.finish = null
  frameCenter = [0, 20]
  jumps.length = 0
  resizes.clear()
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

// A swipe that ends back on its page leaves the camera on that page's frame, so a later resize or a reordered page
// list refits it instead of treating the camera as explored.
it.each(['animated', 'reduced'] as const)(
  'refits a %s page after a cancelled swipe when the map resizes',
  (motionMode) => {
    motion.reduced = motionMode === 'reduced'
    document.body.appendChild(container)
    const view = render(
      <AtlasPager
        locale="en"
        pages={[
          { id: 'world', codes: ['DE'] },
          { id: 'europe', codes: ['FR'] },
        ]}
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
    fireEvent.pointerMove(canvas, { ...press, clientX: 180 })
    fireEvent.pointerMove(canvas, { ...press, clientX: 170 })
    fireEvent.pointerCancel(canvas, press)
    motion.finish?.()

    frameCenter = [30, 40]
    jumps.length = 0
    resizes.forEach((measure) => measure())
    const [lng, lat] = jumps.at(-1)?.center ?? []
    expect(lng).toBeCloseTo(30)
    expect(lat).toBeCloseTo(40)

    view.unmount()
  },
)
