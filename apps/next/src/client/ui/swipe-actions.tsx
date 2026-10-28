'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { rubberBand } from './sheet-physics'
import './swipe-actions.css'

// Adapted from Arc "swipe-actions" (uiarc.dev, MIT, see ARC-LICENSE.txt): the pointer swipe on a row that reveals leading and trailing actions,
// the 10px axis lock, the full-swipe commit of the outermost action, the release projection and the one-open-row group.
// Dropped: the row collapse on commit, the built-in
// "More actions" menu and haptics. Revealed actions are real 44px buttons that are hidden (visibility) until a swipe reveals them.
//
// A swipe is a shortcut, never the only path. Callers MUST also give every action here a menu path (a row menu, a context menu or the detail
// sheet), because keyboard, screen reader and switch users cannot swipe and the revealed buttons are not reachable at rest.
// Labels are caller copy (EN and RU). `onSelect` runs for a full swipe past the threshold and for a tap on a revealed button; the row then returns
// home, so a caller that removes the item simply stops rendering it.

export type SwipeAction = {
  label: string
  icon: ReactNode
  /** Fill of the revealed action. A destructive action names the result in its label. */
  tone?: 'neutral' | 'accent' | 'danger'
  onSelect: () => void
}

export type SwipeActionsRowProps = {
  /** Actions under the left edge, revealed by swiping right. The first one is outermost. */
  leading?: SwipeAction[]
  /** Actions under the right edge, revealed by swiping left. The last one is outermost. */
  trailing?: SwipeAction[]
  /** A long swipe commits the outermost action without a tap. On by default. */
  fullSwipe?: boolean
  children: ReactNode
  className?: string
}

type Side = 'leading' | 'trailing'
/** Keeps one row open: claiming for a row closes whichever row held the claim before. */
type Group = { claim: (id: string, close: () => void) => void; release: (id: string) => void }
type Drag = {
  pointer: number
  startX: number
  startY: number
  origin: number
  locked: 'x' | 'y' | null
  samples: [number, number][]
}

/** Width of one revealed action; also written to `--swipe-action-w`. */
const ACTION_W = 80
/** Movement before a press is read as a swipe or handed to the page as a scroll. */
const SLOP = 10
/** Seconds of travel projected from the release velocity. */
const PROJECTION = 0.1
/** Release speed in px/s that counts as a flick. */
const FLICK = 900
// Physical spring options retain release velocity; duration-based springs discard it.
const SETTLE = {
  type: 'spring' as const,
  stiffness: 1000,
  damping: 64,
  restDelta: 0.5,
  restSpeed: 10,
}

const GroupContext = createContext<Group | null>(null)
function createGroup(): Group {
  let current: { id: string; close: () => void } | null = null
  return {
    claim(id, close) {
      if (current && current.id !== id) current.close()
      current = { id, close }
    },
    release(id) {
      if (current?.id === id) current = null
    },
  }
}
const sideOf = (value: number): Side | null =>
  value > 0 ? 'leading' : value < 0 ? 'trailing' : null

function velocityOf(samples: [number, number][]) {
  const last = samples[samples.length - 1]
  if (!last) return 0
  const first = samples.find((sample) => last[0] - sample[0] <= 80) ?? last
  const elapsed = (last[0] - first[0]) / 1000
  return elapsed > 0 ? (last[1] - first[1]) / elapsed : 0
}

