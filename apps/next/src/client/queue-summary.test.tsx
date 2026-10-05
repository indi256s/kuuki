// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueueSummarySlot } from './queue-summary'

describe('QueueSummarySlot', () => {
  it.each([undefined, null, 0, -2, Number.NaN])('renders nothing for %s', count => {
    const { container } = render(<QueueSummarySlot count={count} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the count with a localized accessible name', () => {
    render(<QueueSummarySlot count={3} />)
    const link = screen.getByRole('link', { name: '3 awaiting action' })
    expect(link).toHaveTextContent('3')
  })

  it('uses Russian plural forms', () => {
    render(<QueueSummarySlot count={2} locale="ru" />)
    expect(screen.getByRole('link', { name: '2 в очереди' })).toBeInTheDocument()
  })
})
