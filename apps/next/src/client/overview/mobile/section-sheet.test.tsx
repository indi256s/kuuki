// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, type SectionId } from '@kuuki/shared/overview/prefs'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import board from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewPage } from '../page/overview-page'

vi.mock('next/navigation', () => ({ usePathname: () => '/dev/overview', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const saver = vi.fn(async (prefs: typeof DEFAULT_PREFS) => prefs)
function mount(prefs = structuredClone(DEFAULT_PREFS), locale: 'en' | 'ru' = 'en') {
  return render(<OverviewPage payload={board as OverviewPayload} prefs={prefs} ownerKey="dev" name="" locale={locale} live={false} saver={saver} />)
}
beforeEach(() => {
  saver.mockClear()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('next button opens the following section and pager shows 3 of 7', async () => {
  const user = userEvent.setup(); mount()
  const opener = screen.getByRole('button', { name: 'Records' })
  await user.click(opener)
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Next: Manufacturers' }))
  expect(within(dialog).getByRole('heading')).toHaveTextContent('Manufacturers3 of 7')
  expect(dialog.querySelector('[data-span]')).toHaveAttribute('data-span', 'sheet')
  const segments = dialog.querySelectorAll('.ov3-sheet-pager span')
  expect(segments).toHaveLength(7); expect(segments[2]).toHaveAttribute('data-active', 'true')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(opener).toHaveFocus()
})
it.each(['en', 'ru'] as const)('all seven actual tiles open localized sections without nested controls (%s)', async locale => {
  const user = userEvent.setup(), view = mount(undefined, locale)
  const tiles = [...view.container.querySelectorAll<HTMLButtonElement>('[data-section-tile]')]
  expect(tiles).toHaveLength(7)
  for (const tile of tiles) {
    expect(tile.querySelector('button, a, input')).toBeNull()
    await user.click(tile)
    expect(within(screen.getByRole('dialog')).getByRole('heading')).toHaveTextContent(tile.getAttribute('aria-label')!)
    await user.click(screen.getByRole('button', { name: locale === 'en' ? 'Close' : 'Закрыть' }))
    expect(tile).toHaveFocus()
  }
})
it('visible endpoints disable navigation/menu moves; hide follows visible neighbors and closes the last section to H1', async () => {
  const prefs = structuredClone(DEFAULT_PREFS); prefs.layout.hidden = prefs.layout.order.filter(id => !['records', 'fleet'].includes(id))
  const user = userEvent.setup(); mount(prefs)
  await user.click(screen.getByRole('button', { name: 'Records' }))
  expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true')
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  expect(within(screen.getByRole('dialog')).getByRole('heading')).toHaveTextContent('Records1 of 2')
  await user.click(screen.getByRole('button', { name: 'Records options' }))
  expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('data-disabled')
  await user.keyboard('{End}{Enter}')
  expect(within(screen.getByRole('dialog')).getByRole('heading')).toHaveTextContent('Fleet1 of 1')
  expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true')
  await user.click(screen.getByRole('button', { name: 'Fleet options' }))
  expect(screen.getByRole('menuitem', { name: 'Move down' })).toHaveAttribute('data-disabled')
  await user.keyboard('{End}{Enter}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Show' }))
  await user.keyboard('{End}{Enter}')
  expect(screen.getByRole('button', { name: 'Rankings' })).toHaveFocus()
})
it('sheet reorder keeps active id and full hidden order with one provider save; Hide saves hidden only', async () => {
  vi.useFakeTimers()
  const prefs = structuredClone(DEFAULT_PREFS); prefs.layout.hidden = ['rankings']
  mount(prefs)
  fireEvent.click(screen.getByRole('button', { name: 'Records' }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'Records options' }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }))
  expect(within(screen.getByRole('dialog')).getByRole('heading')).toHaveTextContent('Records2 of 6')
  await act(() => vi.advanceTimersByTimeAsync(800))
  const order = ['rankings', 'manufacturers', 'records', 'fleet', 'clock', 'rhythm', 'crossings']
  expect(saver).toHaveBeenCalledTimes(1)
  expect(saver.mock.calls[0][0].layout).toEqual({ order, hidden: ['rankings'] })
  fireEvent.keyDown(screen.getByRole('button', { name: 'Records options' }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: 'Hide' }))
  expect(within(screen.getByRole('dialog')).getByRole('heading')).toHaveTextContent('Fleet2 of 5')
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(saver).toHaveBeenCalledTimes(2)
  expect(saver.mock.calls[1][0].layout).toEqual({ order, hidden: ['rankings', 'records'] })
})
function pointer(target: Element | Window, type: string, y = 120) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientY: y, clientX: 0, pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true })
  fireEvent(target, event)
}
it('native coarse tap opens; completed drag and active cancellation suppress the pointer click; next tap opens', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const prefs = structuredClone(DEFAULT_PREFS); prefs.layout.hidden = ['crossings']
  const view = mount(prefs)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = 100 + prefs.layout.order.indexOf(this.dataset.section as SectionId) * 100
    return { top, bottom: top + 80, left: 0, right: 390, width: 390, height: 80, x: 0, y: top, toJSON() {} }
  })
  let tile = screen.getByRole('button', { name: 'Records' })
  pointer(tile, 'pointerdown')
  await act(() => vi.advanceTimersByTimeAsync(399))
  pointer(window, 'pointerup')
  fireEvent.click(tile, { detail: 1 })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await act(() => vi.advanceTimersByTimeAsync(0))
  pointer(tile, 'pointerdown', 220)
  await act(() => vi.advanceTimersByTimeAsync(400))
  pointer(window, 'pointermove', 100); pointer(window, 'pointerup', 100)
  tile = screen.getByRole('button', { name: 'Records' })
  fireEvent.click(tile, { detail: 1 })
  expect(screen.queryByRole('dialog')).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(saver).toHaveBeenCalledTimes(1)
  expect(saver.mock.calls[0][0].layout.hidden).toEqual(['crossings'])
  expect(view.container.querySelector('[data-section-tile]')).toHaveAttribute('data-section-tile', 'records')
  pointer(tile, 'pointerdown')
  await act(() => vi.advanceTimersByTimeAsync(400))
  pointer(window, 'pointercancel')
  fireEvent.click(tile, { detail: 1 })
  expect(screen.queryByRole('dialog')).toBeNull()
  pointer(tile, 'pointerdown'); pointer(window, 'pointerup'); fireEvent.click(tile, { detail: 1 })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(saver).toHaveBeenCalledTimes(1)
})
it.each(['identity reset', 'unmount'] as const)('open sheet and pending owner saves retire on %s', async retirement => {
  vi.useFakeTimers()
  const view = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Records' }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'Records options' }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }))
  const external = document.createElement('button'); document.body.appendChild(external)
  try {
    if (retirement === 'identity reset') fireEvent(window, new Event('kuuki:identity-reset'))
    else view.unmount()
    external.focus()
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(external).toHaveFocus(); expect(saver).not.toHaveBeenCalled()
  } finally { external.remove() }
})

