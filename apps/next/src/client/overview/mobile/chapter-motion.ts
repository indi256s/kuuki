'use client'

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { rubberBand } from '../../ui/sheet'
import { gestureAxis } from '../globe/gestures'

/** Scroll-like deceleration used to project where a flick would come to rest (Apple, Designing Fluid Interfaces). */
const DECELERATION = 0.998
/** Initial slope of `--ease-out` (cubic-bezier(.23,1,.32,1)): its starting speed is about 1/0.23 times the average. */
const EASE_OUT_START_SLOPE = 1 / 0.23
/** The shortest travel of a leaving or arriving chapter. */
const SHIFT = 48

/**
 * Where a released swipe lands: 1 for the next chapter, -1 for the previous one, 0 to settle back.
 * `offset` is the stage's on-screen shift and `velocity` the finger's, both in px (per ms), negative toward the left.
 * The resting point is projected from the velocity and compared with the half-way mark, so a quick flick and a long
 * slow drag both commit and a flick back toward the start cancels.
 */
export function swipeTarget({ offset, velocity, width }: { offset: number; velocity: number; width: number }): 1 | -1 | 0 {
  const projected = offset + velocity * DECELERATION / (1 - DECELERATION)
  if (width <= 0 || Math.abs(projected) < width / 2) return 0
  return projected < 0 ? 1 : -1
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
/** Duration tokens may compile to seconds (`.15s`), as FeedbackText also allows for. */
const ms = (name: string) => { const value = token(name); return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) || 0 }

/** The stage's on-screen shift and opacity, including a running animation, so new motion starts where the eye is. */
function presentation(node: HTMLElement) {
  const style = getComputedStyle(node)
  return { x: style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m41, opacity: Number(style.opacity) }
}

