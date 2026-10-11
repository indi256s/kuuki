// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { buildTimeline } from './replay'
import { useReplay } from './use-replay'

afterEach(() => vi.unstubAllGlobals())

it('advances subscribed planes without rerendering the globe between semantic changes and freezes previews and paused time', () => {
  let callback: FrameRequestCallback | undefined
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
    callback = next
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    callback = undefined
  })
  const timeline = buildTimeline(
    [
      { key: '1', flightId: 1, origin: 'AAA', destination: 'BBB', date: '2026-01-01', weight: 1 },
      { key: '2', flightId: 2, origin: 'AAA', destination: 'BBB', date: '2026-02-01', weight: 1 },
    ],
    12000,
  )
  const host = { current: null }
  const isCurrent = () => true
  let renders = 0
  const view = renderHook(
    ({ paused }) => {
      renders++
      return useReplay(timeline, 12000, paused, false, false, host, isCurrent)
    },
    { initialProps: { paused: false } },
  )
  const times: number[] = []
  const unsubscribe = view.result.current.subscribe?.(() =>
    times.push(view.result.current.getFrame().absoluteMs),
  )
  const tick = (time: number) =>
    act(() => {
      callback?.(time)
    })
  tick(0)
  const initialRenders = renders
  tick(16)
  tick(32)
  expect(renders).toBe(initialRenders)
  expect(times).toEqual([0, 16, 32])
  expect(view.result.current.getFrame().absoluteMs).toBe(32)
  act(() => view.result.current.seek(6500, 'preview'))
  expect(view.result.current.timeMs).toBe(6500)
  tick(48)
  expect(view.result.current.getFrame().absoluteMs).toBe(6500)
  act(() => view.result.current.seek(0, 'cancel'))
  tick(64)
  expect(view.result.current.getFrame().absoluteMs).toBe(16)
  view.rerender({ paused: true })
  tick(10000)
  expect(view.result.current.getFrame().absoluteMs).toBe(16)
  view.rerender({ paused: false })
  tick(20000)
  tick(20016)
  expect(view.result.current.getFrame().absoluteMs).toBe(32)
  tick(26200)
  expect(view.result.current.timeMs).toBe(timeline[1].startMs)
  expect(renders).toBeGreaterThan(initialRenders)
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  tick(30000)
  expect(view.result.current.getFrame().absoluteMs).toBe(timeline[1].startMs)
  unsubscribe?.()
})
