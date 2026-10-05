// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Achievements, ShareProfile } from './profile'
import type { EarnedBadge } from './achievements'

export const award = (id = 1, code = 'flights-1', user = 'u'): EarnedBadge => ({ id, user_id: user, badge_id: id, earned_at: '2026-10-04T12:00:00Z', badge: { id, code, name: 'Launch Pad', description: 'Complete your first flight', category: 'flights', tier: 'bronze', icon: null, points: 10, criteria: { flights: 1 } } })
it.each(['en', 'ru'] as const)('copies the exact configured URL and exposes selectable failure fallback (%s)', async locale => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<ShareProfile url="https://configured.example/fly/a%20b" locale={locale} />)
  fireEvent.click(screen.getByRole('button'))
  const input = await screen.findByRole('textbox')
  expect(input).toHaveValue('https://configured.example/fly/a%20b')
  expect(input).toHaveFocus()
  expect((input as HTMLInputElement).selectionEnd).toBe((input as HTMLInputElement).value.length)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('status')).toHaveTextContent(locale === 'ru' ? 'Ссылка скопирована' : 'Link copied')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(writeText).toHaveBeenLastCalledWith('https://configured.example/fly/a%20b')
})
it.each(['en', 'ru'] as const)('shows actual named awards, shaped/text tiers and earned date in native disclosure (%s)', locale => {
  render(<Achievements badges={[award()]} locale={locale} />)
  expect(screen.getByText(locale === 'ru' ? 'Стартовая площадка' : 'Launch Pad')).toBeVisible()
  expect(screen.getByText(locale === 'ru' ? 'Бронза' : 'Bronze')).toBeVisible()
  const summary = screen.getByText(locale === 'ru' ? 'Стартовая площадка' : 'Launch Pad').closest('summary')!
  const detail = summary.closest('details')!
  summary.focus() // Keyboard focus exposes the details; native summary still supports Enter/tap.
  expect(detail.open).toBe(true)
  expect(detail.querySelector('time')).toHaveAttribute('dateTime', '2026-10-04T12:00:00Z')
  expect(detail.querySelector('p')).toBeVisible()
})
