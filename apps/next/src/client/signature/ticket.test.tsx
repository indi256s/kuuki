// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Ticket } from './ticket'

const base = { locale: 'en', origin: { iata: 'JFK', city: 'New York' }, destination: { iata: 'BOS', city: 'Boston' }, date: '2026-01-03', flightNumber: 'B6 618', airline: 'JetBlue', distanceKm: 300 } as const

describe('Ticket', () => {
  it.each(['upcoming', 'today', 'awaiting', 'logged'] as const)('renders the %s state with a text status', state => {
    const { container } = render(<Ticket {...base} state={state} />)
    expect(container.querySelector('.ticket')).toHaveAttribute('data-state', state)
    expect(container.querySelector('.ticket-status')?.textContent?.length).toBeGreaterThan(0)
  })

  it('formats the date without shifting the day and renders actions as HTML outside the SVG', () => {
    const { container } = render(<Ticket {...base} state="awaiting" prompt="Did you land in Boston?" actions={<button type="button">Confirm</button>} />)
    expect(screen.getByText('Jan 3, 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' }).closest('svg')).toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('article', { name: 'JFK to BOS' })).toBeInTheDocument()
  })

  it('shows the stub only when given', () => {
    const { container, rerender } = render(<Ticket {...base} state="logged" />)
    expect(container.querySelector('.ticket-stub')).toBeNull()
    rerender(<Ticket {...base} state="logged" stub={<span>stamp</span>} />)
    expect(container.querySelector('.ticket-stub')).toHaveTextContent('stamp')
  })
})
