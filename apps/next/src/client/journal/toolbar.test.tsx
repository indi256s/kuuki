// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { JournalFacetValues } from './filter'
import { emptyFilters, type JournalFilters, type JournalStatus } from './model'
import { MoreFiltersDrawer } from './more-filters'
import { JournalToolbar, type JournalToolbarProps } from './toolbar'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

const facetValues: JournalFacetValues = {
  airlines: ['PC', 'TK'],
  aircraft: ['A359'],
  families: ['A350'],
  airports: ['IST'],
  countries: ['DE', 'TR'],
  years: [2023, 2024],
}
const statusCounts: Record<JournalStatus, number> = { logged: 12, awaiting: 3, upcoming: 2 }
const refs: JournalToolbarProps['refs'] = {
  airports: { IST: { city: 'Istanbul', name: 'Istanbul Airport', country: 'TR' } },
  airlines: { TK: { name: 'Turkish Airlines' }, PC: { name: 'Pegasus' } },
  aircraft: {
    A359: { name: 'Airbus A350-900', family: 'A350', manufacturer: 'Airbus', type: null },
  },
}

function Harness({
  initial = emptyFilters(),
  onChange,
  matchingCount = 24,
  onExport = () => {},
  locale = 'en',
}: {
  initial?: JournalFilters
  onChange: (next: JournalFilters) => void
  matchingCount?: number
  onExport?: () => void
  locale?: 'en' | 'ru'
}) {
  const [filters, setFilters] = useState(initial)
  return (
    <JournalToolbar
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next)
        onChange(next)
      }}
      facetValues={facetValues}
      statusCounts={statusCounts}
      refs={refs}
      locale={locale}
      matchingCount={matchingCount}
      onExport={onExport}
    />
  )
}

it('choosing an airline writes airlines and keeps the picker open', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: 'Airline' }))
  await user.click(await screen.findByRole('option', { name: /Turkish Airlines/ }))
  expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), airlines: ['TK'] })
  // The chip is now active, and the same picker is still open for the next choice.
  expect(screen.getByRole('button', { name: 'Remove Airline filter' })).toBeInTheDocument()
  await user.click(screen.getByRole('option', { name: /Pegasus/ }))
  expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), airlines: ['PC', 'TK'] })
})

it('choosing a country in Place writes countries, an airport writes airports', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: 'Place' }))
  await user.click(await screen.findByRole('option', { name: /Germany/ }))
  expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), countries: ['DE'] })
  await user.click(screen.getByRole('option', { name: /Istanbul/ }))
  expect(onChange).toHaveBeenLastCalledWith({
    ...emptyFilters(),
    countries: ['DE'],
    airports: ['IST'],
  })
})

it('hides Clear all on empty filters and resets everything otherwise', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { unmount } = render(<Harness onChange={onChange} />)
  expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()
  unmount()
  render(
    <Harness
      initial={{ ...emptyFilters(), q: 'tk', status: ['upcoming'], airlines: ['TK'] }}
      onChange={onChange}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Clear all' }))
  expect(onChange).toHaveBeenLastCalledWith(emptyFilters())
})

it('removing a chip clears only its facet', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const initial = { ...emptyFilters(), airlines: ['TK'], families: ['A350'], years: [2024] }
  render(<Harness initial={initial} onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: 'Remove Airline filter' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...initial, airlines: [] })
})

it('Escape clears a typed query and does nothing in an empty field', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const parent = vi.fn()
  render(
    <div onKeyDown={parent}>
      <Harness initial={{ ...emptyFilters(), q: 'tk 381' }} onChange={onChange} />
    </div>,
  )
  const search = screen.getByRole('searchbox', { name: 'Search flights' })
  await user.click(search)
  await user.keyboard('{Escape}')
  expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), q: '' })
  expect(parent).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
  onChange.mockClear()
  await user.keyboard('{Escape}')
  expect(onChange).not.toHaveBeenCalled()
  expect(parent).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
})

