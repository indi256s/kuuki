import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
const source = readFileSync(new URL('../../public/bootstrap.js', import.meta.url), 'utf8')
describe('early App Router history direction', () => {
  it('tags entries before Next and preserves its payload through replace, Back, Forward and native hashes', () => {
    const listeners = new Map<string, () => void>()
    const history = { state: { __NA: true, tree: 'initial' } as Record<string, unknown>, pushState(state: Record<string, unknown>) { this.state = state }, replaceState(state: Record<string, unknown>) { this.state = state } }
    const context = { history, location: { pathname: '/settings', hash: '' }, window: { addEventListener: (event: string, run: () => void) => listeners.set(event, run) }, document: { cookie: 'kuuki_theme=light; kuuki_locale=en; kuuki_accent=ai', documentElement: { dataset: {}, style: {} } }, localStorage: { getItem: () => null }, navigator: { language: 'en' }, matchMedia: () => ({ matches: false }) }
    vm.runInNewContext(source, context)
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
  })
})
