// @vitest-environment jsdom
import { render as baseRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarMenu } from './avatar-menu'
import { withIdentityMutation } from './activity'
import { ToastProvider } from './ui/toast'

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

const render = (ui: ReactElement) => baseRender(<ToastProvider>{ui}</ToastProvider>)

describe('AvatarMenu', () => {
  beforeEach(() => {
    // jsdom has no layout: without a real box the trigger counts as scrolled out of view and `hideWhenDetached` hides the menu.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 100, 40, 40),
    )
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1024)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(768)
    document.cookie = 'kuuki_accent=; Path=/; Max-Age=0'
    delete document.documentElement.dataset.accent
    patch.mockReset()
    refresh.mockReset()
    patch.mockResolvedValue({})
  })

  it('uses the reactive profile fallback without changing the accessible account trigger', () => {
    render(<AvatarMenu id="owner-1" username="ana" displayName="Ana" isPublic />)
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger.querySelector('.profile-avatar .avatar-face[data-face]')).not.toBeNull()
    expect(trigger).not.toHaveTextContent('A')
  })

  it('opens with Enter, moves with arrows and Escape returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    trigger.focus()
    await user.keyboard('{Enter}')
    const profile = await screen.findByRole('menuitem', { name: 'ana@ana' })
    expect(profile).toHaveAttribute('href', '/passport')
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
    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(patch).toHaveBeenCalledWith('/api/profiles/me', { is_public: true }, expect.anything())
    expect(refresh).toHaveBeenCalled()
  })

  it('reverts and reports when the write fails', async () => {
    patch.mockRejectedValue(new Error('x'))
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const toggle = await screen.findByRole('menuitemcheckbox', { name: 'Public profile' })
    await user.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change visibility.')
    expect(within(screen.getByRole('menu')).queryByRole('alert')).toBeNull()
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(patch).toHaveBeenCalledWith(
      '/api/profiles/me',
      { is_public: false, show_on_leaderboards: false },
      expect.anything(),
    )
  })

  it('reports a failed sign-out after the menu has closed', async () => {
    vi.mocked(withIdentityMutation).mockRejectedValue(new Error('x'))
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out.')
  })

  it('lists the groups in order with no separators', async () => {
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('separator')).toBeNull()
    const stops = [
      ...menu.querySelectorAll(
        '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"][aria-checked="true"]',
      ),
    ].map((node) => node.getAttribute('aria-label') ?? node.textContent)
    expect(stops).toEqual([
      'ana@ana',
      'Public profile',
      'Leaderboard',
      'Settings',
      'System',
      'EN',
      'Shu',
      'Sign out',
    ])
  })

  it('picks an accent from the tray, saves it and keeps the menu open', async () => {
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const shu = await screen.findByRole('menuitemradio', { name: 'Shu' })
    shu.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/profiles/me',
        { theme_color: expect.any(String) },
        expect.anything(),
      ),
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(document.documentElement.dataset.accent).not.toBe('shu')
  })

  it('reports a failed accent save', async () => {
    patch.mockRejectedValue(new Error('x'))
    const user = userEvent.setup()
    render(<AvatarMenu username="ana" isPublic />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const shu = await screen.findByRole('menuitemradio', { name: 'Shu' })
    shu.focus()
    await user.keyboard('{ArrowRight}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the accent.')
  })
})
