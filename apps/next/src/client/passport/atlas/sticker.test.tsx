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
  running: [] as { to: number; onUpdate?: (v: number) => void; onComplete?: () => void }[],
}))
vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => false,
  animate: (_from: number, to: number, options: { onUpdate?: () => void }) => {
    const tween = { to, ...options }
    tweens.running.push(tween)
    return { stop: () => (tweens.running = tweens.running.filter((item) => item !== tween)) }
  },
}))

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
const map = {
  project: ([lon, lat]: [number, number]) => ({ x: lon * 10 + 100, y: lat * 10 + 100 }),
  getContainer: () => container,
  getCanvas: () => canvas,
  fitBounds: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
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
const ink = vi.fn()
const refresh = vi.fn(async () => {})
const handle: { current: StickerHandle | null } = { current: null }

function Harness() {
  const record = useRecordVisit('owner', refresh)
  return (
    <Sticker
      control={handle}
      locale="en"
      ownerId="owner"
      name={(code) => (code === 'DE' ? 'Germany' : code)}
      geometryOf={(code) => (code === 'DE' ? geometry : null)}
      record={record}
      ink={ink}
    />
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => ((resolve = yes), (reject = no)))
  return { promise, resolve, reject }
}
const flush = () => act(async () => {})
const lift = async () => {
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  )
  act(() => handle.current!.lift('DE'))
  await flush()
  return screen.getByRole('group', { name: 'Germany' })
}
const tab = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  vi.useFakeTimers()
  tweens.running = []
  api.add.mockReset()
  api.remove.mockReset()
  ink.mockReset()
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
  expect(ink).toHaveBeenCalledWith('DE', true)
  // The toast arrives with the stamp's impact, three quarters into the tear.
  expect(screen.queryByText('Germany is in your passport.')).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTime(240))
  expect(screen.getByText('Germany is in your passport.')).toBeInTheDocument()
  expect(refresh).toHaveBeenCalled()
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
  expect(ink).not.toHaveBeenCalled()
})

it('closes on Escape without writing and returns focus to the map', async () => {
  const group = await lift()
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
  expect(ink).toHaveBeenLastCalledWith('DE', false)

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
  expect(ink).toHaveBeenLastCalledWith('DE', false)
  expect(
    screen.getByText('Could not add Germany. Check your connection and try again.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Germany is in your passport.')).not.toBeInTheDocument()

  api.add.mockResolvedValueOnce({ id: 'v2', derived_state: 'ready' })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(api.add).toHaveBeenLastCalledWith('owner', 'DE', { entryMethod: 'sea', mode: null })
  expect(ink).toHaveBeenLastCalledWith('DE', true)
  await flush()
  expect(screen.getByText('Germany is in your passport.')).toBeInTheDocument()
})
