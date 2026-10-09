// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Crossfade } from './crossfade'
import { LedgerSkeleton } from './ledger-skeleton'
import { EmptyJournal, NoMatches, RefreshFailed } from './states'

it('empty journal and no matches have different headings and actions', () => {
  const onClearFilters = vi.fn()
  const { unmount } = render(<EmptyJournal locale="en" />)
  expect(screen.getByRole('heading', { name: 'Your journal is empty' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Import flights' })).toHaveAttribute('href', '/import')
  expect(screen.getByRole('link', { name: 'or add one by hand' })).toHaveAttribute('href', '/add')
  expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  unmount()

  render(<NoMatches locale="en" onClearFilters={onClearFilters} />)
  expect(screen.getByRole('heading', { name: 'Nothing matches these filters' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Import flights' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(onClearFilters).toHaveBeenCalledTimes(1)
})

it('renders Russian copy', () => {
  render(<EmptyJournal locale="ru" />)
  expect(screen.getByRole('heading', { name: 'Журнал пока пуст' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Импортировать перелёты' })).toBeInTheDocument()
})

it('refresh failure is an alert with a retry', () => {
  const onRetry = vi.fn()
  render(<RefreshFailed locale="en" onRetry={onRetry} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Showing the last loaded flights.')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

it('crossfade is still on first render and fades after the signature changes', () => {
  const { container, rerender } = render(<Crossfade signature="a"><p>rows</p></Crossfade>)
  const wrapper = container.firstElementChild!
  expect(wrapper).not.toHaveAttribute('data-fade')

  rerender(<Crossfade signature="a"><p>rows</p></Crossfade>)
  expect(wrapper).not.toHaveAttribute('data-fade')

  rerender(<Crossfade signature="b"><p>rows</p></Crossfade>)
  expect(wrapper).toHaveAttribute('data-fade', 'a')
  rerender(<Crossfade signature="c"><p>rows</p></Crossfade>)
  expect(wrapper).toHaveAttribute('data-fade', 'b')
  expect(container.firstElementChild).toBe(wrapper)
})

it('skeleton keeps a real heading and announces loading', () => {
  render(<LedgerSkeleton locale="ru" rows={3} />)
  expect(screen.getByRole('heading', { level: 1, name: 'Журнал' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('Загружаем журнал…')
})
