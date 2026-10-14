// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AchievementCabinet } from './cabinet'
import type { EarnedBadge } from '../achievements'
import type { LadderStats } from './model'

const flights = (rung: number, threshold: number): EarnedBadge => ({
  id: rung,
  user_id: 'u',
  badge_id: 20 + rung,
  earned_at: '2026-10-13T12:00:00Z',
  badge: {
    id: 20 + rung,
    code: `flights-${rung}`,
    name: '',
    description: null,
    category: 'flights',
    tier: null,
    icon: null,
    points: 10,
    criteria: { flights: threshold },
  },
})
const stats = (total_flights: number) => ({ total_flights }) as LadderStats

it('moves an open sheet to the new rung when an award lands while it is open', () => {
  const view = render(
    <AchievementCabinet badges={[flights(1, 1)]} stats={stats(24)} locale="en" ownerId={null} />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Wheels up/ }))
  expect(screen.getByRole('dialog', { name: 'Wheels up' })).toBeTruthy()
  view.rerender(
    <AchievementCabinet
      badges={[flights(1, 1), flights(2, 25)]}
      stats={stats(25)}
      locale="en"
      ownerId={null}
    />,
  )
  expect(screen.getByRole('dialog', { name: 'Regular' })).toBeTruthy()
})

it('names the next rung for screen readers even without stats to count down from', () => {
  render(<AchievementCabinet badges={[flights(1, 1)]} stats={null} locale="en" ownerId={null} />)
  fireEvent.click(screen.getByRole('button', { name: /Wheels up/ }))
  const slots = within(screen.getByRole('dialog')).getAllByRole('listitem')
  expect(slots[1].textContent).toContain(', next')
})
