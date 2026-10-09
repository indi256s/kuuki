// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { Checkbox } from './checkbox'

function Controlled() {
  const [checked, setChecked] = useState(false)
  return (
    <Checkbox
      label="Only flights without aircraft"
      description="Keeps the ones you already set."
      checked={checked}
      onChange={(event) => setChecked(event.target.checked)}
    />
  )
}

it('toggles a native checkbox by its label and keyboard', async () => {
  const user = userEvent.setup()
  render(<Controlled />)
  const box = screen.getByRole('checkbox', { name: 'Only flights without aircraft' })
  expect(box).toHaveAccessibleDescription('Keeps the ones you already set.')
  expect(box).not.toBeChecked()
  await user.click(screen.getByText('Only flights without aircraft'))
  expect(box).toBeChecked()
  box.focus()
  await user.keyboard(' ')
  expect(box).not.toBeChecked()
})

it('shows the mixed state through the native indeterminate flag and takes its name from aria-label', () => {
  const { rerender } = render(
    <Checkbox aria-label="Select all" indeterminate checked={false} onChange={() => {}} />,
  )
  const box = screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement
  expect(box.indeterminate).toBe(true)
  expect(box).toBePartiallyChecked()
  rerender(<Checkbox aria-label="Select all" checked onChange={() => {}} />)
  expect(box.indeterminate).toBe(false)
  expect(box).toBeChecked()
})
