// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }))
vi.mock('@kuuki/client/passport', () => ({
  addGroundVisit: api.add,
  deleteGroundVisit: api.remove,
}))
vi.mock('@kuuki/client/apiClient', () => ({ getAuthGeneration: () => 1 }))
vi.mock('../../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../../write-feedback', () => ({
  useWriteFeedback: () => ({ acknowledge: vi.fn(), status: 'idle' }),
}))
vi.mock('../../ui/use-mobile', () => ({ useMobile: () => false }))
// Tween stand-in: runs to its end on demand, so the tests decide when a fold finishes.
const tweens = vi.hoisted(() => ({
  running: [] as {
    keys: number[]
    to: number
    onUpdate?: (v: number) => void
    onComplete?: () => void
  }[],
}))
vi.mock('motion/react', async (original) => {
  const actual = await original<typeof import('motion/react')>()
  return {
    ...actual,
    useReducedMotion: () => false,
    // The sticker's single-value form: animate(start, keyframes, options). Other subjects (the toast's motion values)
    // go to the real library; an array as the subject would animate nothing there, so it must never reach this.
    animate: ((from: unknown, keys: unknown, options?: { onUpdate?: () => void }) => {
      if (typeof from !== 'number')
        return (actual.animate as (...args: unknown[]) => unknown)(from, keys, options)
      const frames = keys as number[]
      const tween = { keys: frames, to: frames[frames.length - 1], ...options }
      tweens.running.push(tween)
      return { stop: () => (tweens.running = tweens.running.filter((item) => item !== tween)) }
    }) as typeof actual.animate,
  }
})

// jsdom has no PointerEvent: without it, fireEvent drops pointerId, button and coordinates.
if (!('PointerEvent' in window))
  Object.assign(window, {
    PointerEvent: class extends MouseEvent {
      pointerId: number
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
      }
    },
  })

const container = document.createElement('div')
document.body.appendChild(container)
Object.defineProperty(container, 'clientWidth', { value: 800 })
Object.defineProperty(container, 'clientHeight', { value: 500 })
const canvas = document.createElement('canvas')
canvas.tabIndex = 0
container.appendChild(canvas)
// A flat camera: `scale` is 2 ** (zoom − 0) and `pan` shifts everything in screen pixels.
const camera = { scale: 1, pan: 0 }
const listeners = new Map<string, Set<(event: unknown) => void>>()
const emit = (name: string, event: unknown = {}) =>
  listeners.get(name)?.forEach((listener) => listener(event))
const map = {
  project: (at: [number, number] | { lng: number; lat: number }) => {
    const [lon, lat] = Array.isArray(at) ? at : [at.lng, at.lat]
    return { x: lon * 10 * camera.scale + 100 + camera.pan, y: lat * 10 * camera.scale + 100 }
  },
  getCenter: () => ({ lng: 10, lat: 10 }),
  getZoom: () => Math.log2(camera.scale),
  getContainer: () => container,
  getCanvas: () => canvas,
  fitBounds: vi.fn(),
  on: (name: string, listener: (event: unknown) => void) => {
    listeners.set(name, (listeners.get(name) ?? new Set()).add(listener))
  },
  off: (name: string, listener: (event: unknown) => void) => listeners.get(name)?.delete(listener),
}
vi.mock('../../maps/mapcn', () => ({ useMap: () => ({ map, ready: true }) }))

const { Sticker } = await import('./sticker')
const { useRecordVisit } = await import('./quick-visit')
const { ToastProvider } = await import('../../ui/toast')
import type { StickerHandle } from './sticker'

// Germany as a 200 × 200 px square on screen: big enough that the camera stays put.
const geometry = {
  rings: [
    [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
      [0, 0],
    ],
  ],
  centre: [10, 10] as [number, number],
}
const refresh = vi.fn(async () => {})
const handle: { current: StickerHandle | null } = { current: null }

// The page holds the writes; the sticker comes and goes with the map.
function Harness({ sticker = true }: { sticker?: boolean }) {
  const { record, recording } = useRecordVisit('owner', refresh)
  return (
    <>
      <output aria-label="Inked">{[...recording].join(' ')}</output>
      {sticker ? (
        <Sticker
          control={handle}
          locale="en"
          ownerId="owner"
          name={(code) => (code === 'DE' ? 'Germany' : code)}
          geometryOf={(code) => (code === 'DE' ? geometry : null)}
          record={record}
        />
      ) : null}
    </>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => ((resolve = yes), (reject = no)))
  return { promise, resolve, reject }
}
const flush = () => act(async () => {})
const page = (sticker = true) => (
  <ToastProvider>
    <Harness sticker={sticker} />
  </ToastProvider>
)
const lift = async () => {
  const view = render(page())
  act(() => handle.current!.lift('DE'))
  await flush()
  return { group: screen.getByRole('group', { name: 'Germany' }), view }
}
const inked = () => screen.getByRole('status', { name: 'Inked' }).textContent
const tab = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  camera.scale = 1
  camera.pan = 0
  listeners.clear()
  vi.useFakeTimers()
  tweens.running = []
  api.add.mockReset()
  api.remove.mockReset()
  refresh.mockClear()
})
afterEach(() => vi.useRealTimers())

