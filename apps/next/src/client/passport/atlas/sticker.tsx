'use client'
// The atlas sticker: an unrecorded country lifts as a sticker with four tear-off tabs. A tab tap tears it by itself;
// a pull folds it after the finger. The tear records the visit (quick-visit.ts), inks the country and lands its stamp.

import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type * as GL from 'maplibre-gl'
import { useMap } from '../../maps/mapcn'
import { CountryStamp } from '../../stamps'
import { useMobile } from '../../ui/use-mobile'
import type { Locale } from '../../../lib/format'
import { VISIT_WAYS, WAY_LABELS, type VisitWay } from '../visit-ways'
import {
  bounds,
  fold,
  halfPlane,
  pathOf,
  pointerAt,
  projectOutline,
  PULL_SLOP,
  TEAR_THRESHOLD,
  type Point,
  type Ring,
} from './peel'
import { RECORDED_TOAST_MS, REVERT_MS, type RecordVisit } from './quick-visit'
import './sticker.css'

export type StickerGeometry = {
  /** Outer rings of the country's polygons, [lon, lat]. */
  rings: number[][][]
  /** Where the stamp lands. */
  centre: [number, number]
}

export type StickerHandle = {
  lift: (code: string) => void
  /** Drops a lifted sticker; true when one was showing. */
  dismiss: () => boolean
  /** Jumps an in-flight tear to its end state. */
  finish: () => void
}

const LIFT_SCALE = 1.04
const TEAR_MS = 320
const SETTLE_MS = 150
const SPRING_BACK_MS = 200
const REDUCED_TEAR_MS = 150
/** Smaller outlines than this (px, longest side) get the camera first. */
const SMALL_OUTLINE = 96
const MAX_CAMERA_MS = 300
const TAB_HEIGHT = 44
// Ease-in for the tear only (spec): the paper resists, then lets go. Routine motion stays ease-out.
const EASE_IN = [0.55, 0, 1, 0.45] as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const

type Pull = { grab: Point; dir: Point; progress: number; dragging: boolean }
type Active = {
  code: string
  phase: 'lifted' | 'closing' | 'tearing'
  way?: VisitWay
  pull: Pull | null
}
type Ghost = { key: number; code: string }
type LandedStamp = { key: number; code: string; at: [number, number]; leaving: boolean }

let sequence = 0

/** The country's screen outline: its largest polygon and the parts near it, so far-flung islands do not stretch it. */
function screenRings(map: GL.Map, geometry: StickerGeometry): Ring[] {
  const rings = projectOutline(geometry.rings, (lngLat) => map.project(lngLat))
  const sized = rings.map((ring) => ({ ring, box: bounds([ring]) }))
  const main = sized.reduce((best, item) =>
    item.box.width * item.box.height > best.box.width * best.box.height ? item : best,
  )
  const reach = 1.5 * Math.max(main.box.width, main.box.height, 24)
  const cx = main.box.left + main.box.width / 2,
    cy = main.box.top + main.box.height / 2
  return sized
    .filter(({ box }) => {
      const x = box.left + box.width / 2,
        y = box.top + box.height / 2
      return Math.hypot(x - cx, y - cy) <= reach
    })
    .map(({ ring }) => ring)
}