it('Period year toggles write years and clear the range', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <Harness
      initial={{ ...emptyFilters(), from: '2024-03-12', to: '2024-04-03' }}
      onChange={onChange}
    />,
  )
  expect(screen.getByRole('button', { name: /^Period/ })).toHaveTextContent(
    'Mar 12, 2024 to Apr 3, 2024',
  )
  await user.click(screen.getByRole('button', { name: /^Period/ }))
  await user.click(await screen.findByRole('button', { name: '2023' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), years: [2023] })
})

it('the drawer shows counts and renders the default status as Flown and To confirm', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  function Drawer() {
    const [filters, setFilters] = useState(emptyFilters())
    return (
      <MoreFiltersDrawer
        open
        onOpenChange={() => {}}
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next)
          onChange(next)
        }}
        statusCounts={statusCounts}
        locale="en"
      />
    )
  }
  render(<Drawer />)
  const status = screen.getByRole('group', { name: 'Status' })
  expect(within(status).getByRole('checkbox', { name: 'Flown' })).toBeChecked()
  expect(within(status).getByRole('checkbox', { name: 'To confirm' })).toBeChecked()
  expect(within(status).getByRole('checkbox', { name: 'Upcoming' })).not.toBeChecked()
  expect(within(status).getByText('12')).toBeInTheDocument()
  expect(within(status).getByText('3')).toBeInTheDocument()
  expect(within(status).getByText('2')).toBeInTheDocument()
  await user.click(within(status).getByRole('checkbox', { name: 'Upcoming' }))
  expect(onChange).toHaveBeenLastCalledWith({
    ...emptyFilters(),
    status: ['awaiting', 'logged', 'upcoming'],
  })
  await user.click(within(status).getByRole('checkbox', { name: 'Upcoming' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), status: [] })
  await user.click(screen.getByRole('checkbox', { name: 'oneworld' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), alliances: ['oneworld'] })
})

it('the menu shows the drawer badge and exports only when something matches', async () => {
  const user = userEvent.setup()
  const onExport = vi.fn()
  const initial = { ...emptyFilters(), missing: ['airline' as const], alliances: ['star' as const] }
  const { unmount } = render(
    <Harness initial={initial} onChange={() => {}} matchingCount={24} onExport={onExport} />,
  )
  await user.click(screen.getByRole('button', { name: 'More' }))
  expect(await screen.findByRole('menuitem', { name: 'More filters, 2' })).toBeInTheDocument()
  await user.click(screen.getByRole('menuitem', { name: 'Export 24 flights' }))
  expect(onExport).toHaveBeenCalledTimes(1)
  unmount()

  onExport.mockClear()
  render(<Harness onChange={() => {}} matchingCount={0} onExport={onExport} />)
  await user.click(screen.getByRole('button', { name: 'More' }))
  const item = await screen.findByRole('menuitem', { name: /Export 0 flights/ })
  expect(item).toHaveAttribute('aria-disabled', 'true')
  await user.click(item)
  expect(onExport).not.toHaveBeenCalled()
})

it('pluralises the export label in Russian', async () => {
  const user = userEvent.setup()
  render(<Harness onChange={() => {}} matchingCount={21} locale="ru" />)
  await user.click(screen.getByRole('button', { name: 'Ещё' }))
  await waitFor(() =>
    expect(screen.getByRole('menuitem', { name: 'Экспортировать 21 перелёт' })).toBeInTheDocument(),
  )
})

it('phones open all filter facets in the bottom sheet and keep the search outside it', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  expect(screen.queryByRole('button', { name: 'Airline' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  const sheet = await screen.findByRole('dialog', { name: 'Filters' })
  expect(sheet).toHaveAttribute('data-side', 'bottom')
  expect(within(sheet).getByRole('button', { name: 'Period' })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Place' })).toBeInTheDocument()
  await user.click(within(sheet).getByRole('checkbox', { name: 'Upcoming' }))
  expect(onChange).toHaveBeenLastCalledWith({
    ...emptyFilters(),
    status: ['awaiting', 'logged', 'upcoming'],
  })
  await user.click(within(sheet).getByRole('button', { name: 'Airline' }))
  await user.click(await screen.findByRole('option', { name: /Turkish Airlines/ }))
  await user.keyboard('{Escape}')
  await user.click(within(sheet).getByRole('button', { name: 'Reset' }))
  expect(onChange).toHaveBeenLastCalledWith(emptyFilters())
})
