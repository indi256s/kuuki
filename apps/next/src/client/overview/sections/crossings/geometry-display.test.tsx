// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({ value: {} as unknown }))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.value }))
vi.mock('../../charts/lazy-chart', () => ({ LazyChart: () => null }))
afterEach(cleanup)

// The "Lines you crossed" Details columns: the value under the label that starts with `name`.
const column = (container: HTMLElement, name: string) => {
  const term = [...container.querySelectorAll('.ov3-card-columns dt')].find((dt) =>
    dt.textContent?.startsWith(name),
  )
  return { label: term?.textContent ?? '', value: term?.nextElementSibling?.textContent ?? '' }
}
const ready = () => {
  const scope = computeOverview(fixture as OverviewPayload, {})
  if (scope.crossings.status !== 'ready') throw new Error('Fixture must unlock Crossings')
  return { scope, data: scope.crossings.value }
}

it.each(['en', 'ru'] as const)(
  'distinguishes unknown geometry from zero and retains clocks (%s)',
  (locale) => {
    const { scope, data } = ready()
    data.equator = data.arcticCircle = 0
    data.locatedFlights = 0
    context.value = { scope, all: scope, filter: {}, locale, isCurrent: () => true }
    const { container, rerender } = render(<Section span="full" />)
    const equator = locale === 'en' ? 'Equator crossings' : 'Пересечения экватора'
    const unavailable = locale === 'en' ? 'coordinates unavailable' : 'координаты неизвестны'
    const clocks = locale === 'en' ? 'Clocks shifted' : 'Сдвиг часов'
    expect(column(container, equator).value).toBe('—')
    expect(column(container, equator).label).toContain(unavailable)
    expect(column(container, clocks).value).toMatch(/\d/)
    data.locatedFlights = scope.figures.flights
    rerender(<Section span="full" />)
    expect(column(container, equator).value).toBe('0')
    expect(column(container, equator).label).not.toContain(unavailable)
  },
)

it('does not turn an unavailable route witness into an absence claim', () => {
  const { scope, data } = ready()
  data.equator = 2
  data.lastEquator = null
  context.value = { scope, all: scope, filter: {}, locale: 'en', isCurrent: () => true }
  const { container } = render(<Section span="full" />)
  expect(column(container, 'Equator crossings')).toEqual({
    label: 'Equator crossings · route unavailable',
    value: '2',
  })
})
