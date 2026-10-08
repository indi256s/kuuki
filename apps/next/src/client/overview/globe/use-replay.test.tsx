// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { buildTimeline } from './replay'
import { useReplay } from './use-replay'
const timeline = buildTimeline([{ key: 'flight:1', flightId: 1, origin: 'AAA', destination: 'BBB', date: '2019-01-01', weight: 1 }], 12000)
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('clock freezes on pause, hidden tab and offscreen; resumes without consuming those intervals; seek resets tails', () => {
  let next = 0, intersection!: (entries: Array<{ isIntersecting: boolean }>) => void
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++next, callback); return next })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  const disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: typeof intersection) { intersection = callback } observe() {} disconnect = disconnect })
  const host = { current: document.createElement('div') }, current = vi.fn(() => true)
  const { result, rerender, unmount } = renderHook(({ paused, reduced }) => useReplay(timeline, 12000, paused, reduced, false, host, current), { initialProps: { paused: false, reduced: false } })
  const tick = (time: number) => act(() => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(time)) })
  tick(0); tick(1000)
  expect(result.current.timeMs).toBe(1000)
  rerender({ paused: true, reduced: false }); tick(9000)
  expect(result.current.timeMs).toBe(1000)
  rerender({ paused: false, reduced: false }); tick(10000); tick(11000)
  expect(result.current.timeMs).toBe(2000)
  let visibility = 'hidden'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState)
  act(() => document.dispatchEvent(new Event('visibilitychange'))); tick(15000)
  expect(result.current.timeMs).toBe(2000)
  visibility = 'visible'; act(() => document.dispatchEvent(new Event('visibilitychange')))
  tick(20000); tick(21000)
  expect(result.current.timeMs).toBe(3000)
  act(() => intersection([{ isIntersecting: false }])); tick(25000)
  expect(result.current.timeMs).toBe(3000)
  act(() => intersection([{ isIntersecting: true }])); tick(30000); tick(31000)
  expect(result.current.timeMs).toBe(4000)
  act(() => result.current.seek(0, 'preview')); tick(32000)
  expect(result.current.timeMs).toBe(0)
  act(() => result.current.seek(0, 'commit')); tick(33000)
  expect(result.current.timeMs).toBe(1000)
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(callbacks.size).toBe(0)
  unmount(); expect(disconnect).toHaveBeenCalled()
})
it('scope reset while paused drops old planes and replay time; reduced motion never schedules RAF', () => {
  const raf = vi.fn(); vi.stubGlobal('requestAnimationFrame', raf)
  const host = { current: null }, current = () => true
  const { result, rerender } = renderHook(({ items, reduced }) => useReplay(items, 12000, true, reduced, false, host, current), { initialProps: { items: timeline, reduced: false } })
  act(() => result.current.seek(5000, 'commit'))
  const other = buildTimeline([{ ...timeline[0], key: 'flight:2', date: '2020-01-01' }], 12000)
  rerender({ items: other, reduced: true })
  expect(result.current.timeMs).toBe(0)
  expect(result.current.planes[0].item.key).toBe('flight:2')
  expect(raf).not.toHaveBeenCalled()
})
