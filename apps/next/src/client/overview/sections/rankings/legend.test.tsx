// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import board from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewProvider } from '../../store/overview-context'
import { Section } from './section'

vi.mock('next/navigation', () => ({ usePathname: () => '/overview', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))

it('isolates a legend series on hover and focus, clears it on exit or category change, and keeps hidden marks hidden', () => {
  const { container } = render(<OverviewProvider payload={board as OverviewPayload} prefs={DEFAULT_PREFS} ownerKey="legend-owner" locale="en" live={false}><Section span="full" /></OverviewProvider>)
  const legend = container.querySelector('.ov3-bump-dashes')!
  const buttons = within(legend as HTMLElement).getAllByRole('button')
  const groups = () => Array.from(container.querySelectorAll<SVGGElement>('[data-bump-series]'))
  const firstKey = groups()[0].getAttribute('data-bump-series')!
  expect(groups().length).toBeGreaterThan(1)

  fireEvent.pointerEnter(buttons[0], { pointerType: 'mouse' })
  expect(groups()[0].style.opacity).toBe('')
  expect(groups().slice(1).every(group => group.style.opacity === '0.22')).toBe(true)
  fireEvent.pointerLeave(buttons[0])
  expect(groups().every(group => group.style.opacity === '')).toBe(true)

  fireEvent.focus(buttons[1])
  expect(groups()[1].style.opacity).toBe('')
  expect(groups().filter((_, index) => index !== 1).every(group => group.style.opacity === '0.22')).toBe(true)
  fireEvent.blur(buttons[1])
  expect(groups().every(group => group.style.opacity === '')).toBe(true)

  fireEvent.click(buttons[0])
  fireEvent.pointerEnter(buttons[0], { pointerType: 'mouse' })
  expect(container.querySelector(`[data-bump-series="${firstKey}"]`)).toBeNull()
  expect(groups().every(group => group.style.opacity === '')).toBe(true)
  fireEvent.focus(buttons[0])
  expect(container.querySelector(`[data-bump-series="${firstKey}"]`)).toBeNull()

  fireEvent.focus(buttons[1])
  fireEvent.click(screen.getByRole('radio', { name: 'Airports' }))
  expect(container.querySelector('[data-bump-highlight]')).toBeNull()
  expect(groups().every(group => group.style.opacity === '')).toBe(true)
})
