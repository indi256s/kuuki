// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DataPage, DataPageMrz, MRZ_READ_KEY, UvToggle } from './data-page'

const LINES: [string, string] = ['P<KUU<SATO<<MIRA<<<<<<<<<<<<<<', 'MIRASATO<<0142FL<31CC<<<<<2403']
let reduced = false
let observed: ((entries: { isIntersecting: boolean }[]) => void)[] = []

beforeEach(() => {
  reduced = false
  observed = []
  sessionStorage.clear()
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media.includes('reduce') ? reduced : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        observed.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('presses the UV toggle on and off, and Escape on the focused toggle turns it off', async () => {
  const user = userEvent.setup()
  const view = render(
    <DataPage>
      <UvToggle locale="en" />
    </DataPage>,
  )
  const toggle = screen.getByRole('button', { name: 'Show UV security print' })
  const page = view.container.querySelector('.profile-data-page')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(page).toHaveAttribute('data-uv')
  await user.keyboard('{Escape}')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(page).not.toHaveAttribute('data-uv')
  await user.click(toggle)
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

it('reads the MRZ once per session and never under reduced motion', () => {
  const first = render(<DataPageMrz lines={LINES} page="2" />)
  expect(observed).toHaveLength(1)
  act(() => observed[0]([{ isIntersecting: true }]))
  expect(sessionStorage.getItem(MRZ_READ_KEY)).toBe('1')
  expect(first.container.querySelector('.profile-mrz')).toHaveAttribute('data-reading')
  first.unmount()

  // Same session: no second reading, the band shows the real text.
  const again = render(<DataPageMrz lines={LINES} page="2" />)
  expect(observed).toHaveLength(1)
  expect(again.container.textContent).toContain(LINES[1])
  again.unmount()

  sessionStorage.clear()
  reduced = true
  const still = render(<DataPageMrz lines={LINES} page="2" />)
  expect(observed).toHaveLength(1)
  expect(still.container.textContent).toContain(LINES[0])
  expect(sessionStorage.getItem(MRZ_READ_KEY)).toBeNull()
})
