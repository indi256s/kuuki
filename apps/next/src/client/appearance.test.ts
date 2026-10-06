// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { AppearanceProvider, setAccent, setTheme } from './appearance'
import { THEME_COLOR, type Accent } from '../lib/theme-colors'

describe('setAccent', () => {
  let writes: string[]
  beforeEach(() => {
    writes = []
    delete document.documentElement.dataset.accent
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
    vi.spyOn(document, 'cookie', 'set').mockImplementation(value => { writes.push(value); original.set!.call(document, value) })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('writes the cookie in the bootstrap.js format and sets data-accent', () => {
    setAccent('matcha')
    expect(writes).toEqual(['kuuki_accent=matcha; Path=/; Max-Age=31536000; SameSite=Lax'])
    expect(document.documentElement.dataset.accent).toBe('matcha')
  })

  it('uses the same cookie template as public/bootstrap.js', () => {
    const bootstrap = readFileSync(join(__dirname, '../../public/bootstrap.js'), 'utf8')
    expect(bootstrap).toContain('`kuuki_accent=${accent}; Path=/; Max-Age=31536000; SameSite=Lax`')
  })

  it('ignores unknown names: no cookie write, dataset unchanged', () => {
    setAccent('sakura')
    writes.length = 0
    setAccent('blue' as Accent)
    expect(writes).toEqual([])
    expect(document.documentElement.dataset.accent).toBe('sakura')
  })
})

describe('AppearanceProvider accent normalisation', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.accent
    document.cookie = 'kuuki_accent=; Path=/; Max-Age=0'
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it.each(['kincha', 'sumi'])('rewrites a stored %s to terracotta in the cookie and on <html> when mounted', removed => {
    document.cookie = `kuuki_accent=${removed}; Path=/`
    document.documentElement.dataset.accent = removed
    render(createElement(AppearanceProvider))
    expect(document.cookie).toContain('kuuki_accent=terracotta')
    expect(document.cookie).not.toContain(removed)
    expect(document.documentElement.dataset.accent).toBe('terracotta')
  })

  it('leaves a current accent alone', () => {
    document.cookie = 'kuuki_accent=asagi; Path=/'
    document.documentElement.dataset.accent = 'asagi'
    render(createElement(AppearanceProvider))
    expect(document.cookie).toContain('kuuki_accent=asagi')
    expect(document.documentElement.dataset.accent).toBe('asagi')
  })
})

describe('setTheme sweep', () => {
  type Pending = { update: () => void; finish: () => void }
  let transitions: Pending[]
  let frames: FrameRequestCallback[]
  let reduced: boolean
  const root = document.documentElement
  const bar = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content')
  const flush = () => new Promise(resolve => setTimeout(resolve, 0))

  beforeEach(() => {
    transitions = []
    frames = []
    reduced = false
    root.dataset.theme = 'light'
    delete root.dataset.themeSwitching
    delete root.dataset.routeTransition
    document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLOR.light}">`
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion') && reduced }))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    Object.assign(document, {
      startViewTransition: (update: () => void) => {
        let finish!: () => void
        const finished = new Promise<void>(resolve => { finish = resolve })
        transitions.push({ update, finish })
        return { finished }
      },
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (document as Partial<Document>).startViewTransition
  })

  it('brings dusk down from the top: the browser bar turns dark as the sweep starts', async () => {
    setTheme('dark')
    expect(root.dataset.themeSwitching).toBe('dusk')
    expect(bar()).toBe(THEME_COLOR.light)
    transitions[0].update()
    expect(root.dataset.theme).toBe('dark')
    expect(bar()).toBe(THEME_COLOR.dark)
    transitions[0].finish()
    await flush()
    expect(root.dataset.themeSwitching).toBeUndefined()
  })

  it('raises dawn from the bottom: the browser bar stays dark until the sweep reaches the top', async () => {
    root.dataset.theme = 'dark'
    document.querySelector('meta[name="theme-color"]')!.setAttribute('content', THEME_COLOR.dark)
    setTheme('light')
    expect(root.dataset.themeSwitching).toBe('dawn')
    transitions[0].update()
    expect(root.dataset.theme).toBe('light')
    expect(bar()).toBe(THEME_COLOR.dark)
    transitions[0].finish()
    await flush()
    expect(bar()).toBe(THEME_COLOR.light)
    expect(root.dataset.themeSwitching).toBeUndefined()
  })

  it('changes the browser bar with the page under reduced motion, which fades instead of sweeping', () => {
    reduced = true
    root.dataset.theme = 'dark'
    setTheme('light')
    transitions[0].update()
    expect(bar()).toBe(THEME_COLOR.light)
  })

  it('stays correct when a second toggle skips the first sweep', async () => {
    setTheme('dark')
    transitions[0].update()
    setTheme('light')
    // The browser skips the first transition; its finish must not clear the attribute the second switch still needs.
    transitions[0].finish()
    await flush()
    expect(root.dataset.themeSwitching).toBe('dawn')
    // The second sweep starts from the dark page the first one painted, so the bar stays dark until it ends.
    transitions[1].update()
    expect(bar()).toBe(THEME_COLOR.dark)
    transitions[1].finish()
    await flush()
    expect(root.dataset.theme).toBe('light')
    expect(bar()).toBe(THEME_COLOR.light)
    expect(root.dataset.themeSwitching).toBeUndefined()
  })

  it('swaps at once, browser bar included, during a route transition', () => {
    root.dataset.routeTransition = 'drill'
    setTheme('dark')
    expect(transitions).toHaveLength(0)
    expect(root.dataset.theme).toBe('dark')
    expect(bar()).toBe(THEME_COLOR.dark)
    expect(root.dataset.themeSwitching).toBe('dusk')
    frames.shift()!(0)
    frames.shift()!(0)
    expect(root.dataset.themeSwitching).toBeUndefined()
  })
})
