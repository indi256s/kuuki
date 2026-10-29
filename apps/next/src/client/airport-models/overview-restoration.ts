'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { useOverview } from '../overview/store/overview-context'
import { updateOverviewReturn } from './return-session'

export function useAirportOverviewRestoration({
  mobile,
  ready,
  openId,
  open,
  visible,
  page,
}: {
  mobile: boolean | null
  ready: boolean
  openId: SectionId | null
  open: (id: SectionId) => void
  visible: SectionId[]
  page: RefObject<HTMLDivElement | null>
}) {
  const { airportReturn: snapshot, ownerKey } = useOverview()
  const completed = useRef<string | null>(null)
  const visibleKey = visible.join(',')
  useEffect(() => {
    if (!snapshot || !ready || mobile === null || completed.current === snapshot.token) return
    if (
      mobile &&
      snapshot.mobileChapter &&
      visible.includes(snapshot.mobileChapter) &&
      openId !== snapshot.mobileChapter
    ) {
      open(snapshot.mobileChapter)
      return
    }
    let cancelled = false
    let frame = 0
    const finish = (fallback = false) => {
      if (cancelled || !page.current?.isConnected) return
      const slide = mobile
        ? document.querySelector<HTMLElement>('[data-airport-chapter="rankings"]:not([inert])')
        : null
      const root = slide ?? page.current
      const target = root.querySelector<HTMLElement>(`[data-airport-opener="${snapshot.opener}"]`)
      if (!target && !fallback) return
      window.scrollTo({ top: snapshot.pageY, behavior: 'instant' })
      if (slide) slide.scrollTop = snapshot.sheetY
      const focus =
        target ??
        page.current.querySelector<HTMLElement>(
          '[data-section-tile="rankings"], [data-section-options="rankings"], h1',
        )
      focus?.focus({ preventScroll: true })
      completed.current = snapshot.token
      observer.disconnect()
      clearTimeout(timer)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => finish())
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['inert'],
    })
    const timer = setTimeout(() => finish(true), 2500)
    const cancel = () => {
      cancelled = true
      completed.current = snapshot.token
      observer.disconnect()
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
    window.addEventListener('pointerdown', cancel, { capture: true, once: true })
    window.addEventListener('keydown', cancel, { capture: true, once: true })
    window.addEventListener('wheel', cancel, { capture: true, once: true })
    schedule()
    return () => {
      cancelled = true
      observer.disconnect()
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', cancel, true)
      window.removeEventListener('keydown', cancel, true)
      window.removeEventListener('wheel', cancel, true)
    }
  }, [snapshot?.token, ready, mobile, openId, visibleKey, ownerKey, page, open, snapshot, visible])
  useEffect(() => {
    if (!snapshot || mobile === null) return
    const remember = () => {
      if (completed.current !== snapshot.token) return
      const slide = document.querySelector<HTMLElement>(
        '[data-airport-chapter="rankings"]:not([inert])',
      )
      updateOverviewReturn(ownerKey, {
        pageY: window.scrollY,
        sheetY: slide?.scrollTop ?? 0,
        mobileChapter: mobile ? openId : null,
      })
    }
    remember()
    document.addEventListener('scroll', remember, true)
    return () => document.removeEventListener('scroll', remember, true)
  }, [ownerKey, snapshot?.token, mobile, openId, snapshot])
}
