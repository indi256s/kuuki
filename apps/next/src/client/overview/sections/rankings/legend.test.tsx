// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import board from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewProvider } from '../../store/overview-context'
import { Section } from './section'

vi.mock('next/navigation', () => ({
  usePathname: () => '/overview',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

it('emphasizes a legend series on hover and focus without dimming the others, clears it on exit or category change, keeps hidden marks hidden, and offers Show all', () => {
  const { container } = render(
    <OverviewProvider
      payload={board as OverviewPayload}
      prefs={DEFAULT_PREFS}
      ownerKey="legend-owner"
      locale="en"
      live={false}
    >
      <Section span="full" />
    </OverviewProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Rank by year' }))
  const legend = container.querySelector('.ov3-bump-dashes')!
  const buttons = within(legend as HTMLElement).getAllByRole('button')
  const groups = () => Array.from(container.querySelectorAll<SVGGElement>('[data-bump-series]'))
  const firstKey = groups()[0].getAttribute('data-bump-series')!
  expect(groups().length).toBeGreaterThan(1)

  const emphasized = () =>
    groups()
      .filter((group) => group.hasAttribute('data-active'))
      .map((group) => group.getAttribute('data-bump-series'))
  const undimmed = () => groups().every((group) => group.style.opacity === '')
  fireEvent.pointerEnter(buttons[0], { pointerType: 'mouse' })
  expect(emphasized()).toEqual([firstKey])
  expect(undimmed()).toBe(true)
  fireEvent.pointerLeave(buttons[0])
  expect(emphasized()).toEqual([])

  fireEvent.focus(buttons[1])
  expect(emphasized()).toEqual([groups()[1].getAttribute('data-bump-series')])
  expect(undimmed()).toBe(true)
  fireEvent.blur(buttons[1])
  expect(emphasized()).toEqual([])

  fireEvent.click(buttons[0])
  fireEvent.pointerEnter(buttons[0], { pointerType: 'mouse' })
  expect(container.querySelector(`[data-bump-series="${firstKey}"]`)).toBeNull()
  expect(undimmed()).toBe(true)
  fireEvent.focus(buttons[0])
  expect(container.querySelector(`[data-bump-series="${firstKey}"]`)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
  expect(container.querySelector(`[data-bump-series="${firstKey}"]`)).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull()

  fireEvent.focus(buttons[1])
  fireEvent.click(screen.getByRole('radio', { name: 'Airports' }))
  expect(container.querySelector('[data-bump-highlight]')).toBeNull()
  expect(undimmed()).toBe(true)
})

it('caps the airline share legend at eight rows with a plural-aware toggle', () => {
  const { container } = render(
    <OverviewProvider
      payload={board as OverviewPayload}
      prefs={DEFAULT_PREFS}
      ownerKey="share-owner"
      locale="ru"
      live={false}
    >
      <Section span="full" />
    </OverviewProvider>,
  )
  const legend = container.querySelector('.ov3-share-legend')!
  const rows = () => legend.querySelectorAll('button').length
  const toggle = container.querySelector<HTMLButtonElement>('.ov3-share-more')
  expect(toggle).not.toBeNull()
  if (toggle) {
    expect(rows()).toBe(8)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toMatch(/^Показать ещё \d+ авиакомпани/)
    fireEvent.click(toggle)
    expect(rows()).toBeGreaterThan(8)
    expect(toggle.textContent).toBe('Показать меньше')
  } else expect(rows()).toBeLessThanOrEqual(8)
})