export function Sticker({
  control,
  locale,
  ownerId,
  name,
  geometryOf,
  record,
}: {
  control: RefObject<StickerHandle | null>
  locale: Locale
  ownerId: string
  name: (code: string) => string
  geometryOf: (code: string) => StickerGeometry | null
  record: RecordVisit
}) {
  const { map } = useMap()
  const reduced = useReducedMotion() ?? false
  const mobile = useMobile()
  const [active, setActive] = useState<Active | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [stamps, setStamps] = useState<LandedStamp[]>([])
  const [, setFrame] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const firstTab = useRef<HTMLButtonElement>(null)
  const motion = useRef<AnimationPlaybackControls | null>(null)
  const timers = useRef(new Set<number>())
  const activeRef = useRef(active)
  useLayoutEffect(() => {
    activeRef.current = active
  }, [active])
  // The tear's pending landing: the stamp and toast arrive at impact, or at once when the tear is cut short.
  const landing = useRef<{ code: string; land: () => void; announce: () => void } | null>(null)
  const pointerState = useRef<{ id: number; start: Point; way: VisitWay; grab: Point } | null>(null)
  const suppressClick = useRef(false)

  const later = useCallback((ms: number, run: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      run()
    }, ms)
    timers.current.add(id)
  }, [])
  useEffect(() => {
    const pending = timers.current
    return () => {
      motion.current?.stop()
      pending.forEach((id) => window.clearTimeout(id))
      pending.clear()
      // Gone mid-tear (a view switch or a filter): the write goes on, so its toast and Undo still arrive.
      landing.current?.announce()
      landing.current = null
    }
  }, [])

  // Follow the camera: re-project on every move, coalesced to one render per frame.
  const drawing = !!active || ghosts.length > 0 || stamps.length > 0
  useEffect(() => {
    if (!map || !drawing) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setFrame((value) => value + 1))
    }
    map.on('move', update)
    return () => {
      cancelAnimationFrame(frame)
      map.off('move', update)
    }
  }, [map, drawing])

  const landStamp = useCallback(
    (code: string) => {
      const geometry = geometryOf(code)
      if (!geometry) return
      const key = ++sequence
      setStamps((list) => [...list, { key, code, at: geometry.centre, leaving: false }])
      // The stamp leaves with the toast.
      later(RECORDED_TOAST_MS, () =>
        setStamps((list) =>
          list.map((item) => (item.key === key ? { ...item, leaving: true } : item)),
        ),
      )
      later(RECORDED_TOAST_MS + SETTLE_MS, () =>
        setStamps((list) => list.filter((item) => item.key !== key)),
      )
    },
    [geometryOf, later],
  )

  const focusMap = useCallback(() => {
    map?.getCanvas().focus({ preventScroll: true })
  }, [map])

  const endTear = useCallback(() => {
    if (activeRef.current?.phase !== 'tearing') return
    motion.current?.stop()
    motion.current = null
    landing.current?.land()
    landing.current = null
    // The tabs leave with the sticker: focus on one of them returns to the map.
    if (rootRef.current?.contains(document.activeElement)) focusMap()
    setActive((current) => (current?.phase === 'tearing' ? null : current))
  }, [focusMap])

  const revert = useCallback(
    (code: string) => {
      if (activeRef.current?.code === code && activeRef.current.phase === 'tearing') {
        motion.current?.stop()
        motion.current = null
        landing.current = null
        setActive(null)
      }
      // The sticker fades back over the inked country; the fill leaves underneath it (REVERT_MS), then the ghost goes.
      const key = ++sequence
      setGhosts((list) => [...list, { key, code }])
      setStamps((list) =>
        list.map((item) => (item.code === code ? { ...item, leaving: true } : item)),
      )
      later(REVERT_MS, () => {
        setGhosts((list) => list.filter((item) => item.key !== key))
        setStamps((list) => list.filter((item) => item.code !== code || !item.leaving))
      })
    },
    [later],
  )

  const close = useCallback(() => {
    const current = activeRef.current
    if (!current || current.phase !== 'lifted') return false
    motion.current?.stop()
    motion.current = null
    if (reduced) {
      setActive(null)
      return true
    }
    setActive({ ...current, phase: 'closing', pull: null })
    later(SETTLE_MS, () =>
      setActive((value) =>
        value?.phase === 'closing' && value.code === current.code ? null : value,
      ),
    )
    return true
  }, [later, reduced])

  const lift = useCallback(
    (code: string) => {
      if (!map) return
      endTear()
      motion.current?.stop()
      const geometry = geometryOf(code)
      if (!geometry) return
      setActive({ code, phase: 'lifted', pull: null })
      const box = bounds(screenRings(map, geometry))
      if (Math.max(box.width, box.height) >= SMALL_OUTLINE) return
      const container = map.getContainer()
      const lons = geometry.rings.flat().map((point) => point[0]),
        lats = geometry.rings.flat().map((point) => point[1])
      const dx = box.left + box.width / 2 - container.clientWidth / 2,
        dy = box.top + box.height / 2 - container.clientHeight / 2
      const travel = Math.hypot(dx, dy) / Math.hypot(container.clientWidth, container.clientHeight)
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        {
          padding: Math.min(container.clientWidth, container.clientHeight) / 3,
          maxZoom: 6,
          duration: reduced ? 0 : Math.round(Math.min(MAX_CAMERA_MS, travel * 2 * MAX_CAMERA_MS)),
        },
      )
    },
    [map, geometryOf, endTear, reduced],
  )

  useImperativeHandle(control, () => ({ lift, dismiss: close, finish: endTear }), [
    lift,
    close,
    endTear,
  ])

  // Focus moves to the first tab when a sticker lifts.
  const liftedCode = active?.phase === 'lifted' ? active.code : null
  useEffect(() => {
    if (liftedCode) firstTab.current?.focus({ preventScroll: true })
  }, [liftedCode])

  // A tap anywhere outside the sticker and the map closes it; map taps are routed by the atlas.
  useEffect(() => {
    if (!liftedCode || !map) return
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target as Node | null
      if (!target || rootRef.current?.contains(target) || map.getContainer().contains(target))
        return
      close()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [liftedCode, map, close])

  if (!map) return null
  const geometry = active ? geometryOf(active.code) : null
  const rings = geometry ? screenRings(map, geometry) : null
  const box = rings ? bounds(rings) : null
  const centre: Point | null = box ? [box.left + box.width / 2, box.top + box.height / 2] : null
  const container = map.getContainer()

  /** Tab grab point (its top centre) in overlay coordinates. */
  const grabOf = (button: HTMLElement): Point => {
    const tab = button.getBoundingClientRect()
    const root = container.getBoundingClientRect()
    return [tab.left + tab.width / 2 - root.left, tab.top - root.top]
  }
  /** Overlay coordinates mapped into the lifted sticker's unscaled space. */
  const unscale = (point: Point): Point =>
    centre && !reduced
      ? [
          centre[0] + (point[0] - centre[0]) / LIFT_SCALE,
          centre[1] + (point[1] - centre[1]) / LIFT_SCALE,
        ]
      : point

  function tear(way: VisitWay, grab: Point, dir: Point, from: number, duration: number) {
    const current = activeRef.current
    if (!current || current.phase !== 'lifted') return
    const code = current.code
    const { announce } = record(code, way, {
      revert: () => revert(code),
      land: () => landStamp(code),
    })
    landing.current = {
      code,
      announce,
      land: () => {
        landStamp(code)
        announce()
      },
    }
    setActive({ code, way, phase: 'tearing', pull: { grab, dir, progress: from, dragging: false } })
    if (reduced) {
      // Opacity only: the sticker clears while the stamp appears, together.
      landing.current.land()
      landing.current = null
      later(REDUCED_TEAR_MS, () => {
        if (activeRef.current?.code === code) endTear()
      })
      return
    }
    const impact = Math.max(0, (0.75 - from) / (1 - from)) * duration
    later(impact, () => {
      if (landing.current?.code !== code) return
      landing.current.land()
      landing.current = null
    })
    motion.current = animate(from, 1, {
      duration: duration / 1000,
      ease: EASE_IN as unknown as [number, number, number, number],
      onUpdate: (progress) =>
        setActive((value) =>
          value?.code === code && value.phase === 'tearing' && value.pull
            ? { ...value, pull: { ...value.pull, progress } }
            : value,
        ),
      onComplete: endTear,
    })
  }

  const directionFrom = (grab: Point): Point =>
    centre ? [centre[0] - grab[0], centre[1] - grab[1]] : [0, -1]

  function onTabClick(way: VisitWay, button: HTMLButtonElement) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const grab = unscale(grabOf(button))
    tear(way, grab, directionFrom(grab), 0, TEAR_MS)
  }

  function onTabPointerDown(way: VisitWay, event: PointerEvent<HTMLButtonElement>) {
    if (reduced || activeRef.current?.phase !== 'lifted' || event.button !== 0) return
    motion.current?.stop()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const root = container.getBoundingClientRect()
    pointerState.current = {
      id: event.pointerId,
      start: [event.clientX - root.left, event.clientY - root.top],
      way,
      grab: unscale(grabOf(event.currentTarget)),
    }
  }

  function onTabPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const press = pointerState.current
    if (!press || press.id !== event.pointerId || !rings) return
    const root = container.getBoundingClientRect()
    const point: Point = [event.clientX - root.left, event.clientY - root.top]
    const moved = Math.hypot(point[0] - press.start[0], point[1] - press.start[1])
    const current = activeRef.current
    if (!current || current.phase !== 'lifted') return
    if (!current.pull?.dragging && moved <= PULL_SLOP) return
    const pointer = unscale(point)
    const folded = fold(rings, press.grab, pointer)
    setActive({
      ...current,
      pull: {
        grab: press.grab,
        dir: [pointer[0] - press.grab[0], pointer[1] - press.grab[1]],
        progress: folded?.progress ?? 0,
        dragging: true,
      },
    })
  }

  function onTabPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const press = pointerState.current
    if (!press || press.id !== event.pointerId) return
    pointerState.current = null
    const current = activeRef.current
    const pull = current?.pull
    if (!current || current.phase !== 'lifted' || !pull?.dragging) return
    // A pull never also counts as a tap.
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    })
    if (pull.progress >= TEAR_THRESHOLD) {
      const remaining = Math.min(TEAR_MS, Math.max(120, (1 - pull.progress) * TEAR_MS))
      tear(press.way, pull.grab, pull.dir, pull.progress, remaining)
      return
    }
    const code = current.code
    motion.current = animate(pull.progress, 0, {
      duration: SPRING_BACK_MS / 1000,
      ease: EASE_OUT as unknown as [number, number, number, number],
      onUpdate: (progress) =>
        setActive((value) =>
          value?.code === code && value.phase === 'lifted' && value.pull
            ? { ...value, pull: { ...value.pull, progress } }
            : value,
        ),
      onComplete: () =>
        setActive((value) =>
          value?.code === code && value.phase === 'lifted' ? { ...value, pull: null } : value,
        ),
    })
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    if (close()) focusMap()
  }

  // Drawing the sticker: the face beyond the fold stays stuck; the grab side is the flap, mirrored over the fold.
  let face: ReactNode = null
  if (active && rings && centre) {
    const d = pathOf(rings)
    const pull = active.pull
    const pointer = pull ? pointerAt(rings, pull.grab, pull.dir, pull.progress) : null
    const folded = pull && pointer ? fold(rings, pull.grab, pointer) : null
    const progress = pull?.progress ?? 0
    const fading =
      active.phase === 'tearing' ? (reduced ? 0 : Math.max(0, (progress - 0.75) / 0.25)) : 0
    const id = `atlas-sticker-${active.code}`
    face = (
      <g
        className="atlas-sticker"
        data-phase={active.phase}
        data-reduced={reduced || undefined}
        style={{
          transformOrigin: `${centre[0]}px ${centre[1]}px`,
          opacity: 1 - fading,
        }}
      >
        {folded && !reduced ? (
          <>
            <defs>
              <clipPath id={`${id}-stuck`} clipPathUnits="userSpaceOnUse">
                <polygon points={halfPlane(folded, 'stuck').join(' ')} />
              </clipPath>
              <clipPath id={`${id}-flap`} clipPathUnits="userSpaceOnUse">
                <polygon points={halfPlane(folded, 'flap').join(' ')} />
              </clipPath>
            </defs>
            <path className="atlas-sticker-face" d={d} clipPath={`url(#${id}-stuck)`} />
            <g transform={`matrix(${folded.matrix.join(' ')})`}>
              <path className="atlas-sticker-back" d={d} clipPath={`url(#${id}-flap)`} />
            </g>
          </>
        ) : (
          <path className="atlas-sticker-face" d={d} />
        )}
        {progress < 0.5 ? (
          <text className="atlas-sticker-name" x={centre[0]} y={centre[1]} textAnchor="middle">
            {name(active.code)}
          </text>
        ) : null}
      </g>
    )
  }

  // Tabs hang under the sticker, kept inside the map.
  const tabsWidth = Math.min(container.clientWidth - 16, 4 * 96)
  const tabsLeft =
    box && centre
      ? Math.min(Math.max(8, centre[0] - tabsWidth / 2), container.clientWidth - 8 - tabsWidth)
      : 0
  const tabsTop = box
    ? Math.min(Math.max(8, box.bottom + 8), container.clientHeight - TAB_HEIGHT - 8)
    : 0
  const stampSize = mobile ? 72 : 96

  return (
    <div className="atlas-sticker-layer" ref={rootRef}>
      <svg className="atlas-sticker-svg" aria-hidden="true">
        {ghosts.map((ghost) => {
          const ghostGeometry = geometryOf(ghost.code)
          return ghostGeometry ? (
            <path
              key={ghost.key}
              className="atlas-sticker-face atlas-sticker-ghost"
              d={pathOf(screenRings(map, ghostGeometry))}
            />
          ) : null
        })}
        {face}
      </svg>
      {active && box ? (
        <div
          role="group"
          aria-label={name(active.code)}
          className="atlas-sticker-tabs"
          data-phase={active.phase}
          onKeyDown={onKeyDown}
          style={{ transform: `translate(${tabsLeft}px, ${tabsTop}px)`, width: tabsWidth }}
        >
          {VISIT_WAYS.map((way, index) => (
            <button
              key={way}
              ref={index === 0 ? firstTab : undefined}
              type="button"
              className="atlas-sticker-tab"
              onClick={(event) => onTabClick(way, event.currentTarget)}
              onPointerDown={(event) => onTabPointerDown(way, event)}
              onPointerMove={onTabPointerMove}
              onPointerUp={onTabPointerUp}
              onPointerCancel={() => {
                pointerState.current = null
              }}
            >
              {WAY_LABELS[way][locale]}
            </button>
          ))}
        </div>
      ) : null}
      {stamps.map((stamp) => {
        const { x, y } = map.project(stamp.at)
        return (
          <div
            key={stamp.key}
            className="atlas-sticker-stamp"
            data-leaving={stamp.leaving || undefined}
            aria-hidden="true"
            style={{ transform: `translate(${x - stampSize / 2}px, ${y - stampSize / 2}px)` }}
          >
            <CountryStamp
              iso2={stamp.code}
              status="inked"
              size={stampSize}
              static={reduced}
              impressionId={`passport-atlas:${ownerId}:${stamp.code}:${stamp.key}`}
            />
          </div>
        )
      })}
    </div>
  )
}
