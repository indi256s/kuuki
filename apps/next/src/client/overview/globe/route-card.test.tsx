// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RouteCard } from './route-card'

afterEach(cleanup)
it('keeps reference-only route evidence available without applying a filter that empties the current selection', () => {
  const scope = vi.fn()
  render(<RouteCard route={{ key: 'JFK-LHR', count: 0, distanceKm: 5500, x: 0, y: 0, comparison: { heldCount: 3, currentCount: 0 } }}
    locale="en" onScope={scope} onClose={() => {}} />)
  expect(screen.getByRole('dialog')).toHaveTextContent('Reference: 3 flights')
  const action = screen.getByRole('button', { name: 'Scope page to this route' })
  expect(action).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('This route is only in the reference.')).toBeVisible()
  fireEvent.click(action)
  expect(scope).not.toHaveBeenCalled()
})