it('lifts with four tabs, focuses the first, and a Train tap writes a land visit by rail', async () => {
  api.add.mockResolvedValue({ id: 'v1', derived_state: 'ready', revision: 1 })
  await lift()
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
    'By train',
    'By car',
    'By sea',
    'Other',
  ])
  expect(tab('By train')).toHaveFocus()

  fireEvent.click(tab('By train'))
  expect(api.add).toHaveBeenCalledExactlyOnceWith('owner', 'DE', {
    entryMethod: 'land',
    mode: 'rail',
  })
  expect(inked()).toBe('DE')
  // The toast arrives with the stamp's impact, three quarters into the tear.
  expect(screen.queryByText('Germany is in your passport.')).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTime(240))
  expect(screen.getByText('Germany is in your passport.')).toBeInTheDocument()
  expect(refresh).toHaveBeenCalled()
  // The refreshed collection has it now; the optimistic ink goes.
  expect(inked()).toBe('')
})

it('springs back without writing when a pull is released before the threshold', async () => {
  await lift()
  const train = tab('By train')
  // The tab hangs under the sticker (screen 100–300); a 60 px pull folds a tenth of it.
  train.getBoundingClientRect = () => ({ left: 180, top: 310, width: 40, height: 44 }) as DOMRect
  fireEvent.pointerDown(train, { pointerId: 1, button: 0, clientX: 200, clientY: 320 })
  fireEvent.pointerMove(train, { pointerId: 1, clientX: 200, clientY: 260 })
  fireEvent.pointerUp(train, { pointerId: 1, clientX: 200, clientY: 260 })
  fireEvent.click(train)
  expect(tweens.running.map((tween) => tween.to)).toEqual([0])
  expect(api.add).not.toHaveBeenCalled()
  expect(inked()).toBe('')
})

it('closes on Escape without writing and returns focus to the map', async () => {
  const { group } = await lift()
  fireEvent.keyDown(group, { key: 'Escape' })
  await act(async () => vi.advanceTimersByTime(150))
  expect(screen.queryByRole('group', { name: 'Germany' })).not.toBeInTheDocument()
  expect(canvas).toHaveFocus()
  expect(api.add).not.toHaveBeenCalled()
})

it('Undo pressed before the write returns deletes exactly the created row once it does', async () => {
  const write = deferred<{ id: string; derived_state: string }>()
  api.add.mockReturnValue(write.promise)
  api.remove.mockResolvedValue({ ok: true, derived_state: 'ready' })
  await lift()
  fireEvent.click(tab('By car'))
  expect(api.add).toHaveBeenCalledWith('owner', 'DE', { entryMethod: 'land', mode: 'road' })
  await act(async () => vi.advanceTimersByTime(240))
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(api.remove).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(150))
  expect(inked()).toBe('')

  await act(async () => write.resolve({ id: 'v7', derived_state: 'ready' }))
  await flush()
  expect(api.remove).toHaveBeenCalledExactlyOnceWith('owner', 'v7')
})

it('a failed write restores the country and offers to try again', async () => {
  const write = deferred<never>()
  api.add.mockReturnValueOnce(write.promise)
  await lift()
  fireEvent.click(tab('By sea'))
  expect(api.add).toHaveBeenCalledWith('owner', 'DE', { entryMethod: 'sea', mode: null })
  await act(async () => write.reject(new Error('offline')))
  await act(async () => vi.advanceTimersByTime(150))
  expect(inked()).toBe('')
  expect(
    screen.getByText('Could not add Germany. Check your connection and try again.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Germany is in your passport.')).not.toBeInTheDocument()

  api.add.mockResolvedValueOnce({ id: 'v2', derived_state: 'ready' })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(api.add).toHaveBeenLastCalledWith('owner', 'DE', { entryMethod: 'sea', mode: null })
  expect(inked()).toBe('DE')
  await flush()
  expect(screen.getByText('Germany is in your passport.')).toBeInTheDocument()
})

