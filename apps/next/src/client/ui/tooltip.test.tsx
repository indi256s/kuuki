// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { Tooltip } from './tooltip'

it('opens on keyboard focus, describes the trigger and closes on Escape', async () => {
  const user = userEvent.setup()
  render(
    <Tooltip content="Your first visit to Japan">
      <button type="button">Firsts</button>
    </Tooltip>,
  )
  const trigger = screen.getByRole('button', { name: 'Firsts' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  await user.tab()
  expect(trigger).toHaveFocus()
  const tooltip = screen.getByRole('tooltip')
  expect(tooltip).toHaveTextContent('Your first visit to Japan')
  expect(trigger).toHaveAccessibleDescription('Your first visit to Japan')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  expect(trigger).not.toHaveAttribute('aria-describedby')
  expect(trigger).toHaveFocus()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('stays open while the pointer moves from the trigger onto the bubble, and closes after it leaves both', () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  render(
    <Tooltip content="First visit to Japan">
      <button type="button">Firsts</button>
    </Tooltip>,
  )
  const trigger = screen.getByRole('button', { name: 'Firsts' })
  fireEvent.pointerOver(trigger, { pointerType: 'mouse' })
  act(() => {
    vi.advanceTimersByTime(300)
  })
  const bubble = screen.getByRole('tooltip')
  expect(bubble).toHaveAttribute('data-state', 'open')
  // Out of the trigger, across the gap and onto the bubble.
  fireEvent.pointerOut(trigger, { pointerType: 'mouse', relatedTarget: document.body })
  act(() => {
    vi.advanceTimersByTime(60)
  })
  fireEvent.pointerOver(bubble, { pointerType: 'mouse', relatedTarget: document.body })
  act(() => {
    vi.advanceTimersByTime(500)
  })
  expect(bubble).toHaveAttribute('data-state', 'open')
  fireEvent.pointerOut(bubble, { pointerType: 'mouse', relatedTarget: document.body })
  act(() => {
    vi.advanceTimersByTime(200)
  })
  expect(bubble).toHaveAttribute('data-state', 'closed')
  act(() => {
    vi.advanceTimersByTime(200)
  }) // the fade-out timer starts once the close commits
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})
