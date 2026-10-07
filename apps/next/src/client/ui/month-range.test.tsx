// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { MonthRange, type MonthRangeProps } from './month-range'

function Harness({ onChange = vi.fn(), onClear = vi.fn(), locale = 'en' }: Partial<MonthRangeProps>) {
  const [range, setRange] = useState<{ from: string; to: string } | null>({ from: '2025-01', to: '2025-06' })
  return <MonthRange from={range?.from ?? ''} to={range?.to ?? ''} min="2024-01" max="2026-12" locale={locale} onChange={value => { onChange(value); setRange(value) }} onClear={onClear} />
}

it('swaps reversed range', () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-10' } })
  expect(onChange).toHaveBeenLastCalledWith({ from: '2025-06', to: '2025-10' })
  expect(screen.getByLabelText('From')).toHaveValue('2025-06')
  expect(screen.getByLabelText('To')).toHaveValue('2025-10')
})

it('clear emits null', async () => {
  const onChange = vi.fn(), onClear = vi.fn()
  render(<Harness onChange={onChange} onClear={onClear} locale="ru" />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Очистить' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
  expect(onClear).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('С')).toHaveValue('')
  expect(screen.getByLabelText('По')).toHaveValue('')
})

it('keeps partial input without emitting an incomplete range, then completes it', () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } })
  expect(screen.getByLabelText('From')).toHaveValue('')
  expect(screen.getByLabelText('To')).toHaveValue('2025-06')
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-03' } })
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2025-03', to: '2025-06' })
})

it('uses native month constraints and rejects out-of-bounds changes', () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  const from = screen.getByLabelText('From')
  expect(from).toHaveAttribute('type', 'month')
  expect(from).toHaveAttribute('min', '2024-01')
  expect(from).toHaveAttribute('max', '2026-12')
  fireEvent.change(from, { target: { value: '2023-12' } })
  expect(onChange).not.toHaveBeenCalled()
  expect(from).toHaveValue('2025-01')
})

it('reflects external changes and leaves completed values under parent control', () => {
  const onChange = vi.fn(), onClear = vi.fn()
  const { rerender } = render(<MonthRange from="2025-01" to="2025-06" onChange={onChange} onClear={onClear} locale="en" />)
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-03' } })
  expect(onChange).toHaveBeenLastCalledWith({ from: '2025-03', to: '2025-06' })
  expect(screen.getByLabelText('From')).toHaveValue('2025-01')
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } })
  rerender(<MonthRange from="2024-02" to="2024-04" onChange={onChange} onClear={onClear} locale="en" />)
  expect(screen.getByLabelText('From')).toHaveValue('2024-02')
  expect(screen.getByLabelText('To')).toHaveValue('2024-04')
})

it('can clear both native fields and create a fresh range from empty input', () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '' } })
  expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2025-08' } })
  expect(screen.getByLabelText('To')).toHaveValue('2025-08')
  expect(onChange).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-02' } })
  expect(onChange).toHaveBeenLastCalledWith({ from: '2025-02', to: '2025-08' })
})

it.each([
  { field: 'From', value: '2024-06', bounds: { min: '2025-01', max: '2026-12' }, other: 'To' },
  { field: 'To', value: '2026-06', bounds: { min: '2024-01', max: '2025-12' }, other: 'From' },
])('discards an incompatible $field draft after bounds change', ({ field, value, bounds, other }) => {
  const onChange = vi.fn(), onClear = vi.fn()
  const props = { from: '', to: '', locale: 'en' as const, onChange, onClear }
  const { rerender } = render(<MonthRange {...props} min="2024-01" max="2026-12" />)
  fireEvent.change(screen.getByLabelText(field), { target: { value } })
  expect(screen.getByLabelText(field)).toHaveValue(value)
  expect(onChange).not.toHaveBeenCalled()
  rerender(<MonthRange {...props} {...bounds} />)
  fireEvent.change(screen.getByLabelText(other), { target: { value: '2025-06' } })
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText(field)).toHaveValue('')
  fireEvent.change(screen.getByLabelText(field), { target: { value: '2025-06' } })
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2025-06', to: '2025-06' })
})

it.each([
  { from: '2023-12', to: '2025-06', edit: 'To' },
  { from: '2025-01', to: '2027-01', edit: 'From' },
  { from: 'invalid', to: '2025-06', edit: 'To' },
])('does not emit an invalid retained controlled endpoint ($from, $to)', ({ from, to, edit }) => {
  const onChange = vi.fn()
  render(<MonthRange from={from} to={to} min="2024-01" max="2026-12" locale="en" onChange={onChange} onClear={() => {}} />)
  fireEvent.change(screen.getByLabelText(edit), { target: { value: '2025-03' } })
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText(edit)).toHaveValue(edit === 'From' ? from : to)
})
