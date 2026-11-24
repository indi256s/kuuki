'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { SectionId } from '@kuuki/shared/overview/prefs'

const TEXT_SHIFT = 24
const DETENT_TICK = 8
const SETTLE_QUIET = 120

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const ms = (name: string) => {
  const value = token(name)
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) || 0
}

type SnapEvent = Event & { snapTargetInline: Element | null }

function trackPosition(track: HTMLElement) {
  return track.clientWidth > 0 ? track.scrollLeft / track.clientWidth : 0
}

export function useChapterTrack({
  openId,
  order,
  onNavigate,
}: {
  openId: SectionId | null
  order: SectionId[]
  onNavigate: (id: SectionId) => void
}) {
  const track = useRef<HTMLDivElement | null>(null)
  const [trackNode, setTrackNode] = useState<HTMLDivElement | null>(null)
  const trackRef = useCallback((node: HTMLDivElement | null) => {
    track.current = node
    setTrackNode(node)
  }, [])
  const heading = useRef<HTMLSpanElement>(null)
  const previousLabel = useRef<HTMLSpanElement>(null)
  const nextLabel = useRef<HTMLSpanElement>(null)
  const texts = [heading, previousLabel, nextLabel]
  const [shown, setShown] = useState(openId)
  const shownRef = useRef(openId)
  const aimed = useRef<SectionId | null>(null)
  const pinned = useRef(false)
  const lastDetent = useRef<Element | null>(null)
  const touching = useRef(false)
  const orderKey = order.join()
  const navigate = useRef(onNavigate)
  useLayoutEffect(() => {
    navigate.current = onNavigate
  })
  const [synced, setSynced] = useState(openId)
  if (openId !== synced) {
    setSynced(openId)
    if (!openId || !shown || !order.includes(shown)) setShown(openId)
  }
  useLayoutEffect(() => {
    shownRef.current = shown
  }, [shown])

  const show = (id: SectionId) => {
    if (id === shownRef.current || !order.includes(id)) return
    shownRef.current = id
    setShown(id)
  }

  const paintText = (offset: number) => {
    const still = offset === 0 || pinned.current || reducedMotion()
    for (const { current: text } of texts) {
      if (!text) continue
      text.style.transform = still ? '' : `translate3d(${-offset * 2 * TEXT_SHIFT}px,0,0)`
      text.style.opacity = still ? '' : String(1 - Math.abs(offset) * 2)
    }
  }

  useLayoutEffect(() => {
    const node = trackNode
    const slide = openId
      ? (node?.children[order.indexOf(openId)] as HTMLElement | undefined)
      : undefined
    if (node && slide && Math.abs(node.scrollLeft - slide.offsetLeft) > 1)
      node.scrollTo({ left: slide.offsetLeft, behavior: 'instant' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is a fresh array on every render; its contents are `orderKey`.
  }, [openId, orderKey, trackNode])

  useEffect(() => {
    const node = trackNode
    if (!node || !openId) return
    const last = order.length - 1
    const settle = () => {
      const id = order[Math.max(0, Math.min(last, Math.round(trackPosition(node))))]
      if (!id) return
      pinned.current = false
      aimed.current = null
      show(id)
      paintText(0)
      Array.from(node.children).forEach((slide, index) => {
        if (order[index] !== id) slide.scrollTop = 0
      })
      if (id !== openId) navigate.current(id)
    }
    const scrollEnd = 'onscrollend' in node
    let quiet = 0
    let frame = 0
    const follow = () => {
      frame = 0
      const position = Math.max(0, Math.min(last, trackPosition(node)))
      const nearest = Math.round(position)
      if (!pinned.current && order[nearest] && order[nearest] !== shownRef.current)
        flushSync(() => show(order[nearest]))
      paintText(Math.abs(position - nearest) < 0.001 ? 0 : position - nearest)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(follow)
      if (!scrollEnd) {
        window.clearTimeout(quiet)
        quiet = window.setTimeout(settle, SETTLE_QUIET)
      }
    }
    const onSnapChanging = (event: Event) => {
      const target = (event as SnapEvent).snapTargetInline
      if (target && target !== lastDetent.current && touching.current)
        navigator.vibrate?.(DETENT_TICK)
      lastDetent.current = target
    }
    const onTouchStart = () => {
      touching.current = true
    }
    const onTouchEnd = () => {
      touching.current = false
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    node.addEventListener('scrollend', settle)
    node.addEventListener('scrollsnapchanging', onSnapChanging)
    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchend', onTouchEnd, { passive: true })
    node.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.clearTimeout(quiet)
      cancelAnimationFrame(frame)
      node.removeEventListener('scroll', onScroll)
      node.removeEventListener('scrollend', settle)
      node.removeEventListener('scrollsnapchanging', onSnapChanging)
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('touchcancel', onTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is a fresh array on every render; its contents are `orderKey`.
  }, [openId, orderKey, trackNode])

  const go = (dir: 1 | -1, { keyboard = false } = {}) => {
    const node = track.current
    const from = aimed.current ?? shownRef.current
    const index = (from ? order.indexOf(from) : -1) + dir
    const target = order[index]
    const slide = node?.children[index] as HTMLElement | undefined
    if (!node || !target || !slide) return
    aimed.current = target
    if (keyboard) {
      pinned.current = true
      show(target)
      paintText(0)
    }
    if (reducedMotion()) {
      node.scrollTo({ left: slide.offsetLeft, behavior: 'instant' })
      slide.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ms('--dur-fast'),
        easing: 'linear',
      })
    } else node.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }

  return { track: trackRef, heading, previousLabel, nextLabel, shown, go }
}
