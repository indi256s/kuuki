// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStamp } from './use-stamp'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const FRAME = 16
const phases = (target: number, animate = true) =>
  renderHook((props) => useStamp(props.target, props.animate, 12, true), {
    initialProps: { target, animate },
  })

it('rolls, plates, presses and returns once, 450ms after a pick', () => {
  const { result, rerender } = phases(2)
  expect(result.current).toMatchObject({ phase: 'rest', impression: 2 })
  rerender({ target: 4, animate: true })
  // The band is offset to where it was, and the impression is still the old one.
  expect(result.current).toMatchObject({ phase: 'set', impression: 2, from: -2 })
  tick(FRAME)
  expect(result.current.phase).toBe('roll')
  tick(200)
  expect(result.current).toMatchObject({ phase: 'plate', impression: 4 })
  tick(FRAME)
  expect(result.current.phase).toBe('press')
  tick(100)
  expect(result.current.phase).toBe('return')
  tick(150)
  expect(result.current).toMatchObject({ phase: 'rest', from: 0, impression: 4 })
})

it('a second pick mid-roll retargets the band and presses once, after the last pick', () => {
  const { result, rerender } = phases(2)
  rerender({ target: 4, animate: true })
  tick(FRAME + 120)
  rerender({ target: 7, animate: true })
  // Restarted on the new target; the first pick's impression never printed.
  expect(result.current).toMatchObject({ phase: 'set', impression: 2, from: -2 })
  tick(FRAME)
  expect(result.current.phase).toBe('roll')
  tick(199)
  expect(result.current.phase).toBe('roll')
  tick(1)
  expect(result.current).toMatchObject({ phase: 'plate', impression: 7 })
  tick(FRAME)
  expect(result.current.phase).toBe('press')
  tick(100)
  expect(result.current.phase).toBe('return')
  tick(150)
  expect(result.current).toMatchObject({ phase: 'rest', impression: 7 })
})

it('lands at once when the change is not a pick', () => {
  const { result, rerender } = phases(2, false)
  rerender({ target: 9, animate: false })
  expect(result.current).toMatchObject({ phase: 'rest', impression: 9, from: 0 })
})
