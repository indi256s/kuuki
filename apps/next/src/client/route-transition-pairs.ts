import { useEffect, useState } from 'react'

/**
 * The only route changes allowed to animate (DESIGN.md "Motion"). A stage remounts its transition boundary
 * for these pairs alone; every other navigation keeps the boundary and swaps the page instantly.
 */
export type StageKind = 'page' | 'auth'

export const AUTH_SWAP_PATHS = ['/forgot-password', '/signin', '/signup'] as const

const isAuthPath = (path: string) => (AUTH_SWAP_PATHS as readonly string[]).includes(path)
const isProfile = (path: string) => /^\/fly\/[^/]+$/.test(path)

/** Import done → Passport, forward only. */
export const isStampHero = (from: string, to: string) => from === '/import' && to === '/passport'

/** Leaderboard → a public profile, and Back. Back onto a profile, or a link from one to the leaderboard, stays instant. */
export const isProfileDrill = (from: string, to: string, back: boolean) =>
  back ? isProfile(from) && to === '/leaderboard' : from === '/leaderboard' && isProfile(to)

/** Sign in ↔ sign up ↔ forgot password. */
export const isAuthSwap = (from: string, to: string) => from !== to && isAuthPath(from) && isAuthPath(to)

export function isApprovedPair(stage: StageKind, from: string, to: string, back = false) {
  return stage === 'auth' ? isAuthSwap(from, to) : isStampHero(from, to) || isProfileDrill(from, to, back)
}

// The pathname the last Back landed on, until the stage renders a pathname change. Only the Navigation API tells Back
// from Forward; a browser without it treats every traversal as a link, so the drill does not reverse.
type HistoryNavigation = EventTarget & { currentEntry: { index: number } | null }
type EntryChange = Event & { navigationType: string | null; from: { index: number } }
let backTo: string | null = null
const navigation = typeof window === 'undefined' ? undefined : (window as Window & { navigation?: HistoryNavigation }).navigation
navigation?.addEventListener('currententrychange', event => {
  const { navigationType, from } = event as EntryChange
  if (navigationType === 'push') backTo = null
  if (navigationType === 'traverse') backTo = (navigation.currentEntry?.index ?? Infinity) < from.index ? location.pathname : null
})

/**
 * The boundary keeps its key, and so its DOM node, unless the pathname change is an approved pair. ssgoi
 * then sees no outgoing page, so every other navigation stays an instant swap with no scroll reset.
 */
export function useTransitionKey(stage: StageKind, pathname: string) {
  const [state, setState] = useState({ pathname, key: 0 })
  useEffect(() => { backTo = null }, [pathname])
  if (state.pathname === pathname) return state.key
  const key = isApprovedPair(stage, state.pathname, pathname, backTo === pathname) ? state.key + 1 : state.key
  setState({ pathname, key })
  return key
}
