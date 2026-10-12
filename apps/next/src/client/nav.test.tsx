// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TabBar } from './nav'

const route = vi.hoisted(() => ({ pathname: '/journal' }))
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('./awaiting', () => ({ useAwaiting: () => ({ data: null, error: false }) }))

type Listener = () => void
const viewport = { height: 800, scale: 1, listeners: new Set<Listener>() }

beforeEach(() => {
  route.pathname = '/journal'
  viewport.height = 800
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      get height() {
        return viewport.height
      },
      get scale() {
        return viewport.scale
      },
      addEventListener: (_: string, listener: Listener) => viewport.listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => viewport.listeners.delete(listener),
    },
  })
})
afterEach(() => viewport.listeners.clear())

const key = (name: string) => screen.getByRole('button', { name })

describe('TabBar', () => {
  it('has three destinations and an Add key that is never the current page', async () => {
    const user = userEvent.setup()
    render(<TabBar />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/overview',
      '/journal',
      '/passport',
    ])
    expect(screen.getByRole('link', { name: /Journal/ })).toHaveAttribute('aria-current', 'page')
    const add = key('Add flight')
    expect(add).toHaveAttribute('aria-expanded', 'false')
    expect(add).not.toHaveAttribute('aria-current')
    await user.click(add)
    const menu = await screen.findByRole('menu', { name: 'Add flight' })
    expect(menu).toBeInTheDocument()
    expect(key('Close')).toHaveAttribute('aria-expanded', 'true')
    expect(key('Close')).not.toHaveAttribute('aria-current')
  })

  it('closes the card on a route change', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TabBar />)
    await user.click(key('Add flight'))
    await screen.findByRole('menu')
    route.pathname = '/passport'
    rerender(<TabBar />)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(key('Add flight')).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the card when the on-screen keyboard opens', async () => {
    const user = userEvent.setup()
    render(<TabBar />)
    await user.click(key('Add flight'))
    await screen.findByRole('menu')
    viewport.height = 400
    act(() => viewport.listeners.forEach((listener) => listener()))
    expect(document.documentElement.dataset.keyboard).toBe('true')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })
})
