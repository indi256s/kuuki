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
