// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ReplayTransport } from './replay-transport'
import { buildTimeline } from './replay'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import { OverviewProvider, useOverview } from '../store/overview-context'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
const timeline = buildTimeline([{ key: '1', flightId: 1, origin: 'AAA', destination: 'BBB', date: '2019-01-01', weight: 1 },
  { key: '2', flightId: 2, origin: 'AAA', destination: 'BBB', date: '2020-03-01', weight: 1 }], 12000)
const props = { timeline, durationMs: 12000, timeMs: 0, paused: false, setPaused: vi.fn(), seek: vi.fn(), reduced: false, locale: 'en' as const }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('pause uses and persists the actual provider preference', async () => {
  vi.useFakeTimers()
  const saver = vi.fn(async prefs => prefs)
  function Consumer() { const overview = useOverview(); return <ReplayTransport {...props} paused={overview.replayPaused} setPaused={overview.setReplayPaused} /> }
  render(<OverviewProvider payload={fixture as OverviewPayload} prefs={{ ...DEFAULT_PREFS, replayPaused: false }} ownerKey="owner" locale="en" live={false} saver={saver}><Consumer /></OverviewProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }))
  expect(screen.getByRole('button', { name: 'Play replay' })).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(saver.mock.calls[0][0].replayPaused).toBe(true)
})
it('native handle keyboard seeks month starts and label remains a valid candidate as replay moves', () => {
  const seek = vi.fn(), { rerender } = render(<ReplayTransport {...props} seek={seek} />)
  fireEvent.click(screen.getByRole('button', { name: 'JAN 2019' }))
  const handle = screen.getByRole('slider', { name: 'Replay month' })
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(seek).toHaveBeenCalledWith(expect.any(Number), 'commit')
  expect(seek.mock.calls[0][0]).toBeCloseTo(31 / 456 * 12000)
  rerender(<ReplayTransport {...props} timeMs={1234.56} seek={seek} />)
  expect(screen.getByRole('slider', { name: 'Replay month' })).toBeInTheDocument()
  fireEvent.keyDown(handle, { key: 'Escape' })
  expect(screen.getByRole('button', { name: /2019/ })).toHaveFocus()
})
it('touch label expands, outside dismisses, and reduced motion hides transport', () => {
  const { rerender } = render(<ReplayTransport {...props} />)
  const label = screen.getByRole('button', { name: 'JAN 2019' })
  fireEvent.click(label); expect(label).toHaveAttribute('aria-expanded', 'true')
  fireEvent.pointerDown(document.body); expect(label).toHaveAttribute('aria-expanded', 'false')
  rerender(<ReplayTransport {...props} reduced />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
