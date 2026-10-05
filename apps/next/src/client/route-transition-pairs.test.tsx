// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { isApprovedPair, useTransitionKey, type StageKind } from './route-transition-pairs'

/** Walks the paths as link clicks; a path starting with `<` is reached with Back, as the browser fires popstate. */
function walk(stage: StageKind, paths: string[]) {
  const view = renderHook(({ path }) => useTransitionKey(stage, path), { initialProps: { path: paths[0]! } })
  return paths.slice(1).map(step => {
    const path = step.replace(/^</, '')
    if (step.startsWith('<')) { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }
    view.rerender({ path })
    return view.result.current
  })
}

describe('approved route transitions', () => {
  it('approves only the three DESIGN.md pairs', () => {
    expect(isApprovedPair('page', '/import', '/passport')).toBe(true)
    expect(isApprovedPair('page', '/passport', '/import')).toBe(false)
    expect(isApprovedPair('page', '/leaderboard', '/fly/ana')).toBe(true)
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
    expect(walk('auth', ['/signin', '/signup', '/forgot-password', '/signin'])).toEqual([1, 2, 3])
  })
})
