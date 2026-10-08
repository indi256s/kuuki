// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { ComparisonControl, ComparisonPanel } from './comparison-panel'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ usePathname: () => '/overview', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push }) }))
afterEach(() => { cleanup(); push.mockReset() })
const base = fixture as OverviewPayload
const payload: OverviewPayload = { ...base, rows: [
  { ...base.rows[0], id: 1, date: '2019-03-01', origin: 'JFK', destination: 'LHR', airline: 'BA', state: 'logged' },
  { ...base.rows[0], id: 2, date: '2020-03-01', origin: 'TBS', destination: 'IST', airline: 'TK', state: 'logged' },
] }
function Controls() {
  const { actions } = useOverview()
  return <><ComparisonControl /><ComparisonPanel /><button onClick={() => actions.setPeriod({ years: [2020] })}>2020</button></>
}
const prefs = { ...DEFAULT_PREFS, filter: { period: { years: [2019] } } }

it('keeps the reference while the current period changes and opens its supporting flight without changing scope', () => {
  render(<OverviewProvider payload={payload} prefs={prefs} ownerKey="owner" locale="en" live={false}><Controls /></OverviewProvider>)
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Keep for comparison' })))
  expect(screen.getByRole('status')).toHaveTextContent('Reference kept: Period 2019')
  expect(screen.getByText('Choose another period or filter to see what changed.')).toBeVisible()
  act(() => fireEvent.click(screen.getByRole('button', { name: '2020' })))
  const panel = screen.getByRole('region', { name: 'Compare chapters' })
  expect(within(panel).getByText('Period 2019')).toBeVisible()
  expect(within(panel).getByText('Period 2020')).toBeVisible()
  const reference = within(panel).getByRole('region', { name: /Only in reference/ })
  expect(within(reference).getByRole('button', { name: /JFK–LHR/ })).toBeVisible()
  fireEvent.click(within(reference).getByRole('button', { name: 'Show flights' }))
  fireEvent.click(within(reference).getByRole('button', { name: /Open flight:/ }))
  expect(push).toHaveBeenCalledWith('/overview?flight=1', { scroll: false })
  expect(within(panel).getByText('Period 2019')).toBeVisible()
  screen.getByRole('button', { name: 'Clear comparison' }).focus()
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Clear comparison' })))
  expect(screen.queryByRole('region', { name: 'Compare chapters' })).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('Comparison cleared')
  expect(screen.getByRole('button', { name: 'Keep for comparison' })).toHaveFocus()
})

it('offers route evidence without flight buttons in aggregate mode', () => {
  render(<OverviewProvider payload={{ ...payload, mode: 'aggregate' }} prefs={prefs} ownerKey="owner" locale="en" live={false}><Controls /></OverviewProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Keep for comparison' }))
  fireEvent.click(screen.getByRole('button', { name: '2020' }))
  const panel = screen.getByRole('region', { name: 'Compare chapters' })
  expect(within(panel).getAllByText(/individual flights cannot be opened here/)).toHaveLength(2)
  expect(within(panel).queryByRole('button', { name: 'Show flights' })).toBeNull()
})
