'use client'
// The atlas sticker: an unrecorded country lifts as a sticker with four tear-off tabs. A tab tap tears it by itself;
// a pull folds it after the finger. The tear records the visit (quick-visit.ts), inks the country and lands its stamp.
//
// Following the camera: everything here is drawn in screen pixels at the last React render. The map is flat Mercator
// with bearing and pitch locked, so a camera move is exactly one translate and scale of that drawing. Each `move` writes
// it synchronously (never rAF, never React state: MapLibre's own render rAF is already queued ahead of any of ours, and
// a re-queued one is cancelled before it runs during a drag); `moveend` re-renders once to re-project crisply.

import {
  animate,
  useReducedMotion,
  type AnimationPlaybackControls,
  type ValueAnimationTransition,
} from 'motion/react'
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
import { criticalSpring } from '../../ui/critical-spring'
import { useMobile } from '../../ui/use-mobile'
import type { Locale } from '../../../lib/format'
import { VISIT_WAYS, WAY_LABELS, type VisitWay } from '../visit-ways'
import { YearDrum, type YearDrumResult, type YearValue } from '../year-drum'
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
import { RECORDED_TOAST_MS, REVERT_MS, type RecordVisit, type SetYear } from './quick-visit'
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
/** A tab press lifts the sticker's corner this far toward the tab: the answer on pointer-down. */
const PRESS_HINT = 0.06
const PRESS_MS = 100
/** Seconds of momentum a released pull is projected forward (Apple's 0.998 deceleration): a flick tears. */
const PROJECTION_S = 0.5
const TEAR_MS = 320
const SETTLE_MS = 150
const SPRING_BACK_MS = 200
const REDUCED_TEAR_MS = 150
/** Smaller outlines than this (px, longest side) get the camera first. */
const SMALL_OUTLINE = 96
const MAX_CAMERA_MS = 300
const TAB_HEIGHT = 44
// Ease-in for the tear only (spec): the paper resists, then lets go. Routine motion stays ease-out.
const EASE_IN: [number, number, number, number] = [0.55, 0, 1, 0.45]
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

type Pull = { grab: Point; dir: Point; progress: number; dragging: boolean }
type Press = {
  id: number
  start: Point
  way: VisitWay
  grab: Point
  /** Finger → fold tip, fixed when the drag starts so the fold continues from what is on screen. */
  offset: Point | null
  samples: { t: number; progress: number }[]
}

