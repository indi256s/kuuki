// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { isApprovedPair, useTransitionKey, type StageKind } from './route-transition-pairs'

function walk(stage: StageKind, paths: string[]) {
  const view = renderHook(({ path }) => useTransitionKey(stage, path), { initialProps: { path: paths[0]! } })
  return paths.slice(1).map(path => { view.rerender({ path }); return view.result.current })
}

describe('approved route transitions', () => {
  it('approves only the three DESIGN.md pairs', () => {
    expect(isApprovedPair('page', '/import', '/passport')).toBe(true)
    expect(isApprovedPair('page', '/passport', '/import')).toBe(false)
    expect(isApprovedPair('page', '/leaderboard', '/fly/ana')).toBe(true)
    expect(isApprovedPair('page', '/fly/ana', '/leaderboard')).toBe(true)
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
    expect(walk('page', ['/leaderboard', '/fly/ana', '/leaderboard', '/overview'])).toEqual([1, 2, 2])
    expect(walk('auth', ['/signin', '/signup', '/forgot-password', '/signin'])).toEqual([1, 2, 3])
  })
})
