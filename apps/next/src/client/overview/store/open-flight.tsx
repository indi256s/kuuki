'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FlightDetailSheet } from '../../capture/flight-panels'
import { useOverview } from './overview-context'

export type MakerMetric = 'flights' | 'hours' | 'km'
function flightId(raw: string | null): number | null {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}
function useOverviewURL() {
  const pathname = usePathname(), params = useSearchParams(), router = useRouter()
  const { navigation, isCurrent } = useOverview()
  const query = params.toString()
  const url = pathname + (query ? `?${query}` : '')
  useEffect(() => { navigation.observe(url, window.location.hash) }, [url, navigation])
  useEffect(() => {
    const traverse = () => navigation.traverse(window.location.pathname + window.location.search + window.location.hash)
    window.addEventListener('popstate', traverse)
    window.addEventListener('hashchange', traverse)
    return () => { window.removeEventListener('popstate', traverse); window.removeEventListener('hashchange', traverse) }
  }, [navigation])
  const change = (key: 'flight' | 'makers', value: string | null, mode: 'push' | 'replace') => {
    if (!isCurrent()) return
    const requested = navigation.getRequested()
    const base = new URL(requested && new URL(requested, window.location.href).pathname === pathname
      ? requested : url + window.location.hash, window.location.href)
    if (value) base.searchParams.set(key, value)
    else base.searchParams.delete(key)
    const target = base.pathname + base.search + base.hash
    if (target === (requested ?? url + window.location.hash)) return
    navigation.request(target)
    router[mode](target, { scroll: false })
  }
  return { params, pathname, change }
}
export function useOpenFlight() {
  const { aggregate, ownerKey, navigation } = useOverview()
  const { change } = useOverviewURL()
  return (id: number) => {
    if (aggregate || ownerKey === 'dev' || !Number.isSafeInteger(id) || id <= 0) return
    navigation.captureOpener()
    change('flight', String(id), 'push')
  }
}
export function useMakerMetric(): readonly [MakerMetric, (metric: MakerMetric) => void] {
  const { params, change } = useOverviewURL()
  const raw = params.get('makers')
  const metric = raw === 'hours' || raw === 'km' ? raw : 'flights'
  return [metric, next => {
    if (next === 'flights' || next === 'hours' || next === 'km') change('makers', next === 'flights' ? null : next, 'replace')
  }]
}
export function OverviewFlightSheet() {
  const { aggregate, ownerKey, locale, navigation, revalidate, isCurrent } = useOverview()
  const { params, pathname, change } = useOverviewURL()
  const id = aggregate || ownerKey === 'dev' ? null : flightId(params.get('flight'))
  const latestRevalidate = useRef(revalidate)
  useEffect(() => { latestRevalidate.current = revalidate }, [revalidate])
  useEffect(() => {
    if (id === null) return
    return () => { void latestRevalidate.current() }
  }, [id])
  if (id === null) return null
  return <FlightDetailSheet ownerId={ownerKey} locale={locale} flightId={id}
    onOpenChange={open => { if (!open) change('flight', null, 'replace') }}
    onCloseAutoFocus={event => {
      event.preventDefault()
      const current = new URL(navigation.getRequested() ?? window.location.href, window.location.href)
      if (isCurrent() && current.pathname === pathname && flightId(current.searchParams.get('flight')) === null) navigation.restoreFocus()
    }} />
}
