// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
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

describe('TabBar', () => {
  it('has exactly four destinations and no action key', () => {
    render(<TabBar />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/overview',
      '/journal',
      '/ground-travel',
      '/passport',
    ])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Journal/ })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps a short visible label and the full accessible name for ground travel', () => {
    const { rerender } = render(<TabBar />)
    expect(screen.getByRole('link', { name: 'Ground travel' })).toHaveTextContent('Ground')
    rerender(<TabBar locale="ru" />)
    const link = screen.getByRole('link', { name: 'Наземные путешествия' })
    expect(link).toHaveTextContent('Наземные')
  })

  it('marks ground travel current on its nested form routes', () => {
    route.pathname = '/ground-travel/new'
    render(<TabBar />)
    expect(screen.getByRole('link', { name: 'Ground travel' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('hides the rail while the on-screen keyboard is open', () => {
    render(<TabBar />)
    viewport.height = 400
    act(() => viewport.listeners.forEach((listener) => listener()))
    expect(document.documentElement.dataset.keyboard).toBe('true')
  })
})

describe('NAV_ITEMS', () => {
  it('lists the desktop destinations in order', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/overview',
      '/journal',
      '/ground-travel',
      '/passport',
    ])
  })
})
