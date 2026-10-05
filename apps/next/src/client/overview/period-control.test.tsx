// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PeriodControl } from './period-control'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
afterEach(() => { cleanup(); push.mockClear() })

describe('PeriodControl', () => {
  it('is the only filter: one radio group, no text inputs', () => {
    render(<PeriodControl locale="en" period="all" years={[2026, 2025]} />)
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(document.querySelectorAll('input[type=text], input[type=search], input:not([type=radio])')).toHaveLength(0)
  })
  it('puts the year in the URL and drops it for all time', async () => {
    render(<PeriodControl locale="en" period="2026" years={[2026, 2025]} />)
    await userEvent.click(screen.getByRole('radio', { name: '2025' }))
    expect(push).toHaveBeenLastCalledWith('/overview?year=2025')
    await userEvent.click(screen.getByRole('radio', { name: /All/ }))
    expect(push).toHaveBeenLastCalledWith('/overview')
  })
  it('shows four years, keeps older ones in a select and still shows a selected older year', async () => {
    const years = [2026, 2025, 2024, 2023, 2022, 2021]
    const { rerender } = render(<PeriodControl locale="en" period="all" years={years} />)
    expect(screen.getAllByRole('radio').map(radio => radio.getAttribute('value') ?? radio.textContent)).toHaveLength(5)
    await userEvent.selectOptions(screen.getByRole('combobox'), '2021')
    expect(push).toHaveBeenLastCalledWith('/overview?year=2021')
    rerender(<PeriodControl locale="en" period="2021" years={years} />)
    expect(screen.getByRole('radio', { name: '2021' })).toBeChecked()
  })
  it('has no select when every year fits', () => {
    render(<PeriodControl locale="ru" period="all" years={[2026]} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
