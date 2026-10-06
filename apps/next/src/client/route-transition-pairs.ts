import { useEffect, useState } from 'react'

/**
 * The only route changes allowed to animate (DESIGN.md "Motion"). A stage remounts its transition boundary
 * for these pairs alone; every other navigation keeps the boundary and swaps the page instantly.
 */
export type StageKind = 'page'

const isProfile = (path: string) => /^\/fly\/[^/]+$/.test(path)

/** Import done → Passport, forward only. */
export const isStampHero = (from: string, to: string) => from === '/import' && to === '/passport'

/**
 * Leaderboard → a public profile, and Back. Back onto a profile, or a link from one to the leaderboard, stays instant.
 * `back` is null for a Back or Forward the browser cannot tell apart, which drills neither way.
 */
export const isProfileDrill = (from: string, to: string, back: boolean | null) =>
  back === null ? false : back ? isProfile(from) && to === '/leaderboard' : from === '/leaderboard' && isProfile(to)

export function isApprovedPair(stage: StageKind, from: string, to: string, back: boolean | null = false) {
  return stage === 'page' && (isStampHero(from, to) || isProfileDrill(from, to, back))
}

// The last Back or Forward, until the stage renders a pathname change: where it landed and whether it went back. Only
// the Navigation API tells Back from Forward; without it the direction is unknown (null).
type HistoryNavigation = EventTarget & { currentEntry: { index: number } | null }
type EntryChange = Event & { navigationType: string | null; from: { index: number } }
let traversal: { pathname: string; back: boolean | null } | null = null
const navigation = typeof window === 'undefined' ? undefined : (window as Window & { navigation?: HistoryNavigation }).navigation
if (navigation) navigation.addEventListener('currententrychange', event => {
  const { navigationType, from } = event as EntryChange
  if (navigationType === 'push') traversal = null
  if (navigationType === 'traverse') traversal = { pathname: location.pathname, back: (navigation.currentEntry?.index ?? Infinity) < from.index }
})
else if (typeof window !== 'undefined') window.addEventListener('popstate', () => { traversal = { pathname: location.pathname, back: null } })

/**
 * The boundary keeps its key, and so its DOM node, unless the pathname change is an approved pair. ssgoi
 * then sees no outgoing page, so every other navigation stays an instant swap with no scroll reset.
 */
export function useTransitionKey(stage: StageKind, pathname: string) {
  const [state, setState] = useState({ pathname, key: 0 })
  useEffect(() => { traversal = null }, [pathname])
  if (state.pathname === pathname) return state.key
  const key = isApprovedPair(stage, state.pathname, pathname, traversal?.pathname === pathname ? traversal.back : false) ? state.key + 1 : state.key
  setState({ pathname, key })
  return key
}
