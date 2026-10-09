// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Below } from './display'

vi.mock('../../store/overview-context', () => ({
  useOverview: () => ({ locale: 'en', scope: { figures: { flights: 80 } } }),
}))
vi.mock('../../narrator/narrator', () => ({ Narrator: () => null }))
vi.mock('../manufacturers/aircraft-review', () => ({ PayloadAircraftReview: () => null }))

it('shows the unlock progress as a labelled meter, dots up to 12 and a bar beyond', () => {
  const view = render(
    <Below id="clock" fix="times" gate={{ status: 'below', have: 3, need: 10 }} />,
  )
  const meter = screen.getByRole('meter', { name: 'Flights with departure times: 3 of 10 needed' })
  expect(meter).toHaveAttribute('aria-valuenow', '3')
  expect(meter).toHaveAttribute('aria-valuemax', '10')
  expect(meter.querySelectorAll('i.on')).toHaveLength(3)
  expect(meter.querySelectorAll('i')).toHaveLength(10)
  view.rerender(<Below id="clock" fix="times" gate={{ status: 'below', have: 5, need: 20 }} />)
  expect(screen.getByRole('meter').querySelector('b')).toHaveStyle({ inlineSize: '25%' })
})
