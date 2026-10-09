'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import {
  clearCards,
  createGhost,
  layoutRect,
  moveGhost,
  placeCards,
  reducedMotion,
  RETURN_MS,
  SETTLE_MS,
  settleGhost,
  type Flips,
  type Ghost,
} from './drag-motion'
import { dropIndex, laneDrop, moveSection } from './reorder'

type Options = {
  ids: SectionId[]
  onCommit: (id: SectionId, index: number) => boolean | void
  announce: (id: SectionId, index: number, count: number) => void
}
type Gesture = {
  id: SectionId
  pointerId: number
  handle: HTMLElement
  x: number
  y: number
  pointerX: number
  pointerY: number
  coarse: boolean
  active: boolean
  index: number
  anchor?: { x: number; y: number }
}
/** A drag from activation until the ghost has settled. The gesture ends at release; the session outlives it while the ghost glides home. */
type Session = {
  id: SectionId
  ids: SectionId[]
  node: HTMLElement
  parent: HTMLElement
  ghost: Ghost
}
/** Pointer travel (px) required after a preview change before the next one: masonry repacking can move cards under a still pointer, and without this a boundary flickers. */
const MIN_TRAVEL = 12

export function useReorder(options: Options) {
  const latest = useRef(options)
  const nodes = useRef(new Map<SectionId, HTMLElement>())
  const flips = useRef<Flips>(new Map())
  const gesture = useRef<Gesture | null>(null)
  const session = useRef<Session | null>(null)
  const suppressClick = useRef<SectionId | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const raf = useRef<number | undefined>(undefined)
  const detach = useRef<(() => void) | undefined>(undefined)
  const [activeId, setActiveId] = useState<SectionId | null>(null)
  useEffect(() => {
    latest.current = options
  })
  const signature = options.ids.join(',')

  /** Ends the pointer gesture only: listeners, timers, capture. */
  function stop() {
    const current = gesture.current
    gesture.current = null
    clearTimeout(timer.current)
    timer.current = undefined
    if (raf.current !== undefined) cancelAnimationFrame(raf.current)
    raf.current = undefined
    detach.current?.()
    detach.current = undefined
    if (current?.handle.hasPointerCapture?.(current.pointerId))
      current.handle.releasePointerCapture(current.pointerId)
  }
  /** Removes the ghost and every preview side effect; idempotent. */
  function teardown(render = true) {
    const current = session.current
    session.current = null
    if (!current) return
    current.ghost.settle?.cancel()
    current.ghost.layer.remove()
    current.parent.removeAttribute('data-reordering')
    clearCards(current.ids, nodes.current, flips.current)
    if (render) setActiveId(null)
  }
  function abort(render = true) {
    stop()
    teardown(render)
  }
  const abortRef = useRef(abort)
  useEffect(() => {
    abortRef.current = abort
  })
  useEffect(() => {
    const reset = () => abortRef.current()
    window.addEventListener('kuuki:identity-reset', reset)
    return () => {
      abortRef.current(false)
      window.removeEventListener('kuuki:identity-reset', reset)
    }
  }, [])
  // The cards changed under a live gesture (hidden, data swap): drop it. A settling ghost after a commit also sees new ids and is left to finish.
  useLayoutEffect(
    () => () => {
      if (gesture.current) abortRef.current()
    },
    [signature],
  )

  function preview(index: number) {
    const current = gesture.current
    if (!current) return
    current.index = index
    current.anchor = { x: current.pointerX, y: current.pointerY + window.scrollY }
    const order = moveSection(latest.current.ids, current.id, index)
    placeCards(
      order.flatMap((id, i) => {
        const node = nodes.current.get(id)
        return node ? [[node, i] as [HTMLElement, number]] : []
      }),
      flips.current,
      !reducedMotion(),
    )
  }
  /** Drop target among the other cards as they are laid out now (placeholder included, slides ignored). Only the pointer decides; a change needs the pointer past the neighbour's midpoint and some travel since the last change. */
  function measure(force = false) {
    const current = gesture.current
    if (!current?.active) return
    const measured = latest.current.ids.flatMap((id) => {
      const node = nodes.current.get(id)
      return node ? [{ id, ...layoutRect(node, flips.current) }] : []
    })
    const rects = measured.filter((rect) => rect.id !== current.id)
    if (!rects.length) return
    const bounds = {
      left: Math.min(...measured.map((rect) => rect.left)),
      right: Math.max(...measured.map((rect) => rect.right)),
    }
    const lanes = nodes.current.get(current.id)?.parentElement?.dataset.lanes === '2'
    const next = lanes
      ? laneDrop(current.pointerX, current.pointerY, rects, bounds)
      : dropIndex(current.pointerY, rects, current.pointerX, bounds)
    if (next === null || next === current.index) return
    const { anchor } = current
    if (
      !force &&
      anchor &&
      Math.hypot(current.pointerX - anchor.x, current.pointerY + window.scrollY - anchor.y) <
        MIN_TRAVEL
    )
      return
    preview(next)
  }
  function frame() {
    const current = gesture.current
    if (!current?.active) return
    const step = current.pointerY < 64 ? -12 : current.pointerY > window.innerHeight - 64 ? 12 : 0
    if (step) window.scrollBy({ top: step, behavior: 'instant' })
    measure()
    if (session.current) moveGhost(session.current.ghost, current.pointerX, current.pointerY)
    raf.current = requestAnimationFrame(frame)
  }
  function activate() {
    const current = gesture.current
    if (!current || current.active) return
    const node = nodes.current.get(current.id)
    if (!node?.parentElement) {
      stop()
      return
    }
    current.active = true
    suppressClick.current = current.id
    current.handle.setPointerCapture?.(current.pointerId)
    window.getSelection()?.removeAllRanges()
    const { parentElement: parent } = node
    parent.setAttribute('data-reordering', '')
    session.current = {
      id: current.id,
      ids: latest.current.ids,
      node,
      parent,
      ghost: createGhost(node, layoutRect(node, flips.current), current.pointerX, current.pointerY),
    }
    setActiveId(current.id)
    raf.current = requestAnimationFrame(frame)
  }
  /** Releases the ghost into the placeholder's slot. */
  function settle(duration: number) {
    const current = session.current
    if (!current) return
    const slot = layoutRect(current.node, flips.current)
    flips.current.get(current.node)?.cancel()
    settleGhost(current.ghost, slot, duration, () => {
      if (session.current === current) teardown()
    })
  }
  function start(id: SectionId, event: ReactPointerEvent<HTMLElement>) {
    if (
      gesture.current ||
      event.button !== 0 ||
      event.isPrimary === false ||
      !latest.current.ids.includes(id)
    )
      return
    const control = (event.target as Element).closest(
      'button, a, input, select, textarea, [role="button"], [role="menu"], [data-reorder-control]',
    )
    if (control && control !== event.currentTarget) return
    teardown()
    const coarse = event.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches
    suppressClick.current = null
    gesture.current = {
      id,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      coarse,
      active: false,
      index: latest.current.ids.indexOf(id),
    }
    const move = (e: PointerEvent) => {
      const current = gesture.current
      if (!current || e.pointerId !== current.pointerId) return
      current.pointerY = e.clientY
      current.pointerX = e.clientX
      const distance = Math.hypot(e.clientX - current.x, e.clientY - current.y)
      if (!current.active) {
        if (current.coarse && distance >= 8) {
          stop()
          return
        }
        if (!current.coarse && distance >= 4) activate()
      }
      if (current.active) {
        e.preventDefault()
        measure()
      }
    }
    const end = (e: PointerEvent) => {
      const current = gesture.current
      if (!current || e.pointerId !== current.pointerId) return
      const released = current.active && e.type === 'pointerup'
      if (released) {
        current.pointerX = e.clientX
        current.pointerY = e.clientY
        measure(true)
      }
      const index = current.index,
        commit = released && latest.current.ids.indexOf(id) !== index
      finish(commit, id, index, released)
    }
    const cancel = () => {
      const current = gesture.current
      if (current) finish(false, id, current.index, false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    const scroll = () => measure()
    // Once active, the finger drags the card instead of the page. Before activation a touch move is a scroll and cancels the long-press.
    const block = (e: TouchEvent) => {
      if (gesture.current?.active && e.cancelable) e.preventDefault()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('keydown', escape)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('touchmove', block, { passive: false })
    event.currentTarget.addEventListener('lostpointercapture', cancel)
    const handle = event.currentTarget
    detach.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('touchmove', block)
      handle.removeEventListener('lostpointercapture', cancel)
    }
    if (coarse) timer.current = setTimeout(activate, 400)
  }
  /** Commit keeps the preview and glides the ghost home over 200ms; anything else reverts the preview and returns it faster. One commit, one announcement. */
  function finish(commit: boolean, id: SectionId, index: number, released: boolean) {
    const wasActive = gesture.current?.active === true
    stop()
    if (!wasActive || !session.current) {
      teardown()
      return
    }
    if (!commit)
      placeCards(
        latest.current.ids.flatMap((sectionId, i) => {
          const node = nodes.current.get(sectionId)
          return node ? [[node, i] as [HTMLElement, number]] : []
        }),
        flips.current,
        !reducedMotion(),
      )
    settle(commit || released ? SETTLE_MS : RETURN_MS)
    if (commit && latest.current.onCommit(id, index) !== false)
      latest.current.announce(id, index, latest.current.ids.length)
  }
  return {
    bindings: (id: SectionId) => ({
      ref: (node: HTMLElement | null) => {
        if (node) nodes.current.set(id, node)
        else nodes.current.delete(id)
      },
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => start(id, event),
      onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
        if (suppressClick.current === id && event.detail !== 0) {
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = null
        }
      },
      active: activeId === id,
    }),
  }
}
