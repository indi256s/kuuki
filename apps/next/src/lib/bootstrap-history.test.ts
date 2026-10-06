import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
const source = readFileSync(new URL('../../public/bootstrap.js', import.meta.url), 'utf8')
describe('early App Router history direction', () => {
  it('tags entries before Next and preserves its payload through replace, Back, Forward and native hashes', () => {
    const listeners = new Map<string, (event?: { stopImmediatePropagation: () => void }) => void>()
    let blockTraversal = false
    const gates: Event[] = []
    const history = { state: { __NA: true, tree: 'initial' } as Record<string, unknown>, pushState(state: Record<string, unknown>) { this.state = state }, replaceState(state: Record<string, unknown>) { this.state = state } }
    const context = { history, location: { pathname: '/settings', hash: '' }, Event, window: { __kuukiHistoryGate: false, dispatchEvent: (event: Event) => { if (event.type === 'kuuki:before-popstate') { gates.push(event); if (blockTraversal) event.preventDefault() } }, addEventListener: (event: string, run: () => void) => listeners.set(event, run) }, document: { cookie: 'kuuki_theme=light; kuuki_locale=en; kuuki_accent=ai', documentElement: { dataset: {}, style: {} } }, localStorage: { getItem: () => null }, navigator: { language: 'en' }, matchMedia: () => ({ matches: false }) }
    vm.runInNewContext(source, context)
    expect(context.window.__kuukiHistoryGate).toBe(true)
    expect(history.state).toEqual({ __NA: true, tree: 'initial', __kuukiHistoryIndex: 0 })
    history.pushState({ __NA: true, tree: 'next' })
    expect(history.state).toMatchObject({ tree: 'next', __kuukiHistoryIndex: 1 })
    history.replaceState({ __NA: true, tree: 'refreshed' })
    expect(history.state).toMatchObject({ tree: 'refreshed', __kuukiHistoryIndex: 1 })
    const settings = history.state
    history.pushState({ __NA: true, tree: 'other' })
    const forward = history.state
    history.state = settings; listeners.get('popstate')!()
    expect(history.state.__kuukiHistoryIndex).toBe(1)
    history.state = forward; listeners.get('popstate')!()
    expect(history.state.__kuukiHistoryIndex).toBe(2)
    history.state = {}; listeners.get('hashchange')!()
    expect(history.state.__kuukiHistoryIndex).toBe(3)
    const event = { stopImmediatePropagation: vi.fn() }
    blockTraversal = true
    listeners.get('popstate')!(event)
    expect(gates.at(-1)?.cancelable).toBe(true)
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce()
    expect(history.state).toMatchObject({ __kuukiHistoryIndex: 3 })
    blockTraversal = false
    event.stopImmediatePropagation.mockClear()
    listeners.get('popstate')!(event)
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled()
  })
})
