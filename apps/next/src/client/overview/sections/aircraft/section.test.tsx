// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MAKER_SLOTS } from '@kuuki/data/aircraft-makers'
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
  expect(hero(view).value).toHaveTextContent('55%')
  expect(hero(view).unit).toHaveTextContent('Airbus')
  const unknown = within(screen.getAllByRole('table')[0]).getByRole('row', { name: 'Unknown 5 7%' })
  expect(unknown).toBeInTheDocument()
  expect(top().queryByRole('button', { name: /^Only/ })).toBeNull()
  const opacity = (key: string, part: 'lit' | 'unlit') =>
    (view.container.querySelector(`[data-part="shed-${key}-${part}"]`) as SVGElement).style.opacity
  expect(opacity('airbus', 'lit')).toContain('var(--lit-airbus, 1)')
  fireEvent.click(row('Boeing'))
  expect(hero(view).value).toHaveTextContent('30%')
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

it('Fleet shows five types and changes the airplane to the picked type', () => {
  const view = render(<Section span="full" />)
  fireEvent.click(stage().getByRole('radio', { name: 'Fleet' }))
  expect(stage().getAllByRole('button', { name: /, \d+ flights$/ })).toHaveLength(5)
  expect(hero(view).unit).toHaveTextContent('× A320')
  const airplane = () => view.container.querySelector('.ov3-card-figure svg')?.innerHTML
  const first = airplane()
  fireEvent.click(row('B738'))
  expect(hero(view).value).toHaveTextContent('16')
  expect(airplane()).not.toBe(first)
  expect(view.container.querySelector('.iso-hangars')).toBeNull()
})

it('shows time in the air for the picked maker and type, including estimated durations', () => {
  render(<Section span="full" />)
  const time = () => document.querySelector('.ov3-card-columns')?.textContent ?? ''
  fireEvent.click(row('Embraer'))
  expect(time()).toContain('5 h 55 min')
  fireEvent.click(stage().getByRole('radio', { name: 'Fleet' }))
  expect(time()).toContain('68 h 59 min')
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
  expect(screen.getByText('Too few flights with aircraft')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(clear).toHaveBeenCalled()
})

it('the tile shows the headline share and maker', () => {
  render(<Tile />)
  expect(screen.getByText('55% Airbus')).toBeInTheDocument()
})

it('keeps a sub-cell maker selectable with its exact count and the all-flight share', () => {
  const scope = context.current.scope!
  if (scope.makers.status !== 'ready') throw new Error('Fixture makers must be ready')
  scope.makers.value.rows = scope.makers.value.rows.map((row) => ({
    ...row,
    flights: row.key === 'airbus' ? 10000 : row.key === 'unknown' ? 1 : 0,
  }))
  render(<Section span="full" />)
  const unknown = row('Unknown')
  expect(unknown).toHaveAccessibleName('Unknown, <1% · 1 flight')
  fireEvent.click(unknown)
  expect(top().getByRole('button', { name: 'Only Unknown' })).toBeInTheDocument()
  expect(add).not.toHaveBeenCalled()
  expect(
    within(screen.getAllByRole('table')[0]).getByRole('row', { name: 'Unknown 1 <1%' }),
  ).toBeInTheDocument()
})

it('keeps all makers at full touch height inside the sheet stage', () => {
  const scope = context.current.scope!
  if (scope.makers.status !== 'ready') throw new Error('Fixture makers must be ready')
  scope.makers.value.rows = MAKER_SLOTS.map((key) => ({ key, flights: 10, km: 0, minutes: 0 }))
  const view = render(<Section span="sheet" />)
  const marks = stage().getAllByRole('button', { name: /, .* · 10 flights$/ })
  expect(marks).toHaveLength(MAKER_SLOTS.length)
  for (const mark of marks) {
    expect(mark.querySelector('rect[fill="transparent"]')).toHaveAttribute('height', '44')
  }
  expect(marks[0].closest('svg')).toHaveStyle({ height: `${MAKER_SLOTS.length * 44}px` })
  fireEvent.click(row('Unknown'))
  expect(hero(view).unit).toHaveTextContent('unknown')
  expect(add).not.toHaveBeenCalled()
})
