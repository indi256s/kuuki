import { useEffect, useState } from 'react'

export type StageKind = 'page'

const isProfile = (path: string) => /^\/fly\/[^/]+$/.test(path)

export const TAB_ROUTES = [
  '/overview',
  '/journal',
  '/ground-travel',
  '/passport',
  '/import',
  '/settings',
]

const JOURNAL_SECTIONS = ['/journal', '/ground-travel']

export const isTabSwitch = (from: string, to: string) =>
  from !== to &&
  TAB_ROUTES.includes(from) &&
  TAB_ROUTES.includes(to) &&
  !(JOURNAL_SECTIONS.includes(from) && JOURNAL_SECTIONS.includes(to))

export const isStampHero = (from: string, to: string) => from === '/import' && to === '/passport'

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
