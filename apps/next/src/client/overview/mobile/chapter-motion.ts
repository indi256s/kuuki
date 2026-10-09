'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'

/** The heading and footer labels travel the same way as their chapter, but only a little: they are lighter than the content. */
const TEXT_SHIFT = 24
/** Android only (iOS Safari has no Vibration API): one short tick when a swipe passes the point where it will change chapter. */
const DETENT_TICK = 8
/** Settling fallback for browsers without `scrollend`. */
const SETTLE_QUIET = 120

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
/** Duration tokens may compile to seconds (`.15s`), as FeedbackText also allows for. */
const ms = (name: string) => { const value = token(name); return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) || 0 }

/** The element's on-screen shift and opacity, including a running animation, so new motion starts where the eye is. */
function presentation(node: HTMLElement) {
  const style = getComputedStyle(node)
  return { x: style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m41, opacity: Number(style.opacity) }
}

/** Scroll Snap Events (Chromium 129+); other browsers fall back to the scroll position. */
type SnapEvent = Event & { snapTargetInline: Element | null }

/** The slide nearest the track's scroll position: the one a release would settle on without momentum. */
function nearestSlide(track: HTMLElement) {
  return track.clientWidth > 0 ? Math.round(track.scrollLeft / track.clientWidth) : 0
}

/**
 * Chapter paging in the Overview sheet. Chapters are slides in a horizontal scroll-snap track, so the browser owns the gesture:
 * the neighbour travels with the finger, momentum and the edge bounce are the platform's, and the axis lock is the one every
 * scroller uses. The script only follows the track: the heading and footer labels switch (and slide the same way) as soon as a
 * release would land on another chapter, and the chapter becomes `openId` once the track settles.
 */
