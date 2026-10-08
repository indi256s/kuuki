// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { JournalFilters } from './journal-filters'

it('retains an incomplete calendar range and commits both bounds together while clearing the year', () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  const apply = vi.fn(() => true)
  render(<JournalFilters locale="en" query="year=2024" filtered apply={apply} navigating={false} external={{ query: 'year=2024', serial: 0 }} onExternal={vi.fn()} />)
  fireEvent.change(screen.getAllByLabelText('From date')[0], { target: { value: '02/29/2024' } })
  fireEvent.submit(screen.getByRole('search'))
  expect(apply).not.toHaveBeenCalled()
  expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Enter both dates')
  expect(screen.getAllByLabelText('From date')[0]).toHaveValue('02/29/2024')
  fireEvent.change(screen.getAllByLabelText('To date')[0], { target: { value: '03/01/2024' } })
  fireEvent.submit(screen.getByRole('search'))
  expect(apply).toHaveBeenCalledOnce()
  expect(apply).toHaveBeenCalledWith({ year: '', from: '2024-02-29', to: '2024-03-01' })
})
