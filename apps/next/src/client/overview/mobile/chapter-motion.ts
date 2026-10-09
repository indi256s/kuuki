'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { SectionId } from '@kuuki/shared/overview/prefs'

/** The heading and footer labels travel the same way as their chapter, but only a little: they are lighter than the content. */
const TEXT_SHIFT = 24
/** Android only (iOS Safari has no Vibration API): one short tick when a swipe passes the point where it will change chapter. */
const DETENT_TICK = 8
/** Settling fallback for browsers without `scrollend`. */
const SETTLE_QUIET = 120

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()
/** Duration tokens may compile to seconds (`.15s`), as FeedbackText also allows for. */
const ms = (name: string) => {
  const value = token(name)
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) || 0
}

/** Scroll Snap Events (Chromium 129+); without them there is no detent tick. */
type SnapEvent = Event & { snapTargetInline: Element | null }

/** The track's position in slides: 2.5 is halfway between the third and fourth chapters. */
function trackPosition(track: HTMLElement) {
  return track.clientWidth > 0 ? track.scrollLeft / track.clientWidth : 0
}

/**
 * Chapter paging in the Overview sheet. Chapters are slides in a horizontal scroll-snap track, so the browser owns the gesture:
 * the neighbour travels with the finger, momentum and the edge bounce are the platform's, and the axis lock is the one every
 * scroller uses. The script only follows the track: the heading and footer labels are driven by its scroll position, like the
 * pager's scroll timeline, so they move exactly as fast as the chapter whether a finger, momentum or Previous/Next moves it.
 * Each line fades out and slides with the outgoing chapter until the halfway point, switches there, and arrives with the
 * incoming one. The chapter becomes `openId` once the track settles.
 */
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
  // Radix mounts the sheet's portal a commit after it opens, so effects wait for the track node itself.
  const [trackNode, setTrackNode] = useState<HTMLDivElement | null>(null)
  const trackRef = useCallback((node: HTMLDivElement | null) => {
    track.current = node
    setTrackNode(node)
  }, [])
  const heading = useRef<HTMLSpanElement>(null)
  const previousLabel = useRef<HTMLSpanElement>(null)
  const nextLabel = useRef<HTMLSpanElement>(null)
  const texts = [heading, previousLabel, nextLabel]
  /** The chapter a release would land on now: it drives the heading, labels and pager ahead of `openId`. */
  const [shown, setShown] = useState(openId)
  const shownRef = useRef(openId)
  /** Where Previous/Next is heading, so a second press before the text switches goes one chapter further. */
  const aimed = useRef<SectionId | null>(null)
  /** A keyboard press shows its destination at once, so the focused button's name is right; the scroll position must not undo it. */
  const pinned = useRef(false)
  const lastDetent = useRef<Element | null>(null)
  const touching = useRef(false)
  const orderKey = order.join()
  const navigate = useRef(onNavigate)
  useLayoutEffect(() => {
    navigate.current = onNavigate
  })
  // A chapter opened from outside (a tile, closing, Hide) is shown at once; our own settles already match.
  const [synced, setSynced] = useState(openId)
  if (openId !== synced) {
    setSynced(openId)
    if (!openId || !shown || !order.includes(shown)) setShown(openId)
  }
  useLayoutEffect(() => {
    shownRef.current = shown
  }, [shown])

  /** Switches the heading, labels and pager to `id`. */
  const show = (id: SectionId) => {
    if (id === shownRef.current || !order.includes(id)) return
    shownRef.current = id
    setShown(id)
  }

  /**
   * One frame of the text: `offset` is how far the track is from the shown chapter's slide (-0.5 to 0.5). The lines fade and shift
   * with it, reaching nothing at the halfway point where the next chapter's text takes over from the opposite side.
   */
  const paintText = (offset: number) => {
    const still = offset === 0 || pinned.current || reducedMotion()
    for (const { current: text } of texts) {
      if (!text) continue
      text.style.transform = still ? '' : `translate3d(${-offset * 2 * TEXT_SHIFT}px,0,0)`
      text.style.opacity = still ? '' : String(1 - Math.abs(offset) * 2)
    }
  }

  // Opening, Hide and Move up/down put the open chapter in view without travel.
  useLayoutEffect(() => {
    const node = trackNode
    const slide = openId
      ? (node?.children[order.indexOf(openId)] as HTMLElement | undefined)
      : undefined
    if (node && slide && Math.abs(node.scrollLeft - slide.offsetLeft) > 1)
      node.scrollTo({ left: slide.offsetLeft, behavior: 'instant' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is a fresh array on every render; its contents are `orderKey`.
  }, [openId, orderKey, trackNode])

  // Follow the native gesture: the pending chapter while it moves, the open one once it settles.
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
      // Every other chapter starts at its top next time.
      Array.from(node.children).forEach((slide, index) => {
        if (order[index] !== id) slide.scrollTop = 0
      })
      if (id !== openId) navigate.current(id)
    }
    const scrollEnd = 'onscrollend' in node
    let quiet = 0
    let frame = 0
    // Read the position once per frame; the edge bounce (past the first or last slide) only fades the text, never switches it.
    const follow = () => {
      frame = 0
      const position = Math.max(0, Math.min(last, trackPosition(node)))
      const nearest = Math.round(position)
      // The new text must be in the DOM in the same frame its fade starts, or the old one flashes back for a frame.
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
    // Velocity-aware: fires as soon as a release would land on another chapter, before the finger lifts.
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

  /** Previous and Next scroll the track like a swipe would, and the text follows it. Keyboard swaps the text at once; reduced motion jumps and fades the chapter in. */
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
