'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
import type { HeroRecord } from '../narrator/triggers'
import { HERO_RECORDS } from './records'

/** The interaction contract (Paper "Hero figures · hover takeover · states"): hover intent, the pointer's grace after leaving, the glide in and out, and the pause between the drawing settling and its pose. */
export const INTENT_MS = 150,
  GRACE_MS = 200,
  ENTER_MS = 200,
  LEAVE_MS = 150,
  POSE_DELAY_MS = 60

export type TakeoverState = {
  record: HeroRecord
  phase: 'open' | 'closing'
  /** How many times this record has opened before, so each opening steps to its next line. */
  turn: number
  /** Opened from the resting list (the values glide), rather than switched inside the rail. */
  entered: boolean
  /** The pose plays once the drawing has settled. */
  posed: boolean
}

const recordAt = (target: EventTarget | null): HeroRecord | null => {
  const record = (target as Element | null)?.closest?.<HTMLElement>('[data-record]')?.dataset.record
  return HERO_RECORDS.includes(record as HeroRecord) ? (record as HeroRecord) : null
}

/** One takeover per card. Fine pointers open on hover intent and switch at once inside the rail; touch opens on a tap, switches on
 * another row, and closes on the open row or anywhere outside. Every path closes when the card scrolls fully out of view or when
 * `enabled` turns false (a filtered zero, Replay that the member started). */
export function useTakeover(
  card: RefObject<HTMLElement | null>,
  enabled: boolean,
  reduced: boolean,
) {
  const [state, setState] = useState<TakeoverState | null>(null)
  // A filtered zero or a started Replay drops the takeover at once; adjusting state while rendering, as the page does for its sheet.
  if (!enabled && state !== null) setState(null)
  // Handlers and timers read the committed state and props, so a late timer never acts on a takeover that is gone.
  const current = useRef(state),
    live = useRef({ enabled, reduced })
  useLayoutEffect(() => {
    current.current = state
    live.current = { enabled, reduced }
  })
  const timers = useRef<Record<'intent' | 'grace' | 'close' | 'pose', number | undefined>>({
    intent: undefined,
    grace: undefined,
    close: undefined,
    pose: undefined,
  })
  const turns = useRef(new Map<HeroRecord, number>())
  const pointer = useRef('mouse')
  const clear = (name: keyof typeof timers.current) => {
    window.clearTimeout(timers.current[name])
    timers.current[name] = undefined
  }

  const open = (record: HeroRecord) => {
    clear('intent')
    clear('grace')
    clear('close')
    clear('pose')
    const was = current.current
    if (was?.record === record && was.phase === 'open') return
    if (!live.current.enabled) return
    const turn = turns.current.get(record) ?? 0
    turns.current.set(record, turn + 1)
    const entered = was === null
    const next: TakeoverState = { record, phase: 'open', turn, entered, posed: false }
    current.current = next
    setState(next)
    timers.current.pose = window.setTimeout(
      () =>
        setState((s) => (s?.record === record && s.phase === 'open' ? { ...s, posed: true } : s)),
      (entered && !live.current.reduced ? ENTER_MS : 0) + POSE_DELAY_MS,
    )
  }
  const close = (instant = live.current.reduced) => {
    clear('intent')
    clear('grace')
    clear('pose')
    if (!current.current) return
    clear('close')
    if (instant) {
      current.current = null
      setState(null)
      return
    }
    current.current = { ...current.current, phase: 'closing', posed: false }
    setState(current.current)
    timers.current.close = window.setTimeout(() => {
      current.current = null
      setState(null)
    }, LEAVE_MS)
  }

  useEffect(() => {
    const node = card.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.every((entry) => !entry.isIntersecting)) close(true)
    })
    observer.observe(node)
    return () => observer.disconnect()
    // `enabled` turns true once the card has data, which is when the section (not the loading line) is mounted.
  }, [card, enabled])

  const isOpen = state !== null
  useEffect(() => {
    if (!isOpen) return
    const outside = (event: globalThis.PointerEvent) => {
      if (card.current && !card.current.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [isOpen, card])

  useEffect(() => {
    const pending = timers.current
    return () => Object.values(pending).forEach((id) => window.clearTimeout(id))
  }, [])

  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      pointer.current = event.pointerType
    },
    onPointerOver: (event: PointerEvent) => {
      if (!enabled || event.pointerType !== 'mouse') return
      clear('grace')
      const record = recordAt(event.target)
      const was = current.current
      if (was) {
        if (record && (record !== was.record || was.phase === 'closing')) open(record)
        return
      }
      clear('intent')
      if (record) timers.current.intent = window.setTimeout(() => open(record), INTENT_MS)
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      clear('intent')
      if (current.current) {
        clear('grace')
        timers.current.grace = window.setTimeout(() => close(), GRACE_MS)
      }
    },
    onClick: (event: MouseEvent) => {
      if (!enabled || pointer.current === 'mouse') return
      const record = recordAt(event.target),
        was = current.current
      if (!record) return
      if (was?.record === record && was.phase === 'open') close()
      else open(record)
    },
  }
  return { state, handlers }
}