export function useChapterTrack({ openId, order, onNavigate }: { openId: SectionId | null; order: SectionId[]; onNavigate: (id: SectionId) => void }) {
  const track = useRef<HTMLDivElement | null>(null)
  // Radix mounts the sheet's portal a commit after it opens, so effects wait for the track node itself.
  const [trackNode, setTrackNode] = useState<HTMLDivElement | null>(null)
  const trackRef = useCallback((node: HTMLDivElement | null) => { track.current = node; setTrackNode(node) }, [])
  const heading = useRef<HTMLSpanElement>(null)
  const previousLabel = useRef<HTMLSpanElement>(null)
  const nextLabel = useRef<HTMLSpanElement>(null)
  const texts = [heading, previousLabel, nextLabel]
  /** The chapter a release would land on now: it drives the heading, labels and pager ahead of `openId`. */
  const [shown, setShown] = useState(openId)
  const shownRef = useRef(openId)
  const textArriving = useRef<1 | -1 | 0>(0)
  const ghosts = useRef(new Set<HTMLElement>())
  const touching = useRef(false)
  const orderKey = order.join()
  const navigate = useRef(onNavigate)
  useLayoutEffect(() => { navigate.current = onNavigate })
  // A chapter opened from outside (a tile, closing, Hide) is shown at once; our own settles already match.
  const [synced, setSynced] = useState(openId)
  if (openId !== synced) {
    setSynced(openId)
    if (!openId || !shown || !order.includes(shown)) setShown(openId)
  }
  useLayoutEffect(() => { shownRef.current = shown }, [shown])

  const clearGhosts = () => { ghosts.current.forEach(ghost => ghost.remove()); ghosts.current.clear() }
  useEffect(() => { if (!openId) clearGhosts() }, [openId])
  useEffect(() => clearGhosts, [])

  /** A line of chapter text (title with position, or a footer label) leaves toward `dir`'s side as an inert copy, from wherever it is on screen. */
  const sendTextOff = (node: HTMLElement, dir: 1 | -1) => {
    const parent = node.parentElement
    if (!parent) return
    const { x, opacity } = presentation(node)
    const copy = node.cloneNode(true) as HTMLElement
    copy.setAttribute('aria-hidden', 'true')
    copy.inert = true
    copy.style.cssText = `position:absolute;left:${node.offsetLeft}px;top:${node.offsetTop}px;width:${node.offsetWidth}px;height:${node.offsetHeight}px;pointer-events:none`
    parent.appendChild(copy)
    ghosts.current.add(copy)
    const animation = copy.animate(
      [{ transform: `translate3d(${x}px,0,0)`, opacity }, { transform: `translate3d(${x - dir * TEXT_SHIFT}px,0,0)`, opacity: 0 }],
      { duration: ms('--dur-fast'), easing: token('--ease-out'), fill: 'forwards' },
    )
    const done = () => { copy.remove(); ghosts.current.delete(copy) }
    animation.finished.then(done, done)
  }

  /** Switches the heading and labels to `id`; they slide the way the chapters move unless `instant` (keyboard, reduced motion). */
  const show = (id: SectionId, instant: boolean) => {
    const from = shownRef.current ? order.indexOf(shownRef.current) : -1
    const to = order.indexOf(id)
    if (id === shownRef.current || to < 0) return
    const dir = from < 0 || instant || reducedMotion() ? 0 : to > from ? 1 : -1
    textArriving.current = dir
    for (const { current: text } of texts) {
      if (!text) continue
      if (dir) sendTextOff(text, dir)
      text.getAnimations().forEach(animation => animation.cancel())
    }
    if (dir && touching.current) navigator.vibrate?.(DETENT_TICK)
    shownRef.current = id
    setShown(id)
  }

  // Before paint: the incoming heading and labels arrive from the side the chapter comes from.
  useLayoutEffect(() => {
    const dir = textArriving.current
    textArriving.current = 0
    if (dir) for (const { current: text } of [heading, previousLabel, nextLabel]) text?.animate([{ transform: `translate3d(${dir * TEXT_SHIFT}px,0,0)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: ms('--dur-sheet'), easing: token('--ease-drawer') })
  }, [shown])

  // Opening, Hide and Move up/down put the open chapter in view without travel.
  useLayoutEffect(() => {
    const node = trackNode
    const slide = openId ? node?.children[order.indexOf(openId)] as HTMLElement | undefined : undefined
    if (node && slide && Math.abs(node.scrollLeft - slide.offsetLeft) > 1) node.scrollTo({ left: slide.offsetLeft, behavior: 'instant' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is a fresh array on every render; its contents are `orderKey`.
  }, [openId, orderKey, trackNode])

  // Follow the native gesture: the pending chapter while it moves, the open one once it settles.
  useEffect(() => {
    const node = trackNode
    if (!node || !openId) return
    const at = (index: number) => order[Math.max(0, Math.min(order.length - 1, index))]
    const settle = () => {
      const id = at(nearestSlide(node))
      if (!id) return
      show(id, false)
      // Every other chapter starts at its top next time.
      Array.from(node.children).forEach((slide, index) => { if (order[index] !== id) slide.scrollTop = 0 })
      if (id !== openId) navigate.current(id)
    }
    const snapEvents = 'onscrollsnapchanging' in window
    const scrollEnd = 'onscrollend' in node
    let quiet = 0
    const onScroll = () => {
      if (!snapEvents) { const id = at(nearestSlide(node)); if (id) show(id, false) }
      if (!scrollEnd) { window.clearTimeout(quiet); quiet = window.setTimeout(settle, SETTLE_QUIET) }
    }
    // Velocity-aware: fires as soon as a release would land elsewhere, before the finger lifts.
    const onSnapChanging = (event: Event) => {
      const index = Array.prototype.indexOf.call(node.children, (event as SnapEvent).snapTargetInline)
      if (index >= 0 && order[index]) show(order[index], false)
    }
    const onTouchStart = () => { touching.current = true }
    const onTouchEnd = () => { touching.current = false }
    node.addEventListener('scroll', onScroll, { passive: true })
    node.addEventListener('scrollend', settle)
    node.addEventListener('scrollsnapchanging', onSnapChanging)
    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchend', onTouchEnd, { passive: true })
    node.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.clearTimeout(quiet)
      node.removeEventListener('scroll', onScroll)
      node.removeEventListener('scrollend', settle)
      node.removeEventListener('scrollsnapchanging', onSnapChanging)
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('touchcancel', onTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `order` is a fresh array on every render; its contents are `orderKey`.
  }, [openId, orderKey, trackNode])

  /** Previous and Next scroll the track like a swipe would. Keyboard swaps the text at once; reduced motion jumps and fades the chapter in. */
  const go = (dir: 1 | -1, { keyboard = false } = {}) => {
    const node = track.current
    const index = (shownRef.current ? order.indexOf(shownRef.current) : -1) + dir
    const target = order[index]
    const slide = node?.children[index] as HTMLElement | undefined
    if (!node || !target || !slide) return
    show(target, keyboard)
    if (reducedMotion()) {
      node.scrollTo({ left: slide.offsetLeft, behavior: 'instant' })
      slide.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms('--dur-fast'), easing: 'linear' })
    } else node.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }

  return { track: trackRef, heading, previousLabel, nextLabel, shown, go }
}