it('actual mobile packing keeps persisted order, flushes hidden orphans and restores Show focus natively while hidden remains', async () => {
  const prefs = structuredClone(DEFAULT_PREFS); prefs.layout.hidden = ['records', 'crossings']
  const user = userEvent.setup(), view = mount(prefs)
  expect([...view.container.querySelectorAll<HTMLElement>('[data-section-tile]')].map(tile => [tile.dataset.sectionTile, tile.dataset.tileSpan])).toEqual([
    ['rankings', 'full'], ['manufacturers', 'full'], ['fleet', 'half'], ['clock', 'half'], ['rhythm', 'full'],
  ])
  const show = screen.getByRole('button', { name: 'Show' })
  await user.click(show); await user.keyboard('{Home}{Enter}')
  expect(show).toHaveFocus()
  expect([...view.container.querySelectorAll<HTMLElement>('[data-section-tile]')].map(tile => tile.dataset.sectionTile)).toEqual(['rankings', 'records', 'manufacturers', 'fleet', 'clock', 'rhythm'])
})
it('backdrop dismissal restores the actual opener', async () => {
  const user = userEvent.setup(); mount()
  const opener = screen.getByRole('button', { name: 'Clock' })
  await user.click(opener)
  await user.click(document.querySelector('.ui-overlay')!)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(opener).toHaveFocus()
})
