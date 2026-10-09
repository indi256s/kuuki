// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { DateRangePicker } from './date-range-picker'

it('fills a whole year from a preset without applying it', async () => {
  const onChange = vi.fn()
  const onApply = vi.fn()
  render(<DateRangePicker from="" to="" locale="en" onChange={onChange} onApply={onApply} presets={[{ label: '2025', from: '2025-01-01', to: '2025-12-31' }]} />)
  await userEvent.click(screen.getByRole('button', { name: '2025' }))
  expect(onChange).toHaveBeenCalledWith({ from: '2025-01-01', to: '2025-12-31' })
  expect(onApply).not.toHaveBeenCalled()
})
