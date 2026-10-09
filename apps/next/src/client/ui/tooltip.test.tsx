// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Tooltip } from './tooltip'

it('opens on keyboard focus, describes the trigger and closes on Escape', async () => {
  const user = userEvent.setup()
  render(<Tooltip content="Your first visit to Japan"><button type="button">Firsts</button></Tooltip>)
  const trigger = screen.getByRole('button', { name: 'Firsts' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  await user.tab()
  expect(trigger).toHaveFocus()
  const tooltip = screen.getByRole('tooltip')
  expect(tooltip).toHaveTextContent('Your first visit to Japan')
  expect(trigger).toHaveAccessibleDescription('Your first visit to Japan')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  expect(trigger).not.toHaveAttribute('aria-describedby')
  expect(trigger).toHaveFocus()
})
