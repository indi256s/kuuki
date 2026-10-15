// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
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
afterEach(cleanup)

it.each(['columns', 'rows'])(
  '%s distinguish the current reading from applied filters and let a known zero be picked',
  (kind) => {
    const pick = vi.fn()
    render(
      kind === 'columns' ? (
        <StageColumns {...shared} span="sheet" ticks={[]} onPick={pick} />
      ) : (
        <StageRows {...shared} span="sheet" onPick={pick} />
      ),
    )
    const a = screen.getByRole('button', { name: 'a, 8' }),
      b = screen.getByRole('button', { name: 'b, 4' }),
      zero = screen.getByRole('button', { name: 'c, 0' })
    expect(b).toHaveAttribute('aria-current', 'true')
    expect(b).toHaveAttribute('aria-pressed', 'false')
    expect(a).toHaveAttribute('aria-pressed', 'true')
    expect(a).not.toHaveAttribute('aria-current')
    fireEvent.click(zero)
    expect(pick).toHaveBeenCalledExactlyOnceWith(points[2])
    if (kind === 'rows') expect(within(zero).getByText('—')).toBeInTheDocument()
  },
)

it('columns expose every applied column, including a zero, independently of the current reading', () => {
  render(<StageColumns {...shared} span="sheet" appliedKeys={['a', 'c']} ticks={[]} />)
  expect(screen.getByRole('button', { name: 'a, 8' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'c, 0' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'b, 4' })).toHaveAttribute('aria-current', 'true')
})

it('rows with a category fill never render the peak overlay, even when picked', () => {
  const { container, rerender } = render(<StageRows {...shared} span="sheet" />)
  expect(container.querySelectorAll('.stage-peak').length).toBeGreaterThan(0)
  rerender(<StageRows {...shared} span="sheet" fill={() => 'var(--cat-maker-airbus)'} />)
  expect(container.querySelector('.stage-peak')).toBeNull()
  // The picked row is marked by the selection contour instead (stage.css).
  expect(container.querySelector('[data-picked] > .stage-bar[data-fill]')).not.toBeNull()
})
