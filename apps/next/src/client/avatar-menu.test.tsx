// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarMenu } from './avatar-menu'

const patch = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@kuuki/client/apiClient', () => ({
  api: { patch: (...args: unknown[]) => patch(...args), post: vi.fn() },
  getAuthGeneration: () => 1,
}))
vi.mock('./activity', () => ({
  trackPrivateOperation: () => () => undefined,
  withIdentityMutation: vi.fn(),
}))

describe('AvatarMenu', () => {
  beforeEach(() => {
    patch.mockReset()
    refresh.mockReset()
    patch.mockResolvedValue({})
  })

  it('uses the reactive profile fallback without changing the accessible account trigger', () => {
    render(<AvatarMenu id="owner-1" username="ana" displayName="Ana" isPublic />)
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger.querySelector('.profile-avatar [data-facehash]')).not.toBeNull()
    expect(trigger.querySelector('[data-interactive]')).not.toBeNull()
    expect(trigger).not.toHaveTextContent('A')
  })

  it('opens with Enter, moves with arrows and Escape returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    trigger.focus()
    await user.keyboard('{Enter}')
    const profile = await screen.findByRole('menuitem', { name: /My profile/ })
    expect(profile).toHaveAttribute('href', '/fly/ana')
    await waitFor(() => expect(profile).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Public profile' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('shows the real visibility state and updates it after the write', async () => {
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic={false} />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const toggle = await screen.findByRole('menuitemcheckbox', { name: 'Public profile' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(patch).toHaveBeenCalledWith('/api/profiles/me', { is_public: true }, expect.anything())
    expect(refresh).toHaveBeenCalled()
    expect(screen.getByText('Public')).toBeInTheDocument()
  })

  it('reverts and reports when the write fails', async () => {
    patch.mockRejectedValue(new Error('x'))
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const toggle = await screen.findByRole('menuitemcheckbox', { name: 'Public profile' })
    await user.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change visibility.')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(patch).toHaveBeenCalledWith(
      '/api/profiles/me',
      { is_public: false, show_on_leaderboards: false },
      expect.anything(),
    )
  })

  it('offers theme and language radios', async () => {
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(5)
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })
})
