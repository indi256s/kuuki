// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, type SectionId } from '@kuuki/shared/overview/prefs'
import { OverviewProvider } from '../store/overview-context'
import { SectionFrame } from './section-frame'
import { useReorder } from './use-reorder'

const ids: SectionId[] = ['rankings', 'records', 'clock']
const commit = vi.fn(), announce = vi.fn()
function Harness({ order = ids, onCommit = commit }: { order?: SectionId[]; onCommit?: typeof commit }) {
  const reorder = useReorder({ ids: order, onCommit, announce })
  return <>{order.map((id, index) => <SectionFrame key={id} id={id} title={id} index={index} count={order.length}
    onMove={commit} onHide={vi.fn()} narrator={<p>Existing narrator.</p>} drag={reorder.bindings(id)}
    controls={<button type="button">Metric {id}</button>}><a href="#test">Flight {id}</a><p>Body</p></SectionFrame>)}
    {reorder.indicator ? <div data-testid="insertion" style={reorder.indicator} /> : null}</>
}
function mount(order = ids) {
  return render(<OverviewProvider payload={null} prefs={DEFAULT_PREFS} ownerKey="test" locale="en" live={false}><Harness order={order} /></OverviewProvider>)
}
function header(id = 'rankings') { return screen.getByRole('heading', { name: id }).closest('header')! }
function pointer(target: Element | Window, type: string, y: number, pointerType = 'mouse', x = 0, pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientY: y, clientX: x, pointerId, pointerType, button: 0, isPrimary: true })
  fireEvent(target, event)
  return event
}
let frames: Map<number, FrameRequestCallback>, nextFrame: number, scroll: number
function tick() {
  const callbacks = [...frames.values()]; frames.clear()
  act(() => callbacks.forEach(callback => callback(0)))
}
beforeEach(() => {
  commit.mockReset(); announce.mockReset(); frames = new Map(); nextFrame = 0; scroll = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.spyOn(window, 'scrollBy').mockImplementation((options: ScrollToOptions | number) => { if (typeof options === 'object') scroll += options.top ?? 0 })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const index = ids.indexOf(this.dataset.section as SectionId), top = 100 + Math.max(0, index) * 200 - scroll
    return { top, bottom: top + 100, left: 10, right: 1210, width: 1200, height: 100, x: 10, y: top, toJSON() {} }
  })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('actual menu disables only visible ends and dispatches keyboard moves', async () => {
  const user = userEvent.setup(); mount()
  await user.click(screen.getByRole('button', { name: 'rankings options' }))
  expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('data-disabled')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(commit).toHaveBeenCalledWith('rankings', 1)
  await user.click(screen.getByRole('button', { name: 'clock options' }))
  expect(screen.getByRole('menuitem', { name: 'Move down' })).toHaveAttribute('data-disabled')
  expect(screen.getByRole('menuitem', { name: 'Move up' })).not.toHaveAttribute('data-disabled')
})
it('fine pointer arms at 4px, commits final forward/back indices and stops capture/RAF', () => {
  mount()
  const handle = header()
  const capture = vi.fn(), release = vi.fn()
  handle.setPointerCapture = capture; handle.hasPointerCapture = () => capture.mock.calls.length > release.mock.calls.length; handle.releasePointerCapture = release
  pointer(handle, 'pointerdown', 120)
  pointer(window, 'pointermove', 123)
  expect(screen.queryByTestId('insertion')).toBeNull(); expect(commit).not.toHaveBeenCalled()
  pointer(window, 'pointermove', 124)
  expect(screen.getByTestId('insertion')).toBeInTheDocument(); expect(capture).toHaveBeenCalledWith(1)
  pointer(window, 'pointerup', 580)
  expect(commit).toHaveBeenCalledExactlyOnceWith('rankings', 2)
  expect(announce).toHaveBeenCalledExactlyOnceWith('rankings', 2, 3)
  expect(release).toHaveBeenCalledWith(1); expect(frames.size).toBe(0)
  expect(screen.queryByTestId('insertion')).toBeNull()
  pointer(header('clock'), 'pointerdown', 580)
  pointer(window, 'pointermove', 100)
  pointer(window, 'pointerup', 100)
  expect(commit).toHaveBeenLastCalledWith('clock', 0)
})
it('coarse long press requires 400ms and less than 8px travel', () => {
  vi.useFakeTimers(); mount()
  pointer(header(), 'pointerdown', 120, 'touch')
  pointer(window, 'pointermove', 127, 'touch')
  act(() => vi.advanceTimersByTime(399))
  expect(screen.queryByTestId('insertion')).toBeNull()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getByTestId('insertion')).toBeInTheDocument()
  pointer(window, 'pointerup', 580, 'touch')
  expect(commit).toHaveBeenCalledExactlyOnceWith('rankings', 2)
})
it.each(['release', 'travel', 'pointercancel', 'Escape', 'unmount', 'identity-reset'])('cancels pending coarse arming on %s', reason => {
  vi.useFakeTimers(); const view = mount()
  pointer(header(), 'pointerdown', 120, 'touch')
  if (reason === 'release') pointer(window, 'pointerup', 120, 'touch')
  if (reason === 'travel') pointer(window, 'pointermove', 128, 'touch')
  if (reason === 'pointercancel') pointer(window, 'pointercancel', 120, 'touch')
  if (reason === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
  if (reason === 'unmount') view.unmount()
  if (reason === 'identity-reset') fireEvent(window, new Event('kuuki:identity-reset'))
  act(() => vi.advanceTimersByTime(500))
  pointer(window, 'pointerup', 580, 'touch')
  expect(commit).not.toHaveBeenCalled(); expect(announce).not.toHaveBeenCalled()
  expect(screen.queryByTestId('insertion')).toBeNull(); expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0)
})
it.each(['Escape', 'pointercancel', 'unmount', 'identity-reset', 'order-change'])('active drag never commits after %s and stops scrolling/listeners', reason => {
  const view = mount()
  pointer(header(), 'pointerdown', 120)
  pointer(window, 'pointermove', 760)
  expect(frames.size).toBe(1)
  if (reason === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
  if (reason === 'pointercancel') pointer(window, 'pointercancel', 760)
  if (reason === 'unmount') view.unmount()
  if (reason === 'identity-reset') fireEvent(window, new Event('kuuki:identity-reset'))
  if (reason === 'order-change') view.rerender(<OverviewProvider payload={null} prefs={DEFAULT_PREFS} ownerKey="test" locale="en" live={false}><Harness order={['records', 'rankings', 'clock']} /></OverviewProvider>)
  pointer(window, 'pointerup', 760)
  tick()
  expect(commit).not.toHaveBeenCalled(); expect(announce).not.toHaveBeenCalled(); expect(frames.size).toBe(0)
  expect(window.scrollBy).not.toHaveBeenCalled()
})
it('auto-scroll uses 12px frames only within the 64px edge and recomputes the drop with actual scroll', () => {
  mount()
  pointer(header(), 'pointerdown', 120)
  pointer(window, 'pointermove', 704) // viewport 768, exactly 64px is outside the edge
  tick(); expect(window.scrollBy).not.toHaveBeenCalled()
  pointer(window, 'pointermove', 30)
  tick(); expect(window.scrollBy).toHaveBeenLastCalledWith({ top: -12, behavior: 'instant' })
  expect(screen.getByTestId('insertion').style.top).toBe('312px')
  pointer(window, 'pointercancel', 30)
  pointer(header('clock'), 'pointerdown', 580)
  pointer(window, 'pointermove', 740)
  tick(); expect(window.scrollBy).toHaveBeenLastCalledWith({ top: 12, behavior: 'instant' })
  // External scrolling moves the remaining cards under a stationary pointer.
  scroll = -650
  fireEvent.scroll(window)
  pointer(window, 'pointerup', 740)
  expect(commit).toHaveBeenCalledExactlyOnceWith('clock', 0)
  expect(frames.size).toBe(0)
})
it('controls/menu descendants/links/body cannot arm; unrelated pointers and noop drops do not commit', () => {
  vi.useFakeTimers(); mount()
  for (const target of [screen.getByRole('button', { name: 'rankings options' }).firstElementChild!, screen.getByRole('button', { name: 'Metric rankings' }), screen.getByRole('link', { name: 'Flight rankings' }), screen.getAllByText('Body')[0]]) {
    pointer(target, 'pointerdown', 120, 'touch'); act(() => vi.advanceTimersByTime(500))
    pointer(window, 'pointermove', 580, 'touch'); pointer(window, 'pointerup', 580, 'touch')
  }
  expect(frames.size).toBe(0)
  pointer(header(), 'pointerdown', 120)
  pointer(window, 'pointermove', 580, 'mouse', 0, 2)
  expect(screen.queryByTestId('insertion')).toBeNull()
  pointer(window, 'pointermove', 124)
  pointer(window, 'pointerup', 124)
  expect(commit).not.toHaveBeenCalled(); expect(announce).not.toHaveBeenCalled()
})
it('uses the latest callback and suppresses announcements when the owner rejects a commit', () => {
  const view = mount()
  pointer(header(), 'pointerdown', 120)
  pointer(window, 'pointermove', 580)
  const replacement = vi.fn(() => false)
  view.rerender(<OverviewProvider payload={null} prefs={DEFAULT_PREFS} ownerKey="test" locale="en" live={false}><Harness onCommit={replacement} /></OverviewProvider>)
  pointer(window, 'pointerup', 580)
  expect(commit).not.toHaveBeenCalled()
  expect(replacement).toHaveBeenCalledExactlyOnceWith('rankings', 2)
  expect(announce).not.toHaveBeenCalled()
})