/** Progress per second over the last 100 ms of a pull; 0 without two samples. */
function velocityOf(samples: Press['samples']) {
  if (samples.length < 2) return 0
  const first = samples[0],
    last = samples[samples.length - 1]
  const seconds = (last.t - first.t) / 1000
  return seconds > 0 ? (last.progress - first.progress) / seconds : 0
}
type Active = {
  code: string
  phase: 'lifted' | 'closing' | 'tearing'
  way?: VisitWay
  pull: Pull | null
}
type Ghost = { key: number; code: string }
/** The camera as the last render saw it: `at` is a fixed point near the view and `x`,`y` where it was drawn. */
type Anchor = { zoom: number; at: GL.LngLat; x: number; y: number }
type StampNode = { node: HTMLElement; at: [number, number]; size: number }
type LandedStamp = {
  key: number
  code: string
  at: [number, number]
  leaving: boolean
  /** The date band's year, as chosen on the drum. */
  year: YearValue
  /** The drum is open over the band; the stamp stays meanwhile. */
  editing: boolean
  /** The drum was opened from the keyboard: no entrance. */
  instant: boolean
}
/** When a landed stamp may leave: with the toast, or a beat after its drum closes, whichever is later. */
type Hold = { code: string; due: number; timer: number | null; setYear: SetYear }
const BAND_LABEL: Record<Locale, string> = { en: 'Year of visit', ru: 'Год визита' }
const BAND_PLACEHOLDER: Record<Locale, string> = { en: 'year', ru: 'год' }
const NOT_SET: Record<Locale, string> = { en: 'not set', ru: 'не указан' }

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
  onActive,
}: {
  control: RefObject<StickerHandle | null>
  locale: Locale
  ownerId: string
  name: (code: string) => string
  geometryOf: (code: string) => StickerGeometry | null
  record: RecordVisit
  /** The country on the sticker (any phase), or null: the map hides its always-on label meanwhile. */
  onActive?: (code: string | null) => void
}) {
  const { map } = useMap()
  const reduced = useReducedMotion() ?? false
  const mobile = useMobile()
  const [active, setActive] = useState<Active | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [stamps, setStamps] = useState<LandedStamp[]>([])
  const [, setFrame] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const faceFollow = useRef<SVGGElement>(null)
  const shadowFollow = useRef<HTMLDivElement>(null)
  const stampNodes = useRef(new Map<number, StampNode>())
  const bandNodes = useRef(new Map<number, HTMLButtonElement>())
  const holds = useRef(new Map<number, Hold>())
  const anchor = useRef<Anchor | null>(null)
  const firstTab = useRef<HTMLButtonElement>(null)
  const motion = useRef<AnimationPlaybackControls | null>(null)
  const timers = useRef(new Set<number>())
  const activeRef = useRef(active)
  useLayoutEffect(() => {
    activeRef.current = active
  }, [active])
  // The tear's pending landing: the stamp and toast arrive at impact, or at once when the tear is cut short.
  const landing = useRef<{ code: string; land: () => void; announce: () => void } | null>(null)
  const pointerState = useRef<Press | null>(null)
  const suppressClick = useRef(false)

  const later = useCallback((ms: number, run: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      run()
    }, ms)
    timers.current.add(id)
    return id
  }, [])
  const unlater = useCallback((id: number) => {
    window.clearTimeout(id)
    timers.current.delete(id)
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

  // What this render drew: the layout effect below keeps it as the base for the camera-follow transform.
  const view = map
    ? (() => {
        const at = map.getCenter()
        const { x, y } = map.project(at)
        return { zoom: map.getZoom(), at, x, y }
      })()
    : null
  useLayoutEffect(() => {
    anchor.current = view
    // This render re-projected everything: the camera-follow transforms start over.
    for (const node of [faceFollow.current, shadowFollow.current])
      if (node) node.style.transform = ''
  })

  const drawing = !!active || ghosts.length > 0 || stamps.length > 0
  useLayoutEffect(() => {
    if (!map || !drawing) return
    const root = rootRef.current
    const follow = () => {
      const from = anchor.current
      if (!from) return
      const scale = 2 ** (map.getZoom() - from.zoom)
      const now = map.project(from.at)
      const transform = `translate(${now.x - scale * from.x}px, ${now.y - scale * from.y}px) scale(${scale})`
      if (faceFollow.current) faceFollow.current.style.transform = transform
      if (shadowFollow.current) shadowFollow.current.style.transform = transform
      for (const { node, at, size } of stampNodes.current.values()) {
        const { x, y } = map.project(at)
        node.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
      }
      // The tabs sit in screen space and wait for the camera to land.
      root?.setAttribute('data-moving', '')
    }
    const settle = () => {
      root?.removeAttribute('data-moving')
      setFrame((value) => value + 1)
    }
    map.on('move', follow)
    map.on('moveend', settle)
    return () => {
      map.off('move', follow)
      map.off('moveend', settle)
      root?.removeAttribute('data-moving')
    }
  }, [map, drawing])

  const activeCode = active?.code ?? null
  useEffect(() => {
    onActive?.(activeCode)
    return () => onActive?.(null)
  }, [activeCode, onActive])

  const focusMap = useCallback(() => {
    map?.getCanvas().focus({ preventScroll: true })
  }, [map])

  /** Starts the stamp's leave clock: it fades once `due` has passed, then goes. Restarting replaces the clock. */
  const scheduleLeave = useCallback(
    (key: number) => {
      const hold = holds.current.get(key)
      if (!hold) return
      if (hold.timer !== null) unlater(hold.timer)
      hold.timer = later(Math.max(0, hold.due - Date.now()), () => {
        setStamps((list) =>
          list.map((item) => (item.key === key ? { ...item, leaving: true } : item)),
        )
        hold.timer = later(SETTLE_MS, () => {
          holds.current.delete(key)
          // A band that still holds focus hands it back to the map rather than to the page.
          if (bandNodes.current.get(key) === document.activeElement) focusMap()
          setStamps((list) => list.filter((item) => item.key !== key))
        })
      })
    },
    [later, unlater, focusMap],
  )

  const landStamp = useCallback(
    (code: string, setYear: SetYear) => {
      const geometry = geometryOf(code)
      if (!geometry) return
      const key = ++sequence
      setStamps((list) => [
        ...list,
        {
          key,
          code,
          at: geometry.centre,
          leaving: false,
          year: null,
          editing: false,
          instant: false,
        },
      ])
      // The stamp leaves with the toast.
      holds.current.set(key, { code, due: Date.now() + RECORDED_TOAST_MS, timer: null, setYear })
      scheduleLeave(key)
    },
    [geometryOf, scheduleLeave],
  )

  const openDate = useCallback(
    (key: number, instant: boolean) => {
      const hold = holds.current.get(key)
      // The stamp stays while the drum is open.
      if (hold?.timer != null) unlater(hold.timer)
      if (hold) hold.timer = null
      setStamps((list) =>
        list.map((item) => (item.key === key ? { ...item, editing: true, instant } : item)),
      )
    },
    [unlater],
  )

  const closeDate = useCallback(
    (key: number, result: YearDrumResult) => {
      const hold = holds.current.get(key)
      setStamps((list) =>
        list.map((item) =>
          item.key === key ? { ...item, editing: false, year: result.year } : item,
        ),
      )
      if (result.changed) hold?.setYear(result.year)
      if (result.refocus) bandNodes.current.get(key)?.focus({ preventScroll: true })
      if (hold) {
        hold.due = Math.max(hold.due, Date.now() + SETTLE_MS)
        scheduleLeave(key)
      }
    },
    [scheduleLeave],
  )

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
      // The reverted country's stamps go with the fill: their own leave clocks are off.
      for (const [key, hold] of holds.current)
        if (hold.code === code) {
          if (hold.timer !== null) unlater(hold.timer)
          holds.current.delete(key)
        }
      later(REVERT_MS, () => {
        setGhosts((list) => list.filter((item) => item.key !== key))
        setStamps((list) => list.filter((item) => item.code !== code || !item.leaving))
      })
    },
    [later, unlater],
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

  // The member panning, wheeling or pinching the map closes a lifted sticker like a popover; the lift's own flight and
  // the zoom buttons carry no pointer event. A tear in flight is never interrupted (close only acts on a lifted sticker).
  useEffect(() => {
    if (!liftedCode || !map) return
    const pan = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) close()
    }
    map.on('dragstart', pan)
    map.on('zoomstart', pan)
    map.on('movestart', pan)
    return () => {
      map.off('dragstart', pan)
      map.off('zoomstart', pan)
      map.off('movestart', pan)
    }
  }, [liftedCode, map, close])

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

  /** Runs the fold's progress, starting from what is on screen; updates only while the sticker keeps its phase. */
  function drive(
    code: string,
    phase: Active['phase'],
    keys: number[],
    options: ValueAnimationTransition<number>,
    done?: () => void,
  ) {
    motion.current?.stop()
    // A single value: the start, then its keyframes. An array as the first argument is a list of subjects to animate,
    // which never calls onUpdate or onComplete, so the fold would stand still and the tear would never end.
    motion.current = animate(keys[0], keys, {
      ...options,
      onUpdate: (value: number) =>
        setActive((current) =>
          current?.code === code && current.phase === phase && current.pull
            ? { ...current, pull: { ...current.pull, progress: Math.min(1, Math.max(0, value)) } }
            : current,
        ),
      onComplete: done,
    })
  }

  function springBack(code: string, from: number, velocity: number) {
    // Critically damped and handed the finger's velocity, so a release never hits a wall.
    drive(code, 'lifted', [from, 0], criticalSpring(SPRING_BACK_MS / 1000, velocity), () =>
      setActive((value) =>
        value?.code === code && value.phase === 'lifted' ? { ...value, pull: null } : value,
      ),
    )
  }

  function tear(
    way: VisitWay,
    grab: Point,
    dir: Point,
    from: number,
    duration: number,
    velocity = 0,
  ) {
    const current = activeRef.current
    if (!current || current.phase !== 'lifted') return
    motion.current?.stop()
    motion.current = null
    const code = current.code
    const written = record(code, way, {
      revert: () => revert(code),
      // A retry brings its own writer; the first write's stamp uses the one the tear started.
      land: (setYear) => landStamp(code, setYear ?? written.setYear),
    })
    const { announce } = written
    landing.current = {
      code,
      announce,
      land: () => {
        landStamp(code, written.setYear)
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
    if (velocity > 0) {
      // A released pull keeps the finger's speed: no restart from rest.
      drive(code, 'tearing', [from, 1], criticalSpring(duration / 1000, velocity), endTear)
      return
    }
    // From rest the paper resists, then lets go (spec). Without a press to lift the corner first (keyboard),
    // a short ease-out unstick answers at once so the ease-in never reads as lag.
    const unstick = from < PRESS_HINT / 2
    drive(
      code,
      'tearing',
      unstick ? [from, PRESS_HINT, 1] : [from, 1],
      unstick
        ? { duration: duration / 1000, times: [0, 0.2, 1], ease: [EASE_OUT, EASE_IN] }
        : { duration: duration / 1000, ease: EASE_IN },
      endTear,
    )
  }

  const directionFrom = (grab: Point): Point =>
    centre ? [centre[0] - grab[0], centre[1] - grab[1]] : [0, -1]

  const sameGrab = (pull: Pull | null | undefined, grab: Point) =>
    !!pull && Math.hypot(pull.grab[0] - grab[0], pull.grab[1] - grab[1]) < 1

  function onTabClick(way: VisitWay, button: HTMLButtonElement) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    // A tap tears from wherever its press lifted the corner; a key press starts from rest.
    const grab = unscale(grabOf(button))
    const pull = activeRef.current?.pull
    const from = sameGrab(pull, grab) ? pull!.progress : 0
    tear(way, grab, sameGrab(pull, grab) ? pull!.dir : directionFrom(grab), from, TEAR_MS)
  }

  function onTabPointerDown(way: VisitWay, event: PointerEvent<HTMLButtonElement>) {
    const current = activeRef.current
    // One finger at a time: a second touch never steals the fold.
    if (reduced || current?.phase !== 'lifted' || event.button !== 0 || pointerState.current) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const root = container.getBoundingClientRect()
    const grab = unscale(grabOf(event.currentTarget))
    // Grabbed mid spring-back: keep the fold that is on screen.
    const pull: Pull = sameGrab(current.pull, grab)
      ? { ...current.pull!, dragging: false }
      : { grab, dir: directionFrom(grab), progress: 0, dragging: false }
    pointerState.current = {
      id: event.pointerId,
      start: [event.clientX - root.left, event.clientY - root.top],
      way,
      grab,
      offset: null,
      samples: [],
    }
    setActive({ ...current, pull })
    // The press answers at once: the corner lifts toward the finger.
    drive(current.code, 'lifted', [pull.progress, Math.max(pull.progress, PRESS_HINT)], {
      duration: PRESS_MS / 1000,
      ease: EASE_OUT,
    })
  }

  function onTabPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const press = pointerState.current
    if (!press || press.id !== event.pointerId || !rings) return
    const current = activeRef.current
    if (!current || current.phase !== 'lifted' || !current.pull) return
    const root = container.getBoundingClientRect()
    const point: Point = [event.clientX - root.left, event.clientY - root.top]
    const finger = unscale(point)
    if (!press.offset) {
      if (Math.hypot(point[0] - press.start[0], point[1] - press.start[1]) <= PULL_SLOP) return
      // The drag picks the fold up where it is, so nothing jumps under the finger.
      motion.current?.stop()
      motion.current = null
      const tip = pointerAt(rings, current.pull.grab, current.pull.dir, current.pull.progress)
      press.offset = [tip[0] - finger[0], tip[1] - finger[1]]
    }
    const pointer: Point = [finger[0] + press.offset[0], finger[1] + press.offset[1]]
    const progress = fold(rings, press.grab, pointer)?.progress ?? 0
    const now = event.timeStamp
    press.samples = [
      ...press.samples.filter((sample) => now - sample.t <= 100),
      { t: now, progress },
    ]
    setActive({
      ...current,
      pull: {
        grab: press.grab,
        dir: [pointer[0] - press.grab[0], pointer[1] - press.grab[1]],
        progress,
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
    // A press without a drag is a tap: its click tears from the lifted corner.
    if (!current || current.phase !== 'lifted' || !pull?.dragging) return
    // A pull never also counts as a tap.
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    })
    // Where the pull is going decides, not only where it stopped: a flick tears, a pull back returns.
    const velocity = velocityOf(press.samples)
    if (pull.progress + velocity * PROJECTION_S >= TEAR_THRESHOLD) {
      const remaining = Math.min(TEAR_MS, Math.max(120, (1 - pull.progress) * TEAR_MS))
      tear(press.way, pull.grab, pull.dir, pull.progress, remaining, Math.max(0, velocity))
      return
    }
    springBack(current.code, pull.progress, velocity)
  }

  function onTabPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    const press = pointerState.current
    if (!press || press.id !== event.pointerId) return
    pointerState.current = null
    const current = activeRef.current
    if (current?.phase === 'lifted' && current.pull)
      springBack(current.code, current.pull.progress, 0)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    if (close()) focusMap()
  }

  // Drawing the sticker: the face beyond the fold stays stuck; the grab side is the flap, mirrored over the fold.
  let face: ReactNode = null
  let shadow: ReactNode = null
  if (active && rings && centre) {
    const d = pathOf(rings)
    const pull = active.pull
    const pointer = pull ? pointerAt(rings, pull.grab, pull.dir, pull.progress) : null
    const folded = pull && pointer ? fold(rings, pull.grab, pointer) : null
    const progress = pull?.progress ?? 0
    const fading =
      active.phase === 'tearing' ? (reduced ? 0 : Math.max(0, (progress - 0.75) / 0.25)) : 0
    const id = `atlas-sticker-${active.code}`
    // The lift's shadow is its own composited layer: blurred once, then only faded; the camera moves its wrapper.
    shadow = reduced ? null : (
      <div className="atlas-sticker-follow-html" ref={shadowFollow}>
        <svg
          key={active.code}
          className="atlas-sticker-shadow"
          data-phase={active.phase}
          aria-hidden="true"
          style={{
            transformOrigin: `${centre[0]}px ${centre[1]}px`,
            opacity: active.phase === 'tearing' ? Math.max(0, 1 - 2 * progress) : undefined,
          }}
        >
          <path d={d} />
        </svg>
      </div>
    )
    face = (
      <g
        key={active.code}
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
      {shadow}
      <svg className="atlas-sticker-svg" aria-hidden="true">
        <g className="atlas-sticker-follow" ref={faceFollow}>
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
        </g>
      </svg>
      {active && box ? (
        <div
          key={active.code}
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
              onPointerCancel={onTabPointerCancel}
            >
              {WAY_LABELS[way][locale]}
            </button>
          ))}
        </div>
      ) : null}
      {stamps.map((stamp) => {
        const { x, y } = map.project(stamp.at)
        const label = `${BAND_LABEL[locale]}: ${stamp.year ?? NOT_SET[locale]}`
        return (
          <div
            key={stamp.key}
            ref={(node) => {
              if (node) stampNodes.current.set(stamp.key, { node, at: stamp.at, size: stampSize })
              else stampNodes.current.delete(stamp.key)
            }}
            className="atlas-sticker-stamp"
            data-leaving={stamp.leaving || undefined}
            style={{
              width: stampSize,
              height: stampSize,
              transform: `translate(${x - stampSize / 2}px, ${y - stampSize / 2}px)`,
            }}
          >
            <div aria-hidden="true">
              <CountryStamp
                iso2={stamp.code}
                status="inked"
                size={stampSize}
                static={reduced}
                impressionId={`passport-atlas:${ownerId}:${stamp.code}:${stamp.key}`}
              />
            </div>
            <div className="atlas-sticker-date">
              <button
                ref={(node) => {
                  if (node) bandNodes.current.set(stamp.key, node)
                  else bandNodes.current.delete(stamp.key)
                }}
                type="button"
                className="atlas-sticker-band"
                data-set={stamp.year !== null || undefined}
                aria-label={label}
                aria-expanded={stamp.editing}
                tabIndex={stamp.leaving ? -1 : 0}
                onClick={(event) =>
                  stamp.editing ? undefined : openDate(stamp.key, event.detail === 0)
                }
              >
                <span>{stamp.year ?? BAND_PLACEHOLDER[locale]}</span>
              </button>
              {stamp.editing ? (
                <YearDrum
                  value={stamp.year}
                  locale={locale}
                  instant={stamp.instant}
                  trigger={() => bandNodes.current.get(stamp.key) ?? null}
                  onClose={(result) => closeDate(stamp.key, result)}
                />
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
