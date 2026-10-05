// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isActive, isKeyboardOpen, isMeActive, PrimaryNav, TabBar } from './nav'

let pathname = '/overview'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

describe('isActive', () => {
  it('matches the route and its nested paths, ignoring the query', () => {
    expect(isActive('/overview', '/overview')).toBe(true)
    expect(isActive('/journal/abc/edit', '/journal')).toBe(true)
    expect(isActive('/journal', '/overview')).toBe(false)
    expect(isActive('/journalism', '/journal')).toBe(false)
  })
  it('treats only /me and the own profile as Me', () => {
    expect(isMeActive('/me', 'ana')).toBe(true)
    expect(isMeActive('/fly/ana', 'ana')).toBe(true)
    expect(isMeActive('/fly/bob', 'ana')).toBe(false)
    expect(isMeActive('/fly/ana', null)).toBe(false)
  })
})

describe('isKeyboardOpen', () => {
  it('needs a clear shrink and no pinch zoom', () => {
    expect(isKeyboardOpen({ innerHeight: 800, viewportHeight: 500, scale: 1 })).toBe(true)
    expect(isKeyboardOpen({ innerHeight: 800, viewportHeight: 760, scale: 1 })).toBe(false)
    expect(isKeyboardOpen({ innerHeight: 800, viewportHeight: 500, scale: 2 })).toBe(false)
  })
})

describe('navigation aria-current', () => {
  beforeEach(() => { pathname = '/overview' })
  const current = (nav: HTMLElement) => within(nav).queryAllByRole('link').filter(link => link.getAttribute('aria-current') === 'page').map(link => link.getAttribute('href'))

  it('desktop: nested Journal path keeps Journal current', () => {
    pathname = '/journal/123/edit'
    render(<PrimaryNav />)
    expect(current(screen.getByRole('navigation', { hidden: true }))).toEqual(['/journal'])
  })

  it('tab bar: Overview stays current with a year query path and has five tabs', () => {
    pathname = '/overview'
    render(<TabBar username="ana" />)
    const nav = screen.getByRole('navigation')
    expect(current(nav)).toEqual(['/overview'])
    expect(within(nav).getAllByRole('listitem')).toHaveLength(5)
    expect(within(nav).getByRole('button', { name: /Add/ })).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('tab bar: own profile marks Me current', () => {
    pathname = '/fly/ana'
    render(<TabBar username="ana" />)
    expect(current(screen.getByRole('navigation'))).toEqual(['/me'])
  })
})
