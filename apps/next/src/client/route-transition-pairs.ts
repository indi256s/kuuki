import { useState } from 'react'

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

/** Leaderboard → a public profile, and Back. */
export const isProfileDrill = (from: string, to: string) =>
  (from === '/leaderboard' && isProfile(to)) || (isProfile(from) && to === '/leaderboard')

/** Sign in ↔ sign up ↔ forgot password. */
export const isAuthSwap = (from: string, to: string) => from !== to && isAuthPath(from) && isAuthPath(to)

export function isApprovedPair(stage: StageKind, from: string, to: string) {
  return stage === 'auth' ? isAuthSwap(from, to) : isStampHero(from, to) || isProfileDrill(from, to)
}

/**
 * The boundary keeps its key, and so its DOM node, unless the pathname change is an approved pair. ssgoi
 * then sees no outgoing page, so every other navigation stays an instant swap with no scroll reset.
 */
export function useTransitionKey(stage: StageKind, pathname: string) {
  const [state, setState] = useState({ pathname, key: 0 })
  if (state.pathname === pathname) return state.key
  const key = isApprovedPair(stage, state.pathname, pathname) ? state.key + 1 : state.key
  setState({ pathname, key })
  return key
}
