// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ShareProfile } from './profile'

it('keeps copy feedback accessible and focused, and offers the actual URL when a later copy fails', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText')
  const url = 'https://kuuki.test/fly/traveler'
  render(<ShareProfile url={url} locale="en" />)
  const button = screen.getByRole('button', { name: 'Copy profile link' })
  button.focus()
  await user.keyboard('{Enter}')
  expect(write).toHaveBeenCalledWith(url)
  expect(await screen.findByRole('button', { name: 'Copied' })).toBe(button)
  expect(button).toHaveFocus()
  expect(screen.getByRole('status')).toHaveTextContent('Link copied.')

  write.mockRejectedValueOnce(new Error('Clipboard denied'))
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('textbox', { name: 'Copy this link manually' })).toHaveValue(url)
  expect(screen.getByRole('button', { name: 'Copy profile link' })).toBe(button)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
