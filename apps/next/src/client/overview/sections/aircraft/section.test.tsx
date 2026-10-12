// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'
import { Tile } from './tile'

// Queries scoped to the card's bands: whole-card role queries walk every Details node and are slow in jsdom.
const stage = () => within(document.querySelector('.ov3-card-chart') as HTMLElement)
const top = () => within(document.querySelector('.ov3-card-top') as HTMLElement)

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const payload = fixture as OverviewPayload
const add = vi.fn(),
  clear = vi.fn()
const admit = (filter: OverviewFilter = {}) => {
  context.current = {
    payload,
    scope: computeOverview(payload, filter),
    all: computeOverview(payload, {}),
    filter,
    locale: 'en',
    aggregate: false,
    ownerKey: 'owner',
    actions: { add, clear },
    isCurrent: () => true,
  } as unknown as typeof context.current
}
const hero = (view: { container: HTMLElement }) => ({
  value: view.container.querySelector('.ov3-card-value-text'),
  unit: view.container.querySelector('.ov3-card-unit'),
  caption: view.container.querySelector('.ov3-card-caption'),
})
const row = (name: string) => stage().getByRole('button', { name: new RegExp(`^${name},`) })

beforeEach(() => {
  add.mockClear()
  clear.mockClear()
  admit()
})
afterEach(cleanup)

it("a pick moves the hero and lights that maker's hangar, and does not filter", () => {
  const view = render(<Section span="full" />)
  expect(hero(view).value).toHaveTextContent('59%')
  expect(hero(view).unit).toHaveTextContent('Airbus')
  expect(top().queryByRole('button', { name: /^Only/ })).toBeNull()
  const opacity = (key: string, part: 'lit' | 'unlit') =>
    (view.container.querySelector(`[data-part="shed-${key}-${part}"]`) as SVGElement).style.opacity
  expect(opacity('airbus', 'lit')).toContain('var(--lit-airbus, 1)')
  fireEvent.click(row('Boeing'))
  expect(hero(view).value).toHaveTextContent('33%')
  expect(hero(view).unit).toHaveTextContent('Boeing')
  expect(opacity('boeing', 'lit')).toContain('var(--lit-boeing, 1)')
  expect(opacity('airbus', 'lit')).toContain('var(--lit-airbus, 0)')
  expect(add).not.toHaveBeenCalled()
})

it('"Only …" applies the makers facet in Makers and the aircraft facet in Fleet', () => {
  render(<Section span="full" />)
  fireEvent.click(row('Boeing'))
  fireEvent.click(top().getByRole('button', { name: 'Only Boeing' }))
  expect(add).toHaveBeenLastCalledWith('makers', 'boeing')
  fireEvent.click(stage().getByRole('radio', { name: 'Fleet' }))
  fireEvent.click(row('B738'))
  fireEvent.click(top().getByRole('button', { name: 'Only B738' }))
  expect(add).toHaveBeenLastCalledWith('aircraft', 'B738')
})

it('Fleet lights the maker of the picked type', () => {
  const view = render(<Section span="full" />)
  fireEvent.click(stage().getByRole('radio', { name: 'Fleet' }))
  expect(hero(view).unit).toHaveTextContent('× A320')
  fireEvent.click(row('B738'))
  expect(hero(view).value).toHaveTextContent('16')
  expect(
    (view.container.querySelector('[data-part="shed-boeing-lit"]') as SVGElement).style.opacity,
  ).toContain('var(--lit-boeing, 1)')
})

it('hides "Only …" once the picked value is applied', () => {
  admit({ makers: ['boeing'] })
  render(<Section span="full" />)
  fireEvent.click(row('Boeing'))
  expect(top().queryByRole('button', { name: 'Only Boeing' })).toBeNull()
})

it('below the gate under a filter, the card says so and offers to clear it', () => {
  admit({ airlines: ['ZZ'] })
  render(<Section span="full" />)
  expect(screen.getByText('The hangars are shut')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(clear).toHaveBeenCalled()
})

it('the tile shows the headline share and maker', () => {
  render(<Tile />)
  expect(screen.getByText('59% Airbus')).toBeInTheDocument()
})
