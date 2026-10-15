// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NAV_ITEMS, TabBar } from './nav'

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
    const add = key('Add')
    expect(add).toHaveAttribute('aria-expanded', 'false')
    expect(add).not.toHaveAttribute('aria-current')
    await user.click(add)
    const menu = await screen.findByRole('menu', { name: 'Add' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('href')),
    ).toEqual(['/import', '/add', '/ground-travel/new?mode=rail', '/ground-travel/new?mode=road'])
    expect(key('Close')).toHaveAttribute('aria-expanded', 'true')
    expect(key('Close')).not.toHaveAttribute('aria-current')
  })

  it('marks Journal current in its ground-travel section, nested routes included', () => {
    for (const pathname of ['/ground-travel', '/ground-travel/new']) {
      route.pathname = pathname
      const { unmount } = render(<TabBar />)
      const current = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page')
      expect(current.map((link) => link.textContent)).toEqual(['JournalЖурнал'])
      unmount()
    }
  })

  it('closes the card on Escape and returns focus to the key', async () => {
    const user = userEvent.setup()
    render(<TabBar />)
    await user.click(key('Add'))
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(key('Add')).toHaveFocus()
  })

  it('closes the card on a route change', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TabBar />)
    await user.click(key('Add'))
    await screen.findByRole('menu')
    route.pathname = '/passport'
    rerender(<TabBar />)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(key('Add')).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the card when the on-screen keyboard opens', async () => {
    const user = userEvent.setup()
    render(<TabBar />)
    await user.click(key('Add'))
    await screen.findByRole('menu')
    viewport.height = 400
    act(() => viewport.listeners.forEach((listener) => listener()))
    expect(document.documentElement.dataset.keyboard).toBe('true')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })
})

describe('Journal tab', () => {
  beforeEach(() => window.sessionStorage.clear())
  const journalHref = () => screen.getByRole('link', { name: /Journal/ }).getAttribute('href')

  it('links to the section in view', () => {
    route.pathname = '/ground-travel'
    render(<TabBar />)
    expect(journalHref()).toBe('/ground-travel')
  })

  it('renders /journal on the server, even with Ground stored', () => {
    window.sessionStorage.setItem('kuuki:journal-section', 'ground')
    route.pathname = '/overview'
    expect(renderToString(<TabBar />)).toContain('href="/journal"')
  })

  it('links elsewhere to the section last viewed in this browser tab', () => {
    route.pathname = '/overview'
    const { rerender } = render(<TabBar />)
    expect(journalHref()).toBe('/journal')
    window.sessionStorage.setItem('kuuki:journal-section', 'ground')
    route.pathname = '/passport'
    rerender(<TabBar />)
    expect(journalHref()).toBe('/ground-travel')
  })
})

describe('NAV_ITEMS', () => {
  it('lists the desktop destinations in order', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(['/overview', '/journal', '/passport'])
  })
})