it('a later tear of the same country retires the earlier Retry', async () => {
  api.add.mockRejectedValueOnce(new Error('offline'))
  await lift()
  fireEvent.click(tab('By sea'))
  await act(async () => vi.advanceTimersByTime(150))
  const retry = screen.getByRole('button', { name: 'Try again' })

  api.add.mockResolvedValueOnce({ id: 'v3', derived_state: 'ready' })
  act(() => handle.current!.lift('DE'))
  await flush()
  fireEvent.click(tab('By train'))
  await act(async () => vi.advanceTimersByTime(240))
  fireEvent.click(retry)
  expect(api.add).toHaveBeenCalledTimes(2)
})

it('a sticker unmounted mid-tear still offers Undo for the write it started', async () => {
  api.add.mockResolvedValue({ id: 'v4', derived_state: 'ready' })
  const { view } = await lift()
  fireEvent.click(tab('By train'))
  // A switch to Cards before the stamp's impact.
  view.rerender(page(false))
  await flush()
  expect(screen.getByText('Germany is in your passport.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
})

const pressTrain = async () => {
  await lift()
  const train = tab('By train')
  train.getBoundingClientRect = () => ({ left: 180, top: 310, width: 40, height: 44 }) as DOMRect
  fireEvent.pointerDown(train, { pointerId: 1, button: 0, clientX: 200, clientY: 320 })
  return train
}

it('a press lifts the corner at once and its tap tears from there, not from rest', async () => {
  api.add.mockResolvedValue({ id: 'v5', derived_state: 'ready' })
  const train = await pressTrain()
  expect(tweens.running.map((tween) => tween.keys)).toEqual([[0, 0.06]])
  act(() => tweens.running[0].onUpdate?.(0.06))
  fireEvent.pointerUp(train, { pointerId: 1, clientX: 200, clientY: 320 })
  fireEvent.click(train)
  expect(tweens.running.map((tween) => tween.keys)).toEqual([[0.06, 1]])
  expect(api.add).toHaveBeenCalledOnce()
})

it('a flick tears by its momentum though released short of the threshold', async () => {
  api.add.mockResolvedValue({ id: 'v6', derived_state: 'ready' })
  const train = await pressTrain()
  fireEvent.pointerMove(train, { pointerId: 1, clientX: 200, clientY: 305 })
  act(() => vi.advanceTimersByTime(16))
  fireEvent.pointerMove(train, { pointerId: 1, clientX: 200, clientY: 285 })
  fireEvent.pointerUp(train, { pointerId: 1, clientX: 200, clientY: 285 })
  expect(api.add).toHaveBeenCalledExactlyOnceWith('owner', 'DE', {
    entryMethod: 'land',
    mode: 'rail',
  })
})

it('a tab grabbed during its spring-back keeps the fold on screen', async () => {
  const train = await pressTrain()
  fireEvent.pointerMove(train, { pointerId: 1, clientX: 200, clientY: 260 })
  fireEvent.pointerUp(train, { pointerId: 1, clientX: 200, clientY: 260 })
  act(() => tweens.running.at(-1)!.onUpdate?.(0.2))
  fireEvent.pointerDown(train, { pointerId: 2, button: 0, clientX: 200, clientY: 300 })
  expect(tweens.running.at(-1)!.keys).toEqual([0.2, 0.2])
})

it('follows the camera synchronously on move: one transform, no frame and no React commit', async () => {
  await lift()
  const follow = document.querySelector<SVGGElement>('.atlas-sticker-follow')!
  const outline = document.querySelector('.atlas-sticker-face')!.getAttribute('d')
  // Zoom in by 2 and pan 30px; Germany's corner (0, 0) was at (100, 100) and is now at (130, 100).
  camera.scale = 2
  camera.pan = 30
  emit('move')
  // Re-projecting at (1, 1) of the old drawing: x' = 2·x + (130 − 2·100 → −70), y' = 2·y − 100.
  expect(follow.style.transform).toBe('translate(-70px, -100px) scale(2)')
  expect(document.querySelector('.atlas-sticker-face')!.getAttribute('d')).toBe(outline)
  expect(screen.getByRole('group', { name: 'Germany' }).parentElement).toHaveAttribute(
    'data-moving',
  )
  // moveend re-projects once and starts the transform over.
  act(() => emit('moveend'))
  expect(follow.style.transform).toBe('')
  expect(document.querySelector('.atlas-sticker-face')!.getAttribute('d')).not.toBe(outline)
})

it("closes a lifted sticker on a member pan but not on the lift's own camera move", async () => {
  await lift()
  act(() => emit('movestart', {}))
  expect(screen.queryByRole('group', { name: 'Germany' })).not.toBeNull()
  act(() => emit('dragstart', { originalEvent: new MouseEvent('mousemove') }))
  act(() => {
    vi.advanceTimersByTime(300)
  })
  expect(screen.queryByRole('group', { name: 'Germany' })).toBeNull()
})
