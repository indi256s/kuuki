'use client'

// The phone atlas's camera: the map is a passport you flip, not a map you drive. A horizontal swipe turns to the next
// travel-region page and the camera follows the finger between the two frames; a vertical drag stays the page's
// scroll; a pinch explores freely until "Back". Desktop keeps map.tsx's Controls instead.
import type * as GL from 'maplibre-gl'
import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Locale } from '../../../lib/format'
import { useMap } from '../../maps/mapcn'
import { criticalSpring } from '../../ui/critical-spring'
import { recentSamples, rubberBand, velocityOf, type Sample } from '../../ui/sheet-physics'
import {
  between,
  mercator,
  pageBox,
  pageName,
  unionBox,
  widen,
  type AtlasPage,
  type Box,
  type Camera,
} from './pages'

/** Apple's scroll deceleration: a release coasts `v · 0.998 / (1 − 0.998)` ms-seconds ahead. */
const DECELERATION = 0.998
/** A page turn settles in about this many seconds (page transitions run 300–400 ms). */
const TURN_RESPONSE = 0.4
/** A far flight takes a little longer the further out it has to pull, up to this much more. */
const FLIGHT_EXTRA = 0.2
/** Movement before a press becomes a swipe, and how much more horizontal than vertical it must be. */
const SLOP = 8
const HORIZONTAL_BIAS = 1.2
/** The cover is a reading view; a region frames closer but never at street level. */
const MAX_ZOOM = { cover: 4, region: 5 }
const PADDING = { top: 32, bottom: 32, left: 24, right: 24 }

const STRINGS = {
  en: { back: (name: string) => `Back to ${name}`, world: 'Whole world' },
  ru: { back: (name: string) => `Вернуться: ${name}`, world: 'Весь мир' },
} as const

const toCamera = (map: GL.Map): Camera => {
  const { lng, lat } = map.getCenter()
  return { ...mercator(lng, lat), zoom: map.getZoom() }
}
const lngLat = ({ x, y }: Camera): [number, number] => [
  x * 360 - 180,
  (360 / Math.PI) * Math.atan(Math.exp(((180 - y * 360) * Math.PI) / 180)) - 90,
]
const lngLatOf = (center: GL.LngLatLike): [number, number] =>
  Array.isArray(center)
    ? [center[0], center[1]]
    : 'lng' in center
      ? [center.lng, center.lat]
      : [center.lon, center.lat]
const bounds = (box: Box): [[number, number], [number, number]] => [
  [box[0], box[1]],
  [box[2], box[3]],
]

const place = (map: GL.Map, camera: Camera) =>
  map.jumpTo({ center: lngLat(camera), zoom: camera.zoom })

/** Drops reduced motion's fade out before it lands; cancelling also lifts its hold at 0 opacity. */
function cancelFade(state: { fading: Animation | null }) {
  if (!state.fading) return
  state.fading.onfinish = null
  state.fading.cancel()
  state.fading = null
}

/** Explore lets one finger pan the map; the frame gives sideways drags back to the pager. */
function setExploring(
  map: GL.Map,
  state: { explore: boolean },
  on: boolean,
  show: (on: boolean) => void,
) {
  state.explore = on
  show(on)
  if (on) map.dragPan.enable()
  else map.dragPan.disable()
  map.getContainer().dataset.pager = on ? 'explore' : 'frame'
}

/** A page's frame: its countries' box, widened on a region so a lone country keeps its neighbours. */
function pageFrame(page: AtlasPage, frameOf: (code: string) => Box | null): Box | null {
  const box = pageBox(page, frameOf)
  return box && page.id !== 'world' ? widen(box) : box
}

