// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { Section } from './section'

const context = vi.hoisted(() => ({ current: {} as ReturnType<typeof import('../../store/overview-context').useOverview> }))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
afterEach(() => vi.unstubAllGlobals())
function admit(payload: OverviewPayload, ownerKey = 'owner-a') {
  const setPeriod = vi.fn()
  context.current = { payload, scope: computeOverview(payload, {}), all: computeOverview(payload, {}), filter: {}, aggregate: payload.mode === 'aggregate', ownerKey, locale: 'en', actions: { setPeriod }, isCurrent: () => true } as unknown as typeof context.current
  return setPeriod
}

it('daily activity uses actual weighted leap-day evidence, applies an exact day, and withholds legacy monthly detail', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const payload = structuredClone(fixture) as OverviewPayload
  const source = payload.rows[1]
  payload.rows = [{ ...source, id: 1, date: '2024-02-29', weight: 2 }, { ...source, id: 2, date: '2024-02-29', weight: 3 }, { ...source, id: 3, date: '2024-03-01', state: 'awaiting', weight: 7 }]
  const compact = { ...payload, mode: 'aggregate' as const, aggregateResolution: 'day' as const, rows: aggregateRows(payload.rows, 'day') }
  const setPeriod = admit(compact)
  const view = render(<Section span="full" />)
  const calendar = screen.getByRole('group', { name: 'Completed flights by day · 2024' })
  const leap = calendar.querySelector('[data-kc-key="2024-02-29"]')!
  expect(leap).toHaveAttribute('aria-label', expect.stringContaining('5'))
  expect(calendar.querySelectorAll('[data-kc-key]')).toHaveLength(366)
  expect(calendar.querySelector('[data-kc-key="2024-03-01"]')).toHaveAttribute('aria-label', expect.stringContaining('0'))
  fireEvent.click(leap)
  expect(setPeriod).toHaveBeenLastCalledWith({ from: '2024-02-29', to: '2024-02-29' })
  admit({ ...payload, mode: 'aggregate', rows: aggregateRows(payload.rows) })
  view.rerender(<Section span="full" />)
  expect(screen.queryByRole('group', { name: /Completed flights by day/ })).toBeNull()
  expect(screen.getByText('Daily activity is unavailable in this older monthly summary.')).toBeInTheDocument()
})
