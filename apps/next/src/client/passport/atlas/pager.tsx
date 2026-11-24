'use client'

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

const DECELERATION = 0.998
const TURN_RESPONSE = 0.4
const FLIGHT_EXTRA = 0.2
const SLOP = 8
const HORIZONTAL_BIAS = 1.2
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

function cancelFade(state: { fading: Animation | null }) {
  if (!state.fading) return
  state.fading.onfinish = null
  state.fading.cancel()
  state.fading = null
}

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
  page: number
  onPage: (index: number) => void
  reframe: number
  onProgress: (position: number) => void
  frameOf: (code: string) => Box | null
  interrupt: () => void
  onPageZoom: (zoom: number) => void
}) {
  const { map, ready } = useMap()
  const reduced = useReducedMotion() ?? false
  const [explore, setExplore] = useState(false)
  const text = STRINGS[locale]
  const goRef = useRef<((index: number) => void) | null>(null)
  const backRef = useRef<(() => void) | null>(null)

  const live = useRef({
    cams: [] as Camera[],
    fits: [] as number[],
    pos: page,
    base: page,
    origin: null as Camera | null,
    current: page,
    explore: false,
    reduced,
    spring: null as AnimationPlaybackControls | null,
    flight: null as number | null,
    fading: null as Animation | null,
    pages,
    page,
    frameOf,
    onPage,
    onProgress,
    interrupt,
    onPageZoom,
  })
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
      const shown = Math.min(state.page, state.cams.length - 1)
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
          if (target === state.base) {
            state.pos = target
            apply(camAt(target))
            state.origin = null
            state.onProgress(target)
          } else rest(target)
        },
      })
      state.spring = controls
    }
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
        out.cancel()
      }
    }
    const leaveExplore = () => {
      if (state.explore) setExploring(map, state, false, setExplore)
    }
    const go = (target: number) => {
      state.interrupt()
      leaveExplore()
      if (!state.spring) {
        state.base = state.current
        state.origin = toCamera(map)
      }
      if (state.reduced) fade(target)
      else if (state.flight === null && target !== state.base && Math.abs(target - state.pos) <= 1)
        turn(target)
      else fly(target)
    }
    goRef.current = go

    let suppressClick = false
    const click = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0) return
      event.preventDefault()
      event.stopPropagation()
    }
    let gesture: {
      id: number
      x: number
      y: number
      start: number
      page: number
      dragging: boolean
      caught: boolean
      lastX: number
      samples: Sample[]
    } | null = null
    const settle = () => turn(state.current)
    const down = (event: PointerEvent) => {
      if (!event.isPrimary) {
        suppressClick = true
        const held = gesture
        gesture = null
        if (held?.dragging) finish(held, held.lastX, event.timeStamp, true)
        else if (held?.caught) settle()
        return
      }
      suppressClick = false
      if (state.explore || event.button > 0) return
      let caught = false
      if (state.spring) {
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
        if (Math.hypot(dx, dy) > SLOP) suppressClick = true
        if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS) {
          gesture.dragging = true
          gesture.x = event.clientX
          container.setPointerCapture(event.pointerId)
          state.interrupt()
        } else if (Math.abs(dy) > SLOP) {
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
      if (cancelled) suppressClick = true
      if (!done.dragging) {
        if (done.caught) settle()
        else if (!state.spring) state.origin = null
        return
      }
      finish(done, event.clientX, event.timeStamp, cancelled)
    }
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
        else if (!state.fading) state.origin = null
        return
      }
      const projected = state.pos + ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
      const target = cancelled
        ? done.page
        : Math.max(done.page - 1, Math.min(done.page + 1, Math.round(projected)))
      turn(Math.max(0, Math.min(last, target)), velocity)
    }
    const up = (event: PointerEvent) => release(event, false)
    const cancel = (event: PointerEvent) => release(event, true)
    const pinch = (event: { originalEvent?: unknown }) => {
      if (!event.originalEvent || state.explore) return
      stop()
      gesture = null
      setExploring(map, state, true, setExplore)
    }
    container.addEventListener('click', click, true)
    container.addEventListener('pointerdown', down)
    container.addEventListener('pointermove', move)
    container.addEventListener('pointerup', up)
    container.addEventListener('pointercancel', cancel)
    map.on('zoomstart', pinch)
    backRef.current = () => go(state.current)
    return () => {
      stop()
      container.removeEventListener('click', click, true)
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

  useEffect(() => {
    const state = live.current
    if (page === state.current || !state.cams.length) return
    goRef.current?.(page)
  }, [page])
  useEffect(() => {
    if (reframe && live.current.cams.length) goRef.current?.(live.current.page)
  }, [reframe])

  const id = pages[page]?.id ?? 'world'
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
