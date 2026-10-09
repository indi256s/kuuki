// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS, type OverviewPrefs } from '@kuuki/shared/overview/prefs'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { FilterPanel } from './filter-panel'

function ActiveFilter() {
  const { filter } = useOverview()
  return <output aria-label="Active filters">{JSON.stringify(filter)}</output>
}
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('keeps incomplete and reversed range drafts local, then applies and saves valid exact days once', async () => {
  vi.useFakeTimers()
  const saver = vi.fn(async (prefs: OverviewPrefs) => prefs)
  const prefs: OverviewPrefs = {
    ...structuredClone(DEFAULT_PREFS),
    filter: { period: { years: [2025] }, airlines: ['TK'] },
  }
  const anchor = document.createElement('button')
  document.body.appendChild(anchor)
  try {
    render(
      <OverviewProvider
        payload={fixture as OverviewPayload}
        prefs={prefs}
        ownerKey="owner"
        locale="en"
        saver={saver}
        live={false}
      >
        <ActiveFilter />
        <FilterPanel anchor={anchor} initialFacet="period" onClose={() => {}} />
      </OverviewProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }))
    const from = screen.getByLabelText('From date'),
      to = screen.getByLabelText('To date')
    fireEvent.change(from, { target: { value: '2024-03-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter both dates in chronological order.')
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(screen.getByLabelText('Active filters')).toHaveTextContent(JSON.stringify(prefs.filter))
    expect(saver).not.toHaveBeenCalled()
    fireEvent.change(to, { target: { value: '2024-02-29' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter both dates in chronological order.')
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(screen.getByLabelText('Active filters')).toHaveTextContent(JSON.stringify(prefs.filter))
    expect(saver).not.toHaveBeenCalled()
    fireEvent.change(to, { target: { value: '2024-03-02' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(saver).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    const filter = { period: { from: '2024-03-01', to: '2024-03-02' }, airlines: ['TK'] }
    expect(screen.getByLabelText('Active filters')).toHaveTextContent(JSON.stringify(filter))
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(saver).toHaveBeenCalledTimes(1)
    expect(saver.mock.calls[0][0].filter).toEqual(filter)
    await act(() => vi.advanceTimersByTimeAsync(1600))
    expect(saver).toHaveBeenCalledTimes(1)
  } finally {
    cleanup()
    anchor.remove()
  }
})
