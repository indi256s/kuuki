// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ReplayTransport } from './replay-transport'
import { buildTimeline } from './replay'
const timeline = buildTimeline(
  [
    { key: '1', flightId: 1, origin: 'AAA', destination: 'BBB', date: '2019-01-01', weight: 1 },
    { key: '2', flightId: 2, origin: 'AAA', destination: 'BBB', date: '2020-03-01', weight: 1 },
  ],
  12000,
)
const props = {
  timeline,
  durationMs: 12000,
  timeMs: 0,
  paused: false,
  setPaused: vi.fn(),
  seek: vi.fn(),
  started: true,
  reduced: false,
  locale: 'en' as const,
}

it('previews month starts, commits release and cancels to the actual drag origin with Escape focus return', () => {
  const seek = vi.fn()
  render(<ReplayTransport {...props} timeMs={123} getFrame={() => ({ timeMs: 456 })} seek={seek} />)
  fireEvent.click(screen.getByRole('button', { name: 'JAN 2019' }))
  const range = screen.getByRole('slider', { name: 'Replay month' })
  fireEvent.pointerDown(range)
  fireEvent.change(range, { target: { value: '1' } })
  expect(seek).toHaveBeenLastCalledWith((31 / 456) * 12000, 'preview')
  fireEvent.pointerUp(range)
  expect(seek).toHaveBeenLastCalledWith((31 / 456) * 12000, 'commit')
  fireEvent.pointerDown(range)
  fireEvent.change(range, { target: { value: '2' } })
  fireEvent.keyDown(range, { key: 'Escape' })
  expect(seek).toHaveBeenLastCalledWith(456, 'cancel')
  expect(screen.getByRole('button', { name: 'JAN 2019' })).toHaveFocus()
})

it('updates the month label across clock ticks, locale changes and replacement timelines', () => {
  const view = render(<ReplayTransport {...props} />)
  expect(screen.getByRole('button', { name: 'JAN 2019' })).toBeVisible()
  view.rerender(<ReplayTransport {...props} timeMs={11999} />)
  expect(screen.getByRole('button', { name: 'MAR 2020' })).toBeVisible()
  view.rerender(<ReplayTransport {...props} timeMs={11999} locale="ru" />)
  expect(screen.getByRole('button', { name: 'МАРТ 2020 Г.' })).toBeVisible()
  const next = buildTimeline(
    [{ key: '3', flightId: 3, origin: 'AAA', destination: 'BBB', date: '2026-06-01', weight: 1 }],
    12000,
  )
  view.rerender(<ReplayTransport {...props} timeline={next} />)
  expect(screen.getByRole('button', { name: 'JUN 2026' })).toBeVisible()
})

it('opens as one labelled Play button and hands focus to Pause once replay starts', () => {
  const setPaused = vi.fn()
  const view = render(
    <ReplayTransport {...props} started={false} paused setPaused={setPaused} seek={vi.fn()} />,
  )
  expect(screen.queryByRole('slider')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Replay routes month by month' }))
  expect(setPaused).toHaveBeenCalledWith(false)
  view.rerender(<ReplayTransport {...props} paused={false} setPaused={setPaused} seek={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Pause replay' })).toHaveFocus()
})
