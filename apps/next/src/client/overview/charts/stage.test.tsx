// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StageColumns } from './stage-columns'
import { StageRows } from './stage-rows'

const rows = [
  { key: 'a', flights: 8 },
  { key: 'b', flights: 4 },
  { key: 'c', flights: 0 },
]
const points = rows.map((datum) => ({
  key: datum.key,
  datum,
  label: `${datum.key}, ${datum.flights}`,
}))
const shared = {
  points,
  value: (point: (typeof points)[number]) => point.datum.flights,
  ariaLabel: 'Flights',
  inView: true,
  selectedKey: 'b',
  appliedKeys: ['a'],
}

it('columns scale from the baseline, mark the pick and show a known zero as a stub', () => {
  const { container } = render(
    <StageColumns {...shared} span="sheet" ticks={[{ index: 0, text: 'A' }]} tallest />,
  )
  const [a, b, c] = ['a', 'b', 'c'].map((key) =>
    screen.getByRole('button', { name: new RegExp(`^${key},`) }),
  )
  expect(b).toHaveAttribute('aria-current', 'true')
  expect(b).toHaveAttribute('data-picked', 'true')
  expect(a).toHaveAttribute('data-filtered', 'true')
  expect(c).toHaveAttribute('data-zero', 'true')
  expect(c.querySelector('.stage-peak')).toBeNull()
  const scale = (mark: Element) => mark.querySelector<SVGGElement>('.stage-bar')!.style.transform
  expect(scale(a)).toBe('scaleY(1)')
  expect(scale(b)).toBe('scaleY(0.5)')
  expect(container.querySelector('.stage-reading')).toHaveTextContent('4')
  expect(container.querySelector('.stage-tallest')).toHaveTextContent('8')
})

it('rows show a dash for zero, check the applied row and scale bars from their start', () => {
  const { container } = render(<StageRows {...shared} span="sheet" />)
  expect(container.querySelectorAll('.stage-value')[2]).toHaveTextContent('—')
  expect(container.querySelector('.stage-name')).toHaveTextContent('✓ a, 8')
  const bars = container.querySelectorAll<SVGGElement>('.stage-bar')
  expect(bars[0].style.transform).toBe('scaleX(1)')
  expect(bars[1].style.transform).toBe('scaleX(0.5)')
})

it('rows with a fill keep it on the picked row and draw an outline row as a stroke', () => {
  const { container } = render(
    <StageRows
      {...shared}
      span="sheet"
      fill={(point) => `var(--cat-maker-${point.key})`}
      outline={(point) => point.key === 'a'}
    />,
  )
  const bars = container.querySelectorAll<SVGGElement>('.stage-bar')
  expect(bars[0].style.getPropertyValue('--stage-fill')).toBe('var(--cat-maker-a)')
  expect(bars[0]).toHaveAttribute('data-outline', 'true')
  expect(bars[1].style.getPropertyValue('--stage-fill')).toBe('var(--cat-maker-b)')
  expect(bars[1]).not.toHaveAttribute('data-outline')
  expect(container.querySelector('.stage-peak')).toBeNull()
})
