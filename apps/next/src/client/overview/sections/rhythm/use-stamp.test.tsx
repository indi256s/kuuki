// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStamp } from './use-stamp'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const phases = (target: number, animate = true) =>
  renderHook((props) => useStamp(props.target, props.animate, 12, true), {
    initialProps: { target, animate },
  })

it('lands at once when the change is not a pick', () => {
  const { result, rerender } = phases(2, false)
  rerender({ target: 9, animate: false })
  expect(result.current).toMatchObject({ phase: 'rest', impression: 9, from: 0 })
})
