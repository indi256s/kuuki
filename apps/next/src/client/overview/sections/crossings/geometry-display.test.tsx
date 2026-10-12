// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'
import { Tile } from './tile'

const context = vi.hoisted(() => ({ value: {} as unknown }))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.value }))
vi.mock('./figure', () => ({ GlobeSheetFigure: () => null, useGlobeFigure: () => null }))
vi.mock('../../iso/iso-figure', () => ({ IsoFigure: () => null }))
vi.mock('../../charts/lazy-chart', () => ({ LazyChart: () => null }))
afterEach(cleanup)

it.each(['en', 'ru'] as const)(
  'distinguishes unknown geometry from zero and retains clocks (%s)',
  (locale) => {
    const scope = computeOverview(fixture as OverviewPayload, {})
    if (scope.crossings.status !== 'ready') throw new Error('Fixture must unlock Crossings')
    const data = scope.crossings.value
    data.equator = data.arcticCircle = 0
    data.locatedFlights = 0
    context.value = { scope, all: scope, locale }
    const { container, rerender } = render(<Section span="full" />)
    const equator = locale === 'en' ? 'Equator' : 'Экватор'
    const unavailable = locale === 'en' ? 'Coordinates unavailable' : 'Координаты неизвестны'
    expect(screen.getByText(equator).parentElement?.querySelector('strong')?.textContent).toBe('—')
    expect(screen.getAllByText(unavailable)).toHaveLength(2)
    expect(container.querySelector('.ov3-crossing-figure strong')?.textContent).toMatch(/\d/)
    data.locatedFlights = scope.figures.flights
    rerender(<Section span="full" />)
    expect(screen.getByText(equator).parentElement?.querySelector('strong')?.textContent).toBe('0')
    expect(screen.queryByText(unavailable)).toBeNull()
    rerender(<Tile span="half" />)
    data.locatedFlights = 0
    rerender(<Tile span="half" />)
    expect(screen.getByText(unavailable)).toBeTruthy()
    expect(screen.queryByText(/0 equator|0 экватор/)).toBeNull()
  },
)

it('does not turn an unavailable route witness into an absence claim', () => {
  const scope = computeOverview(fixture as OverviewPayload, {})
  if (scope.crossings.status !== 'ready') throw new Error('Fixture must unlock Crossings')
  scope.crossings.value.equator = 2
  scope.crossings.value.lastEquator = null
  context.value = { scope, all: scope, locale: 'en' }
  render(<Section span="full" />)
  expect(screen.getByText('Equator').parentElement?.querySelector('small')?.textContent).toBe(
    'Route unavailable',
  )
})