/** True when the touch started inside something that scrolls or drags sideways itself (a table, a range slider). */
function ownsHorizontalGesture(target: EventTarget | null, stage: HTMLElement): boolean {
  for (let node = target instanceof HTMLElement ? target : null; node && node !== stage; node = node.parentElement) {
    if (node instanceof HTMLInputElement && node.type === 'range') return true
    if (node.scrollWidth > node.clientWidth && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true
  }
  return false
}

type Drag = { id: number; x: number; y: number; base: number; axis: 'x' | 'y' | null; samples: { t: number; x: number }[] }

/**
 * Chapter changes in the Overview sheet. The chapter switches at once (title, pager and labels respond on release or tap);
 * a static copy of the old chapter carries on from its on-screen position and speed and fades out, while the new one
 * arrives from the other side. Nothing locks input: a swipe or tap mid-flight takes over from what is on screen.
 * The stage element is keyed by chapter, so every chapter gets a fresh node.
 */
export function useChapterMotion({ openId, order, onNavigate }: { openId: SectionId | null; order: SectionId[]; onNavigate: (id: SectionId) => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const arriving = useRef<1 | -1 | 0>(0)
  const ghosts = useRef(new Set<HTMLElement>())
  /** Keyboard-triggered changes swap the heading and button text without a morph (DESIGN.md, Scoped text feedback). */
  const [instant, setInstant] = useState(false)
  const index = openId ? order.indexOf(openId) : -1

  const clearGhosts = () => { ghosts.current.forEach(ghost => ghost.remove()); ghosts.current.clear() }
  useEffect(() => { if (!openId) clearGhosts() }, [openId])
  useEffect(() => clearGhosts, [])

  /** Leaves a non-interactive copy of the old chapter where it is on screen and sends it on toward `dir`'s side. */
  const sendOff = (node: HTMLElement, dir: 1 | -1, velocity: number) => {
    const body = node.parentElement
    if (!body) return
    const { x, opacity } = presentation(node)
    const rect = node.getBoundingClientRect(), frame = body.getBoundingClientRect()
    // The frame covers the visible part of the body once the new chapter has scrolled it to the top.
    const frameNode = document.createElement('div')
    frameNode.className = 'ov3-sheet-ghost'
    frameNode.setAttribute('aria-hidden', 'true')
    frameNode.inert = true
    frameNode.style.height = `${body.clientHeight}px`
    const copy = node.cloneNode(true) as HTMLElement
    // Only the live stage carries the class and gesture state; the copy is just pixels on their way out.
    copy.removeAttribute('class')
    copy.removeAttribute('data-swiping')
    copy.style.cssText = `position:absolute;top:${rect.top - frame.top}px;left:${rect.left - frame.left - x}px;width:${rect.width}px;margin:0`
    frameNode.appendChild(copy)
    body.appendChild(frameNode)
    ghosts.current.add(frameNode)
    // Keep the finger's speed through the hand-off: with ease-out the start runs ~4x the average speed.
    const duration = ms('--dur-fast')
    const travel = Math.max(SHIFT, Math.abs(velocity) * duration / EASE_OUT_START_SLOPE)
    const animation = copy.animate(
      [{ transform: `translate3d(${x}px,0,0)`, opacity }, { transform: `translate3d(${x - dir * travel}px,0,0)`, opacity: 0 }],
      { duration, easing: token('--ease-out'), fill: 'forwards' },
    )
    const done = () => { frameNode.remove(); ghosts.current.delete(frameNode) }
    animation.finished.then(done, done)
  }

  /** `dir` 1 is the next chapter, which leaves toward the left and enters from the right. */
  const go = (dir: 1 | -1, { keyboard = false, velocity = 0 } = {}) => {
    const target = order[index + dir]
    const node = stage.current
    if (!target || !node) return
    setInstant(keyboard)
    if (!reducedMotion()) { sendOff(node, dir, velocity); arriving.current = dir } else arriving.current = 0
    node.getAnimations().forEach(animation => animation.cancel())
    node.style.transform = node.style.opacity = ''
    node.dataset.swiping = 'false'
    onNavigate(target)
  }

  // Before paint on the new chapter: start at its top and bring it in from the side it is coming from.
  useLayoutEffect(() => {
    const node = stage.current
    const body = node?.parentElement
    if (!node || !body || !openId) return
    body.scrollTop = 0
    const dir = arriving.current
    arriving.current = 0
    if (reducedMotion()) { node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms('--dur-fast'), easing: 'linear' }); return }
    if (dir) node.animate([{ transform: `translate3d(${dir * SHIFT}px,0,0)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: ms('--dur-sheet'), easing: token('--ease-drawer') })
  }, [openId])

  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    drag.current = null
    const node = event.currentTarget
    try { node.releasePointerCapture?.(event.pointerId) } catch { /* not captured */ }
    if (d.axis !== 'x') return
    const from = d.samples.find(s => event.timeStamp - s.t <= 100) ?? d.samples[d.samples.length - 1]
    const elapsed = from ? event.timeStamp - from.t : 0
    const velocity = from && elapsed > 0 ? (event.clientX - from.x) / elapsed : 0
    const dir = cancelled ? 0 : swipeTarget({ offset: d.base + event.clientX - d.x, velocity, width: node.clientWidth })
    if (dir && order[index + dir]) { go(dir, { velocity }); return }
    // Not enough: the stage's own transition settles it back from where it is.
    node.dataset.swiping = 'false'
    node.style.transform = node.style.opacity = ''
  }

  const swipe = {
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.pointerType === 'mouse' || !event.isPrimary || ownsHorizontalGesture(event.target, event.currentTarget)) return
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, base: 0, axis: null, samples: [{ t: event.timeStamp, x: event.clientX }] }
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      const d = drag.current
      if (!d || d.id !== event.pointerId) return
      const dx = event.clientX - d.x
      d.axis ??= gestureAxis(dx, event.clientY - d.y)
      if (d.axis !== 'x') return
      const node = event.currentTarget
      if (node.dataset.swiping !== 'true') {
        try { node.setPointerCapture?.(event.pointerId) } catch { /* the pointer already ended */ }
        // Grabbing a chapter that is still arriving continues from where it is on screen.
        d.base = reducedMotion() ? 0 : presentation(node).x
        node.getAnimations().forEach(animation => animation.cancel())
        node.dataset.swiping = 'true'
      }
      d.samples.push({ t: event.timeStamp, x: event.clientX })
      if (d.samples.length > 8) d.samples.shift()
      const width = Math.max(1, node.clientWidth)
      // Reduced motion: no travel, but the chapter still answers the finger by dimming.
      if (reducedMotion()) { node.style.opacity = String(1 - Math.min(0.4, Math.abs(dx) / width)); return }
      const raw = d.base + dx
      // Dragging toward a side with no chapter resists, like the sheet's own drag.
      const offset = order[index + (raw < 0 ? 1 : -1)] ? raw : Math.sign(raw) * rubberBand(Math.abs(raw))
      node.style.transform = `translate3d(${offset}px,0,0)`
      node.style.opacity = String(1 - Math.min(0.6, Math.abs(offset) / width))
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) { finish(event, false) },
    onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) { finish(event, true) },
  }

  return { stage, go, swipe, instant }
}