export function AtlasPager({
  locale,
  pages,
  page,
  onPage,
  reframe,
  onProgress,
  frameOf,
  interrupt,
  onPageZoom,
}: {
  locale: Locale
  pages: AtlasPage[]
  /** The page the strip and list show; the pager animates to it when it changes from outside. */
  page: number
  /** A swipe or a tap on the cover chose a page. */
  onPage: (index: number) => void
  /** Bumped when the current page is chosen again: the camera returns to its frame. */
  reframe: number
  /** The camera's page position on every frame it moves, fractional between pages. */
  onProgress: (position: number) => void
  frameOf: (code: string) => Box | null
  /** Drops a lifted sticker (finishing a tear in flight): a swipe moves the map out from under it. */
  interrupt: () => void
  /** The settled page's zoom, so countries too small at it get a marker. */
  onPageZoom: (zoom: number) => void
}) {
  const { map, ready } = useMap()
  const reduced = useReducedMotion() ?? false
  const [explore, setExplore] = useState(false)
  const text = STRINGS[locale]
  /** Set by the gesture effect: animate to a page chosen outside the map, and Back. */
  const goRef = useRef<((index: number) => void) | null>(null)
  const backRef = useRef<(() => void) | null>(null)

  // Everything the gesture loop reads lives in one ref, so listeners attach once per map.
  const live = useRef({
    cams: [] as Camera[],
    /** Zoom that shows page i and i + 1 together. */
    fits: [] as number[],
    pos: page,
    /** The page at rest and where its camera really is: its frame, or where a pinch or the sticker's flight left it. */
    base: page,
    origin: null as Camera | null,
    current: page,
    explore: false,
    reduced,
    spring: null as AnimationPlaybackControls | null,
    /** The page a far flight is heading to; a press lands it at once. */
    flight: null as number | null,
    /** Reduced motion's fade out, until it lands. */
    fading: null as Animation | null,
    pages,
    page,
    frameOf,
    onPage,
    onProgress,
    interrupt,
    onPageZoom,
  })
  // Before any effect below reads them.
  useLayoutEffect(() => {
    Object.assign(live.current, {
      pages,
      page,
      frameOf,
      onPage,
      onProgress,
      interrupt,
      onPageZoom,
      reduced,
    })
  })

  // Frames: once the geometry is in and whenever the pages or the map's size change.
  const frameKey = pages.map((entry) => `${entry.id}:${entry.codes.join(',')}`).join('|')
  useEffect(() => {
    if (!map || !ready) return
    const state = live.current
    const measure = () => {
      const frames = state.pages.map((entry) => pageFrame(entry, frameOf))
      state.cams = frames.map((frame, index) => {
        const cover = state.pages[index].id === 'world'
        const camera = frame
          ? map.cameraForBounds(bounds(frame), {
              padding: PADDING,
              maxZoom: cover ? MAX_ZOOM.cover : MAX_ZOOM.region,
            })
          : undefined
        const [lng, lat] = camera?.center ? lngLatOf(camera.center) : [0, 20]
        return { ...mercator(lng, lat), zoom: camera?.zoom ?? 0 }
      })
      state.fits = frames.slice(0, -1).map((frame, index) => {
        const both = unionBox(frame, frames[index + 1])
        return both ? (map.cameraForBounds(bounds(both), { padding: 24 })?.zoom ?? 0) : 0
      })
      // Pages can reorder when a country joins a new region: the page shown is the one the list names.
      const shown = Math.min(state.page, state.cams.length - 1)
      // At rest on its frame, a page refits to new frames; explored or off its frame on the same page, the camera stays
      // put. When the page itself changed under it (a filter removed it, a new country reordered the pages), the camera
      // goes to the page the list names.
      if (state.spring) return state.onPageZoom(state.cams[state.current]?.zoom ?? 0)
      const moved = state.current !== shown
      if (moved || (!state.explore && !state.origin)) {
        cancelFade(state)
        if (state.explore) setExploring(map, state, false, setExplore)
        state.current = state.pos = state.base = shown
        state.origin = null
        if (state.cams[shown]) place(map, state.cams[shown])
        state.onProgress(shown)
      }
      state.onPageZoom(state.cams[state.current]?.zoom ?? 0)
    }
    measure()
    map.on('resize', measure)
    return () => {
      map.off('resize', measure)
    }
  }, [map, ready, frameKey, frameOf])

  // The gesture contract: one finger sideways turns pages, one finger vertically scrolls the page, two fingers pinch.
  useEffect(() => {
    if (!map || !ready) return
    const state = live.current
    const container = map.getContainer()
    map.cooperativeGestures.disable()
    map.doubleClickZoom.disable()
    setExploring(map, state, false, setExplore)

    const apply = (camera: Camera) => place(map, camera)
    const camAt = (index: number) =>
      index === state.base && state.origin ? state.origin : state.cams[index]
    /** The camera at a fractional page position: between frames, or rubber-banded past either end. */
    const cameraAt = (position: number): Camera => {
      const last = state.cams.length - 1
      if (position <= 0 || position >= last) {
        const edge = position <= 0 ? 0 : last
        const camera = camAt(edge)
        const over = position - edge
        if (!over) return camera
        const width = container.clientWidth
        const px = Math.sign(over) * rubberBand(Math.abs(over) * width, width)
        return { ...camera, x: camera.x + px / (512 * 2 ** camera.zoom) }
      }
      const index = Math.floor(position),
        t = position - index
      if (!t) return camAt(index)
      return between(camAt(index), camAt(index + 1), t, state.fits[index] ?? 0)
    }
    const stop = () => {
      state.spring?.stop()
      state.spring = null
      state.flight = null
      cancelFade(state)
    }
    /** Lands on a page's frame. */
    const rest = (index: number) => {
      if (!state.cams[index]) return
      state.base = state.pos = index
      state.origin = null
      apply(state.cams[index])
      state.onProgress(index)
      state.onPageZoom(state.cams[index].zoom)
    }
    const choose = (index: number) => {
      if (state.current === index) return
      state.current = index
      state.onPage(index)
    }
    /** A critically damped spring on the page position, handed the release velocity (pages per second). */
    const turn = (target: number, velocity = 0) => {
      stop()
      choose(target)
      const controls = animate(state.pos, target, {
        ...criticalSpring(TURN_RESPONSE, velocity),
        onUpdate: (position) => {
          state.pos = position
          apply(cameraAt(position))
          state.onProgress(position)
        },
        onComplete: () => {
          if (state.spring !== controls) return
          state.spring = null
          // A cancelled swipe returns to where the camera was; a turned page lands on its frame.
          if (target === state.base) {
            state.pos = target
            apply(camAt(target))
            state.onProgress(target)
          } else rest(target)
        },
      })
      state.spring = controls
    }
    /** A far jump (strip, list, Back): one flight from where the camera is, not through every page between. */
    const fly = (target: number) => {
      stop()
      choose(target)
      const from = toCamera(map)
      const to = state.cams[target]
      const view = map.getBounds()
      const fit =
        map.cameraForBounds(
          bounds(
            unionBox(
              [view.getWest(), view.getSouth(), view.getEast(), view.getNorth()],
              pageFrame(state.pages[target], state.frameOf),
            )!,
          ),
          { padding: 24 },
        )?.zoom ?? 0
      state.flight = target
      const start = state.pos
      // The deeper the pull-back between the two frames, the longer the flight, so a world-spanning jump never snaps.
      const depth = Math.max(0, Math.min(from.zoom, to.zoom) - fit)
      const controls = animate(0, 1, {
        ...criticalSpring(TURN_RESPONSE + Math.min(FLIGHT_EXTRA, depth * 0.06)),
        onUpdate: (t) => {
          apply(between(from, to, t, fit))
          state.pos = start + (target - start) * t
          state.onProgress(state.pos)
        },
        onComplete: () => {
          if (state.spring !== controls) return
          state.spring = null
          state.flight = null
          rest(target)
        },
      })
      state.spring = controls
    }
    /** Reduced motion: a short crossfade and a jump, no camera flight. */
    const fade = (target: number) => {
      stop()
      choose(target)
      const canvas = map.getCanvas()
      const out = canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 75,
        fill: 'forwards',
      })
      state.fading = out
      out.onfinish = () => {
        state.fading = null
        rest(target)
        canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 75 })
        // The hold at 0 must not outlive the fade back in.
        out.cancel()
      }
    }
    const leaveExplore = () => {
      if (state.explore) setExploring(map, state, false, setExplore)
    }
    const go = (target: number) => {
      state.interrupt()
      leaveExplore()
      // At rest, leave from the real camera (a pinch or the sticker's flight may have moved it off the frame).
      if (!state.spring) {
        state.base = state.current
        state.origin = toCamera(map)
      }
      // A neighbour turns like a swipe; the page's own frame (Back, its tab again), far pages and a change of course
      // mid-flight fly from wherever the camera is.
      if (state.reduced) fade(target)
      else if (state.flight === null && target !== state.base && Math.abs(target - state.pos) <= 1)
        turn(target)
      else fly(target)
    }
    goRef.current = go

    let gesture: {
      id: number
      x: number
      y: number
      start: number
      /** The page the swipe started on: it turns at most one page from here. */
      page: number
      dragging: boolean
      /** The press stopped a turning page; if it never becomes a swipe, the turn finishes. */
      caught: boolean
      lastX: number
      samples: Sample[]
    } | null = null
    /** A turn the finger stopped but did not take over goes on to the page the list already names. */
    const settle = () => turn(state.current)
    const down = (event: PointerEvent) => {
      // A second finger is a pinch: MapLibre takes it, and the page goes back where it was until a zoom starts.
      if (!event.isPrimary) {
        const held = gesture
        gesture = null
        if (held?.dragging) finish(held, held.lastX, event.timeStamp, true)
        else if (held?.caught) settle()
        return
      }
      if (state.explore || event.button > 0) return
      let caught = false
      if (state.spring) {
        // Grab a turning page where it is; a far flight lands at once.
        const landing = state.flight
        stop()
        if (landing !== null) rest(landing)
        else caught = true
      } else {
        state.base = state.current
        state.origin = toCamera(map)
      }
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        start: state.pos,
        page: Math.round(state.pos),
        dragging: false,
        caught,
        lastX: event.clientX,
        samples: [],
      }
    }
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      const dx = event.clientX - gesture.x,
        dy = event.clientY - gesture.y
      if (!gesture.dragging) {
        if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS) {
          gesture.dragging = true
          // Follow from here, so the page does not jump by the slop at pickup.
          gesture.x = event.clientX
          container.setPointerCapture(event.pointerId)
          state.interrupt()
        } else if (Math.abs(dy) > SLOP) {
          // The page scrolls; a turn this press stopped carries on.
          if (gesture.caught) settle()
          gesture = null
        }
        return
      }
      gesture.lastX = event.clientX
      const position = gesture.start - (event.clientX - gesture.x) / container.clientWidth
      gesture.samples = recentSamples(gesture.samples, event.timeStamp, position)
      if (state.reduced) return
      state.pos = position
      apply(cameraAt(position))
      state.onProgress(position)
    }
    const release = (event: PointerEvent, cancelled: boolean) => {
      const done = gesture
      if (!done || event.pointerId !== done.id) return
      gesture = null
      if (!done.dragging) {
        if (done.caught) settle()
        else if (!state.spring) state.origin = null
        return
      }
      finish(done, event.clientX, event.timeStamp, cancelled)
    }
    /** A swipe let go (or cancelled by a second finger): one page on, or back where it started. */
    const finish = (
      done: NonNullable<typeof gesture>,
      x: number,
      time: number,
      cancelled: boolean,
    ) => {
      const last = state.cams.length - 1
      const moved = -(x - done.x) / container.clientWidth
      const position = done.start + moved
      const velocity = cancelled ? 0 : velocityOf(recentSamples(done.samples, time, position))
      if (state.reduced) {
        const step = Math.abs(moved) > 0.2 || Math.abs(velocity) > 0.8 ? Math.sign(moved) : 0
        const target = cancelled ? done.page : Math.max(0, Math.min(last, done.page + step))
        if (target !== state.current) fade(target)
        return
      }
      // One page per swipe, however hard the flick, and never past either end.
      const projected = state.pos + ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
      const target = cancelled
        ? done.page
        : Math.max(done.page - 1, Math.min(done.page + 1, Math.round(projected)))
      turn(Math.max(0, Math.min(last, target)), velocity)
    }
    const up = (event: PointerEvent) => release(event, false)
    const cancel = (event: PointerEvent) => release(event, true)
    // A pinch explores: one finger then pans the map, and Back returns to the page's frame.
    const pinch = (event: { originalEvent?: unknown }) => {
      // The pager's own camera moves carry no input event, so this is a hand: it takes the camera wherever it is.
      if (!event.originalEvent || state.explore) return
      stop()
      gesture = null
      setExploring(map, state, true, setExplore)
    }
    container.addEventListener('pointerdown', down)
    container.addEventListener('pointermove', move)
    container.addEventListener('pointerup', up)
    container.addEventListener('pointercancel', cancel)
    map.on('zoomstart', pinch)
    backRef.current = () => go(state.current)
    return () => {
      stop()
      container.removeEventListener('pointerdown', down)
      container.removeEventListener('pointermove', move)
      container.removeEventListener('pointerup', up)
      container.removeEventListener('pointercancel', cancel)
      map.off('zoomstart', pinch)
      delete container.dataset.pager
      map.cooperativeGestures.enable()
      map.dragPan.enable()
      map.doubleClickZoom.enable()
      goRef.current = null
      backRef.current = null
    }
  }, [map, ready])

  // A page chosen outside the map (strip, list, the cover) animates there.
  useEffect(() => {
    const state = live.current
    if (page === state.current || !state.cams.length) return
    goRef.current?.(page)
  }, [page])
  // Its tab chosen again: back to the page's frame, as a tab bar's second tap returns to the top.
  useEffect(() => {
    if (reframe && live.current.cams.length) goRef.current?.(live.current.page)
  }, [reframe])

  const id = pages[page]?.id ?? 'world'
  // Kept mounted, so Back leaves the way it came in.
  return (
    <button
      type="button"
      className="passport-atlas-back"
      data-shown={explore ? '' : undefined}
      tabIndex={explore ? undefined : -1}
      onClick={() => backRef.current?.()}
    >
      {id === 'world' ? text.world : text.back(pageName(locale, id))}
    </button>
  )
}
