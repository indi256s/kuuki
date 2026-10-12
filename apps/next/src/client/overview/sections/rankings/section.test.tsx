// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))

const payload = fixture as OverviewPayload
const admit = (filter: OverviewFilter = {}) => {
  const actions = { add: vi.fn(), clear: vi.fn() }
  context.current = {
    payload,
    scope: computeOverview(payload, filter),
    all: computeOverview(payload, {}),
    filter,
    locale: 'en',
    ownerKey: 'owner',
    actions,
    isCurrent: () => true,
  } as unknown as typeof context.current
  return actions
}
const row = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}[ ,]`) }))
const view = (name: string) => fireEvent.click(screen.getByRole('radio', { name }))

it('a pick moves the hero and the sign to that airline and does not filter', () => {
  const actions = admit()
  const { container } = render(<Section span="full" />)
  const value = () => container.querySelector('.ov3-card-value-text')
  const sign = () => container.querySelector('[data-part="sign"] text')
  expect(value()).toHaveTextContent('24')
  expect(sign()).toHaveTextContent('TK')
  expect(screen.queryByRole('button', { name: /^Only/ })).toBeNull()
  row('Qatar Airways')
  expect(value()).toHaveTextContent('12')
  expect(sign()).toHaveTextContent('QR')
  expect(container.querySelector('.ov3-card-caption')).toHaveTextContent(
    /^2nd airline · Qatar Airways/,
  )
  expect(actions.add).not.toHaveBeenCalled()
})

it('"Only …" adds the picked row to the facet of the shown view', () => {
  const actions = admit()
  render(<Section span="full" />)
  row('Qatar Airways')
  fireEvent.click(screen.getByRole('button', { name: 'Only Qatar Airways' }))
  expect(actions.add).toHaveBeenLastCalledWith('airlines', 'QR')
  view('Airports')
  row('TBS')
  fireEvent.click(screen.getByRole('button', { name: 'Only TBS' }))
  expect(actions.add).toHaveBeenLastCalledWith('airports', 'TBS')
  view('Routes')
  row('DOH ↔ TBS')
  fireEvent.click(screen.getByRole('button', { name: 'Only DOH ↔ TBS' }))
  expect(actions.add).toHaveBeenLastCalledWith('routes', 'DOH-TBS')
})

it('the sign relights only after a pick, never on first render or when the view changes', () => {
  admit()
  const { container } = render(<Section span="full" />)
  const relit = () => container.querySelector('.iso-gate-relight')
  expect(relit()).toBeNull()
  row('Qatar Airways')
  expect(relit()?.querySelector('[data-part="sign"]')).not.toBeNull()
  view('Routes')
  expect(container.querySelector('[data-part="sign"] text')).toHaveTextContent('IST–TBS')
  expect(relit()).toBeNull()
})

it('Airports uses the baggage belt and changes its tag with the selected airport', () => {
  admit()
  const { container } = render(<Section span="full" />)
  view('Airports')
  const belt = () => container.querySelector('.iso-carousel')
  expect(belt()).not.toBeNull()
  expect(belt()).toHaveTextContent('IST')
  row('TBS')
  expect(belt()).toHaveTextContent('TBS')
  expect(container.querySelector('.ov3-card-caption')).toHaveTextContent('Tbilisi')
})

it('a filter that leaves nothing to rank says so and offers to clear it', () => {
  const actions = admit({ airlines: ['ZZ'] })
  render(<Section span="full" />)
  expect(screen.getByRole('heading', { name: 'Nothing left to rank' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(actions.clear).toHaveBeenCalled()
})
