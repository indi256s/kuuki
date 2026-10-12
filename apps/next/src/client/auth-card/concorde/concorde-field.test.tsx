// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConcordeField } from './concorde-field'
import { TURN } from './turn.generated.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('discards ordering diagnostics while the visible model keeps turning', async () => {
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  let intersect!: (entries: { isIntersecting: boolean }[]) => void
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof intersect) {
        intersect = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = { onmessage: null, close() {} }
      port2 = { postMessage() {} }
    },
  )
  const mount = vi.spyOn(TURN, 'mount')
  render(<ConcordeField />)
  await waitFor(() => expect(mount).toHaveBeenCalled())
  const controller = mount.mock.results[0]!.value
  act(() => {
    intersect([{ isIntersecting: true }])
    for (let step = 1; step <= 360; step++) {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(step * 100))
    }
  })
  expect(frames.size).toBe(1)
  expect(controller.events()).toEqual([])
})
