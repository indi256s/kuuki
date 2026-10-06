// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { isApprovedPair, useTransitionKey, type StageKind } from './route-transition-pairs'

// jsdom has no Navigation API; this stand-in reports entry changes the way the browser does.
const navigation = vi.hoisted(() => {
  const target = Object.assign(new EventTarget(), { currentEntry: { index: 0 } })
  Object.defineProperty(window, 'navigation', { value: target, configurable: true })
  return target
})
function moveTo(path: string, navigationType: 'push' | 'traverse', index: number) {
  const from = { index: navigation.currentEntry.index }
  history.replaceState(null, '', path)
  navigation.currentEntry = { index }
  navigation.dispatchEvent(Object.assign(new Event('currententrychange'), { navigationType, from }))
}

/** Walks the paths as link clicks; a path starting with `<` is reached with Back and one with `>` with Forward. */
function walk(stage: StageKind, paths: string[]) {
  moveTo(paths[0]!, 'push', 0)
  const view = renderHook(({ path }) => useTransitionKey(stage, path), { initialProps: { path: paths[0]! } })
  return paths.slice(1).map(step => {
    const path = step.replace(/^[<>]/, ''), index = navigation.currentEntry.index
    moveTo(path, step[0] === '<' || step[0] === '>' ? 'traverse' : 'push', step[0] === '<' ? index - 1 : index + 1)
    view.rerender({ path })
    return view.result.current
  })
}

describe('approved route transitions', () => {
  it('approves only the three DESIGN.md pairs', () => {
    expect(isApprovedPair('page', '/import', '/passport')).toBe(true)
    expect(isApprovedPair('page', '/passport', '/import')).toBe(false)
    expect(isApprovedPair('page', '/leaderboard', '/fly/ana')).toBe(true)
    expect(isApprovedPair('page', '/leaderboard', '/fly/ana', true)).toBe(false)
    expect(isApprovedPair('page', '/fly/ana', '/leaderboard', true)).toBe(true)
    expect(isApprovedPair('page', '/fly/ana', '/leaderboard')).toBe(false)
    expect(isApprovedPair('page', '/fly/ana', '/fly/ben')).toBe(false)
    expect(isApprovedPair('page', '/leaderboard', '/fly/ana/extra')).toBe(false)
    for (const [from, to] of [['/signin', '/signup'], ['/signup', '/forgot-password'], ['/forgot-password', '/signin']]) {
      expect(isApprovedPair('auth', from!, to!)).toBe(true)
      expect(isApprovedPair('page', from!, to!)).toBe(false)
    }
    expect(isApprovedPair('auth', '/signin', '/signin')).toBe(false)
    for (const [from, to] of [['/overview', '/journal'], ['/journal', '/passport'], ['/overview', '/import'], ['/passport', '/passport/manage'], ['/journal', '/add'], ['/overview', '/leaderboard']]) {
      expect(isApprovedPair('page', from!, to!)).toBe(false)
    }
  })

  it('keeps the boundary key for tab navigation so the page swaps instantly', () => {
    expect(walk('page', ['/overview', '/journal', '/passport', '/import', '/overview'])).toEqual([0, 0, 0, 0])
  })

  it('remounts the boundary only for approved pairs', () => {
    expect(walk('page', ['/overview', '/import', '/passport', '/import', '/passport'])).toEqual([0, 1, 1, 2])
    expect(walk('page', ['/leaderboard', '/fly/ana', '</leaderboard', '/overview'])).toEqual([1, 2, 2])
    // Only Back reverses the drill: a link from a profile to the leaderboard stays instant, before or after a Back.
    expect(walk('page', ['/leaderboard', '/fly/ana', '/leaderboard'])).toEqual([1, 1])
    expect(walk('page', ['/fly/ana', '/leaderboard', '/fly/ben', '</leaderboard', '/fly/ben', '/leaderboard'])).toEqual([0, 1, 2, 3, 3])
    // A Back that stays on the profile (a closed sheet) does not make the next link a Back.
    expect(walk('page', ['/leaderboard', '/fly/ana', '</fly/ana', '/leaderboard'])).toEqual([1, 1, 1])
    // Back onto a profile is not the drill, and Forward redoes the link that led to the leaderboard: both stay instant.
    expect(walk('page', ['/fly/ana', '/leaderboard', '</fly/ana', '>/leaderboard'])).toEqual([0, 0, 0])
    // Forward redoes a drill into a profile, so it drills again.
    expect(walk('page', ['/leaderboard', '/fly/ana', '</leaderboard', '>/fly/ana'])).toEqual([1, 2, 3])
    expect(walk('auth', ['/signin', '/signup', '/forgot-password', '/signin'])).toEqual([1, 2, 3])
  })

  it('drills neither way on a Back or Forward when the browser has no Navigation API', async () => {
    const api = Object.getOwnPropertyDescriptor(window, 'navigation')!
    Reflect.deleteProperty(window, 'navigation')
    vi.resetModules()
    const { useTransitionKey: keyWithoutApi } = await import('./route-transition-pairs')
    Object.defineProperty(window, 'navigation', api)
    /** A path starting with `~` is reached with Back or Forward, which only fires popstate here. */
    const walkWithoutApi = (paths: string[]) => {
      history.replaceState(null, '', paths[0]!)
      const view = renderHook(({ path }) => keyWithoutApi('page', path), { initialProps: { path: paths[0]! } })
      return paths.slice(1).map(step => {
        const path = step.replace(/^~/, '')
        if (step.startsWith('~')) { history.replaceState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }
        else history.pushState(null, '', path)
        view.rerender({ path })
        return view.result.current
      })
    }
    expect(walkWithoutApi(['/fly/ana', '/leaderboard', '~/fly/ana', '~/leaderboard'])).toEqual([0, 0, 0])
    expect(walkWithoutApi(['/leaderboard', '/fly/ana', '~/leaderboard', '/fly/ben'])).toEqual([1, 1, 2])
  })
})
