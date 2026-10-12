// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import { routeArrow } from '@kuuki/shared/overview/filter'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))

const payload = fixture as OverviewPayload

function setup(filter: OverviewFilter = {}) {
  const scope = computeOverview(payload, filter),
    actions = { add: vi.fn(), clear: vi.fn(), setPeriod: vi.fn() }
  context.current = {
    scope,
    all: computeOverview(payload, {}),
    filter,
    payload,
    locale: 'en',
    isCurrent: () => true,
    actions,
  } as unknown as typeof context.current
  return { scope, actions }
}

it('a pick changes the hero to that route and does not filter', () => {
  const { scope, actions } = setup()
  if (scope.routes.status !== 'ready') throw new Error('Board must satisfy Routes minimum')
  const [first, second, third] = scope.rankings.routes
  const { container } = render(<Section span="full" />)
  const hero = container.querySelector('.ov3-card-value')!
  expect(hero).toHaveTextContent(String(scope.routes.value.distinct))
  expect(hero).toHaveTextContent('routes')
  expect(screen.queryByRole('button', { name: /^Only / })).toBeNull()
  expect(container.querySelector('.ov3-passes')).not.toHaveAttribute('data-deal')
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${routeArrow(second.key)},`) }))
  expect(hero).toHaveTextContent(String(second.count))
  expect(container.querySelector('.ov3-passes')).toHaveAttribute('data-deal', '1')
  expect(hero).toHaveTextContent(/flights?$/)
  expect(actions.add).not.toHaveBeenCalled()
  expect(actions.setPeriod).not.toHaveBeenCalled()
  // A pick mid-deal keeps the running deal; after it settles, the next pick deals again.
  const pass = container.querySelector('.ov3-passes')!
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${routeArrow(third.key)},`) }))
  expect(pass).toHaveAttribute('data-deal', '1')
  // jsdom has no AnimationEvent, so React listens for the prefixed name there (browsers get `animationend`).
  fireEvent(pass, new Event('webkitAnimationEnd', { bubbles: true }))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${routeArrow(first.key)},`) }))
  expect(pass).toHaveAttribute('data-deal', '2')
})

it('"Only …" adds the picked route to the routes facet', () => {
  const { scope, actions } = setup()
  const [, second] = scope.rankings.routes
  render(<Section span="full" />)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${routeArrow(second.key)},`) }))
  fireEvent.click(screen.getByRole('button', { name: `Only ${routeArrow(second.key)}` }))
  expect(actions.add).toHaveBeenCalledExactlyOnceWith('routes', second.key)
})

it('under a filter that leaves too few flights it shows the empty state, and the action clears the filter', () => {
  const all = computeOverview(payload, {})
  const rare = all.rankings.routes.at(-1)!.key
  const { actions } = setup({ routes: [rare] })
  render(<Section span="full" />)
  expect(screen.getByText(/^Routes need 5 flights$/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(actions.clear).toHaveBeenCalledOnce()
})
