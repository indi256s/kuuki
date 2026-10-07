// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Chip } from './chip'

it('remove does not open', async () => {
  const onOpen = vi.fn(), onRemove = vi.fn()
  const user = userEvent.setup()
  render(<Chip label="Airline · Turkish" onOpen={onOpen} onRemove={onRemove} removeLabel="Remove airline" />)
  await user.click(screen.getByRole('button', { name: 'Remove airline' }))
  expect(onRemove).toHaveBeenCalledTimes(1)
  expect(onOpen).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Airline · Turkish' }))
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onRemove).toHaveBeenCalledTimes(1)
})
