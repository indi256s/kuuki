// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GRACE_MS, INTENT_MS, LEAVE_MS, useTakeover } from './use-takeover'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Card() {
  const card = useRef<HTMLDivElement>(null)
  const { state, handlers } = useTakeover(card, true, false)
  return (
    <div ref={card} {...handlers} data-testid="card">
      <div data-record="flights">flights</div>
      <output>{state ? `${state.record}:${state.phase}` : 'rest'}</output>
    </div>
  )
}

it('keeps a reopened takeover after the previous close deadline', () => {
  render(<Card />)
  const row = screen.getByText('flights')
  const hover = () => fireEvent.pointerOver(row, { pointerType: 'mouse' })
  const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  hover()
  tick(INTENT_MS)
  expect(screen.getByText('flights:open')).toBeTruthy()
  fireEvent.pointerLeave(screen.getByTestId('card'), { pointerType: 'mouse' })
  tick(GRACE_MS)
  expect(screen.getByText('flights:closing')).toBeTruthy()
  tick(LEAVE_MS / 2)
  hover()
  tick(LEAVE_MS)
  expect(screen.getByText('flights:open')).toBeTruthy()
})