/** Optional wrapper: only one row inside stays open at a time. Rows work on their own without it. */
export function SwipeActions({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const [group] = useState(createGroup)
  return (
    <GroupContext.Provider value={group}>
      <div className={className || undefined}>{children}</div>
    </GroupContext.Provider>
  )
}

export function SwipeActionsRow({
  leading = [],
  trailing = [],
  fullSwipe = true,
  children,
  className = '',
}: SwipeActionsRowProps) {
  const id = useId()
  const group = useContext(GroupContext)
  const rowRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const contentRef = useRef<HTMLDivElement>(null)
  useMotionValueEvent(x, 'change', (value) => {
    if (contentRef.current)
      contentRef.current.style.transform = value === 0 ? 'none' : `translateX(${value}px)`
  })
  const reduced = useReducedMotion()
  const width = useRef(0)
  const drag = useRef<Drag | null>(null)
  const armed = useRef(false)
  const swallowClick = useRef(false)
  const [open, setOpen] = useState(false)

  const actionsOf = (side: Side) => (side === 'leading' ? leading : trailing)
  const openWidth = (side: Side) => actionsOf(side).length * ACTION_W
  const outermost = (side: Side) => (side === 'leading' ? 0 : trailing.length - 1)
  const canCommit = (side: Side) => fullSwipe && actionsOf(side).length > 0
  const threshold = (side: Side) => Math.max(openWidth(side) + 40, width.current * 0.5)

  /** One value owns both pointer tracking and settling, so grabbing a spring keeps its current position. */
  const place = useCallback(
    (value: number, animated: boolean, velocity?: number) => {
      const side = sideOf(value)
      if (side && rowRef.current) rowRef.current.dataset.reveal = side
      const arrived = () => {
        if (value === 0 && rowRef.current) delete rowRef.current.dataset.reveal
      }
      if (!animated || reduced) {
        x.jump(value)
        arrived()
      } else {
        animate(x, value, {
          ...SETTLE,
          ...(velocity === undefined ? {} : { velocity }),
          onComplete: arrived,
        })
      }
    },
    [reduced, x],
  )

  const setArmed = (next: boolean, side: Side | null) => {
    armed.current = next
    const row = rowRef.current
    if (!row) return
    if (next && side) row.dataset.armed = side
    else delete row.dataset.armed
  }

  const home = useCallback(
    (velocity?: number) => {
      setArmed(false, null)
      place(0, true, velocity)
      setOpen(false)
    },
    [place],
  )

  /** Moves the row to rest at `target` (0 or a signed open width). */
  const settle = useCallback(
    (target: number, velocity?: number) => {
      if (target === 0) {
        home(velocity)
        group?.release(id)
        return
      }
      setArmed(false, null)
      place(target, true, velocity)
      setOpen(true)
      group?.claim(id, home)
    },
    [group, id, home, place],
  )

  const commit = (side: Side, index: number, velocity?: number) => {
    const action = actionsOf(side)[index]
    if (!action) return
    settle(0, velocity)
    action.onSelect()
  }

  /** Past the commit distance the outermost action takes over the row; backing off disarms it. */
  const arm = (value: number) => {
    const side = sideOf(value)
    if (!side || !canCommit(side)) {
      if (armed.current) setArmed(false, null)
      return
    }
    const limit = threshold(side)
    const next = Math.abs(value) > (armed.current ? limit - 16 : limit)
    if (next !== armed.current) setArmed(next, side)
  }

  /** Follows the finger 1:1 up to the reveal limit, then with rubber-band resistance. */
  const constrain = (raw: number) => {
    const side = sideOf(raw)
    if (!side) return 0
    const dimension = width.current || 320
    const limit = actionsOf(side).length === 0 ? 0 : canCommit(side) ? dimension : openWidth(side)
    const distance = Math.abs(raw)
    return Math.sign(raw) * (distance <= limit ? distance : limit + rubberBand(distance - limit))
  }

  const release = (velocity: number) => {
    const value = x.get(),
      side = sideOf(value)
    if (!side || actionsOf(side).length === 0) {
      settle(0, velocity)
      return
    }
    const direction = side === 'leading' ? 1 : -1
    const distance = Math.abs(value),
      outward = velocity * direction,
      reveal = openWidth(side)
    const projected = distance + outward * PROJECTION
    const flung =
      canCommit(side) && distance > reveal && outward > FLICK && projected > threshold(side)
    // A flick back toward home cancels an armed full swipe.
    if (canCommit(side) && ((armed.current && outward > -FLICK) || flung)) {
      commit(side, outermost(side), velocity)
      return
    }
    settle(projected > reveal / 2 ? direction * reveal : 0, velocity)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swallowClick.current = false
    if (!leading.length && !trailing.length) return
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    width.current = rowRef.current?.offsetWidth || 0
    drag.current = {
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: x.get(),
      locked: null,
      samples: [[event.timeStamp, event.clientX]],
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId || current.locked === 'y') return
    if (!current.locked) {
      const dx = event.clientX - current.startX,
        dy = event.clientY - current.startY
      if (Math.hypot(dx, dy) < SLOP) return
      if (Math.abs(dy) > Math.abs(dx)) {
        current.locked = 'y'
        return
      }
      // Measure from here, so crossing the slop never jumps the row.
      current.locked = 'x'
      x.stop()
      current.origin = x.get()
      current.startX = event.clientX
      event.currentTarget.setPointerCapture?.(event.pointerId)
      if (rowRef.current) rowRef.current.dataset.dragging = ''
      group?.claim(id, home)
    }
    const value = constrain(current.origin + event.clientX - current.startX)
    place(value, false)
    current.samples.push([event.timeStamp, event.clientX])
    if (current.samples.length > 12) current.samples.shift()
    arm(value)
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    drag.current = null
    if (current.locked === 'x') {
      swallowClick.current = true
      if (rowRef.current) delete rowRef.current.dataset.dragging
      current.samples.push([event.timeStamp, event.clientX])
      if (event.type === 'pointercancel') settle(0)
      else release(velocityOf(current.samples))
      return
    }
    // A tap on an open row closes it instead of acting on what is underneath.
    if (current.locked === null && Math.abs(x.get()) > 0.5) {
      swallowClick.current = true
      settle(0)
    }
  }

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  // While open, a press outside the row or Escape puts it away.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node && rowRef.current?.contains(event.target))) settle(0)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(0)
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, settle])

  useEffect(
    () => () => {
      x.stop()
      group?.release(id)
    },
    [group, id, x],
  )

  return (
    <div
      ref={rowRef}
      className={`ui-swipe-row ${className}`.trim()}
      style={{ '--swipe-action-w': `${ACTION_W}px` } as CSSProperties}
    >
      {(['leading', 'trailing'] as const).map((side) => {
        const actions = actionsOf(side)
        if (!actions.length) return null
        return (
          <div
            key={side}
            className="ui-swipe-side"
            data-side={side}
            data-swipe-tone={actions[outermost(side)]?.tone ?? 'neutral'}
          >
            {actions.map((action, index) => (
              <button
                key={index}
                type="button"
                className="ui-swipe-action"
                data-swipe-tone={action.tone ?? 'neutral'}
                data-outer={index === outermost(side) || undefined}
                onClick={() => commit(side, index)}
              >
                <span className="ui-swipe-icon" aria-hidden="true">
                  {action.icon}
                </span>
                <span className="ui-swipe-label">{action.label}</span>
              </button>
            ))}
          </div>
        )
      })}
      <div
        ref={contentRef}
        className="ui-swipe-content"
        style={{ transform: x.get() === 0 ? 'none' : `translateX(${x.get()}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  )
}
