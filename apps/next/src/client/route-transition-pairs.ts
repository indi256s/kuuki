import { useEffect, useState } from 'react'

/**
 * The only route changes allowed to animate (DESIGN.md "Route transitions"). A stage remounts its transition boundary
 * for these pairs alone; every other navigation keeps the boundary and swaps the page instantly.
 */
export type StageKind = 'page'

const isProfile = (path: string) => /^\/fly\/[^/]+$/.test(path)

/** The member pages reached from the header, the tab rail and the account menu. Sheets (`/add`, a Journal flight) are not among them. */
export const TAB_ROUTES = [
  '/overview',
  '/journal',
  '/ground-travel',
  '/passport',
  '/import',
  '/settings',
]

/** One top-level member page to another, either way, Back and Forward included. */
export const isTabSwitch = (from: string, to: string) =>
  from !== to && TAB_ROUTES.includes(from) && TAB_ROUTES.includes(to)

/** Import done → Passport, forward only. */
export const isStampHero = (from: string, to: string) => from === '/import' && to === '/passport'

/**
 * Leaderboard → a public profile, and Back. Back onto a profile, or a link from one to the leaderboard, stays instant.
 * `back` is null for a Back or Forward the browser cannot tell apart, which drills neither way.
 */
export const isProfileDrill = (from: string, to: string, back: boolean | null) =>
  back === null
    ? false
    : back
      ? isProfile(from) && to === '/leaderboard'
      : from === '/leaderboard' && isProfile(to)

export function isApprovedPair(
  stage: StageKind,
  from: string,
  to: string,
  back: boolean | null = false,
) {
  return (
    stage === 'page' &&
    (isTabSwitch(from, to) || isStampHero(from, to) || isProfileDrill(from, to, back))
  )
}

// The last Back or Forward, until the stage renders a pathname change: where it landed and whether it went back. Only
// the Navigation API tells Back from Forward; without it the direction is unknown (null).
type HistoryNavigation = EventTarget & { currentEntry: { index: number } | null }
type EntryChange = Event & { navigationType: string | null; from: { index: number } }
let traversal: { pathname: string; back: boolean | null } | null = null
const navigation =
  typeof window === 'undefined'
    ? undefined
    : (window as Window & { navigation?: HistoryNavigation }).navigation
if (navigation)
  navigation.addEventListener('currententrychange', (event) => {
    const { navigationType, from } = event as EntryChange
    if (navigationType === 'push') traversal = null
    if (navigationType === 'traverse')
      traversal = {
        pathname: location.pathname,
        back: (navigation.currentEntry?.index ?? Infinity) < from.index,
      }
  })
else if (typeof window !== 'undefined')
  window.addEventListener('popstate', () => {
    traversal = { pathname: location.pathname, back: null }
  })

// Where the last activated link was heading, when the keyboard activated it (a click with `detail` 0, as in
// `ui/button.tsx`). A tab switch to that pathname swaps instantly; any later click replaces it.
let keyboardTarget: string | null = null
if (typeof document !== 'undefined')
  document.addEventListener(
    'click',
    (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      keyboardTarget =
        link instanceof HTMLAnchorElement && event.detail === 0 ? new URL(link.href).pathname : null
    },
    true,
  )

/**
 * The boundary keeps its key, and so its DOM node, unless the pathname change is an approved pair. ssgoi
 * then sees no outgoing page, so every other navigation stays an instant swap with no scroll reset.
 */
export function useTransitionKey(stage: StageKind, pathname: string) {
  const [state, setState] = useState({ pathname, key: 0 })
  useEffect(() => {
    traversal = null
    keyboardTarget = null
  }, [pathname])
  if (state.pathname === pathname) return state.key
  const keyboardTab = keyboardTarget === pathname && isTabSwitch(state.pathname, pathname)
  const key =
    !keyboardTab &&
    isApprovedPair(
      stage,
      state.pathname,
      pathname,
      traversal?.pathname === pathname ? traversal.back : false,
    )
      ? state.key + 1
      : state.key
  setState({ pathname, key })
  return key
}
