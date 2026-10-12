// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ShareProfile } from './profile'

it('on a fine pointer copies the link, keeps copy feedback accessible and focused, and offers the actual URL when a later copy fails', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText')
  const url = 'https://kuuki.test/fly/traveler'
  render(<ShareProfile url={url} title="Traveler" locale="en" />)
  const button = screen.getByRole('button', { name: 'Share profile' })
  button.focus()
  await user.keyboard('{Enter}')
  expect(write).toHaveBeenCalledWith(url)
  expect(await screen.findByRole('button', { name: 'Link copied' })).toBe(button)
  expect(button).toHaveFocus()
  expect(screen.getByRole('status')).toHaveTextContent('Link copied.')

  write.mockRejectedValueOnce(new Error('Clipboard denied'))
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('textbox', { name: 'Copy this link manually' })).toHaveValue(url)
  expect(screen.getByRole('button', { name: 'Share profile' })).toBe(button)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('hands the link to the native share sheet on touch devices, and a dismissed sheet copies nothing', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText')
  const share = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'))
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        media: query,
        matches: query === '(pointer: coarse)',
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
  try {
    render(<ShareProfile url="https://kuuki.test/fly/traveler" title="Traveler" locale="en" />)
    await user.click(screen.getByRole('button', { name: 'Share profile' }))
    expect(share).toHaveBeenCalledWith({
      url: 'https://kuuki.test/fly/traveler',
      title: 'Traveler',
    })
    expect(write).not.toHaveBeenCalled()
  } finally {
    matchMedia.mockRestore()
    Reflect.deleteProperty(navigator, 'share')
  }
})
