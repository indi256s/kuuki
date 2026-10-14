// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteFocus } from './route-focus'

let pathname = '/overview'
let search = new URLSearchParams()
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useSearchParams: () => search }))

function page() {
  document.body.innerHTML = '<main id="main"><h1>Title</h1><input id="q" /></main>'
  return document.querySelector('h1')!
}

describe('RouteFocus', () => {
  beforeEach(() => {
    pathname = '/journal'
    search = new URLSearchParams()
  })

  it('focuses the heading when the pathname changes', () => {
    const h1 = page()
    const view = render(<RouteFocus />)
    expect(document.activeElement).not.toBe(h1)
    pathname = '/passport'
    view.rerender(<RouteFocus />)
    expect(document.activeElement).toBe(h1)
    expect(h1.tabIndex).toBe(-1)
  })

  it('ignores filter, query and country changes', () => {
    pathname = '/passport'
    const h1 = page()
    const input = document.getElementById('q') as HTMLInputElement
    const view = render(<RouteFocus />)
    input.focus()
    for (const next of ['q=a', 'q=ab&country=JP', 'sort=name&region=asia&src=flights']) {
      search = new URLSearchParams(next)
      view.rerender(<RouteFocus />)
      expect(document.activeElement).toBe(input)
    }
    expect(document.activeElement).not.toBe(h1)
  })

  it('focuses when the passport view changes', () => {
    pathname = '/passport'
    const h1 = page()
    const view = render(<RouteFocus />)
    search = new URLSearchParams('view=map')
    view.rerender(<RouteFocus />)
    expect(document.activeElement).toBe(h1)
  })

  it('treats the visitor preview as a mode change that moves focus', () => {
    pathname = '/passport'
    const h1 = page()
    const view = render(<RouteFocus />)
    search = new URLSearchParams('as=visitor')
    view.rerender(<RouteFocus />)
    expect(document.activeElement).toBe(h1)
  })

  it('focuses the new view while the old one remains mounted and follows a heading that becomes hidden', async () => {
    pathname = '/passport'
    search = new URLSearchParams('view=list')
    document.body.innerHTML =
      '<main id="main"><div hidden><h1>Capture</h1></div><section><h1>Reveal</h1></section></main>'
    const view = render(<RouteFocus />)
    search = new URLSearchParams('view=map')
    view.rerender(<RouteFocus />)
    expect(document.activeElement?.textContent).toBe('Reveal')
    await act(async () => {
      document.querySelector('section')!.setAttribute('hidden', '')
      document.querySelector('main > div')!.removeAttribute('hidden')
      await Promise.resolve()
    })
    expect(document.activeElement?.textContent).toBe('Capture')
  })

  it('skips the inert outgoing page of a route transition', async () => {
    document.body.innerHTML =
      '<main id="main"><div data-ssgoi-transition="/passport"></div><div data-ssgoi-transition="/import" inert aria-hidden="true"><h1>Import</h1></div></main>'
    const ghost = document.querySelector('h1')!
    const focused: Element[] = []
    ghost.addEventListener('focus', () => focused.push(ghost))
    const view = render(<RouteFocus />)
    pathname = '/passport'
    view.rerender(<RouteFocus />)
    expect(focused).toEqual([])
    expect(document.activeElement).toBe(document.getElementById('main'))
    await act(async () => {
      document.querySelector('[data-ssgoi-transition="/passport"]')!.innerHTML = '<h1>Passport</h1>'
      await Promise.resolve()
    })
    expect(document.activeElement?.textContent).toBe('Passport')
  })

  it('follows a loading heading that is replaced while focus is lost', async () => {
    const first = page()
    const view = render(<RouteFocus />)
    pathname = '/overview'
    view.rerender(<RouteFocus />)
    expect(document.activeElement).toBe(first)
    await act(async () => {
      document.getElementById('main')!.innerHTML = '<h1>Real</h1>'
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(document.querySelector('h1'))
    expect(document.activeElement?.textContent).toBe('Real')
  })
})
