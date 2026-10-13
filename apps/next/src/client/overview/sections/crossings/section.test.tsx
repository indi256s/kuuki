// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))

const payload = fixture as OverviewPayload
const add = vi.fn(),
  clear = vi.fn(),
  setPeriod = vi.fn()
const admit = (filter: OverviewFilter = {}) => {
  context.current = {
    scope: computeOverview(payload, filter),
    all: computeOverview(payload, {}),
    filter,
    locale: 'en',
    actions: { add, clear, setPeriod },
    isCurrent: () => true,
  } as unknown as typeof context.current
}
const hero = (view: { container: HTMLElement }) =>
  view.container.querySelector('.ov3-card-value-text')
const unit = (view: { container: HTMLElement }) => view.container.querySelector('.ov3-card-unit')
const row = (name: RegExp) => screen.getByRole('button', { name })

beforeEach(() => {
  add.mockClear()
  clear.mockClear()
  setPeriod.mockClear()
  admit()
})
afterEach(cleanup)

it('a pick moves the hero and the lit piece and does not filter', () => {
  const view = render(<Section span="full" />)
  expect(hero(view)).toHaveTextContent('4')
  expect(unit(view)).toHaveTextContent('of 7 continents')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent(
    'Europe most · Oceania since 2023',
  )
  expect(screen.queryByRole('button', { name: /^Only/ })).toBeNull()
  const host = view.container.querySelector('.iso-puzzle-host')
  expect(host).not.toHaveAttribute('data-pick')
  fireEvent.click(row(/^Asia, 36 flights/))
  expect(hero(view)).toHaveTextContent('36')
  expect(unit(view)).toHaveTextContent('flights')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent(
    'Asia · first reached in 2014',
  )
  expect(host).toHaveAttribute('data-pick')
  const lit = (id: string) =>
    view.container
      .querySelector<SVGGElement>(`[data-part="lit-${id}"]`)
      ?.style.getPropertyValue('--lit')
  expect(lit('asia')).toBe('1')
  expect(lit('europe')).toBe('0')
  expect(add).not.toHaveBeenCalled()
  expect(clear).not.toHaveBeenCalled()
  expect(setPeriod).not.toHaveBeenCalled()
})

it('picking a continent never flown reads 0 flights and outlines its socket', () => {
  const view = render(<Section span="full" />)
  fireEvent.click(row(/^Africa, 0 flights/))
  expect(hero(view)).toHaveTextContent('0')
  expect(unit(view)).toHaveTextContent('flights')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent('Africa · not flown')
  const ring = view.container.querySelector<SVGGElement>('[data-part="lit-africa"]')
  expect(ring?.style.getPropertyValue('--lit')).toBe('1')
  expect(ring?.style.getPropertyValue('--lift-y')).toBe('')
})

it('the figure button steps through the continents and Firsts re-sorts by year', () => {
  const view = render(<Section span="full" />)
  fireEvent.click(screen.getByRole('button', { name: 'Show next continent' }))
  expect(hero(view)).toHaveTextContent('36')
  fireEvent.click(screen.getByRole('radio', { name: 'Firsts' }))
  const names = Array.from(view.container.querySelectorAll('.stage-name')).map(
    (el) => el.textContent,
  )
  expect(names).toEqual([
    'Asia',
    'Europe',
    'North America',
    'Oceania',
    'Africa',
    'South America',
    'Antarctica',
  ])
  expect(view.container.querySelector('[data-kc-key="asia"] .stage-value')).toHaveTextContent(
    '2014',
  )
})

it('shows the empty state when the filter leaves too few placed flights', () => {
  admit({ period: { years: [2014] } })
  render(<Section span="full" />)
  expect(screen.getByText('Too few flights to place')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(clear).toHaveBeenCalled()
})

it('lines you crossed: gap and scope-hidden years keep decorative ghosts without selectable zero-flight actions', () => {
  const all = computeOverview(payload, {})
  if (all.crossings.status !== 'ready') throw new Error('Board must satisfy Crossings minimum')
  const year = all.crossings.value.shiftByYear.toSorted((a, b) => b.flights - a.flights)[0].year
  admit({ period: { years: [year] } })
  render(<Section span="full" />)
  fireEvent.click(screen.getByRole('button', { name: 'Clock shift by year' }))
  const chart = screen.getByRole('group', { name: 'Clock change per year · hours' })
  const marks = Array.from(chart.querySelectorAll('[data-kc-key]'))
  expect(marks).toHaveLength(1)
  expect(marks[0]).toHaveAttribute('data-kc-key', String(year))
  expect(chart).toHaveTextContent('2015')
  expect(chart).toHaveTextContent('–')
  fireEvent.click(marks[0])
  expect(setPeriod).toHaveBeenCalledExactlyOnceWith({ years: [year] })
})
