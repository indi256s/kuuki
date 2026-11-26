'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { IsoFigure } from '../../overview/iso/iso-figure'
import { useMobile } from '../../ui/use-mobile'
import { buildLane } from './lane-figure'
import type { LaneModel, LaneSize } from './lane-model'
import './security-lane.css'

const BOX = {
  desktop: { w: 560, h: { hero: 216, stage: 300, band: 120 } },
  mobile: { w: 400, h: { hero: 224, stage: 232, band: 96 } },
} as const
const FALLBACK = { desktop: 560, mobile: 358 }
const LINGER = 1400

export function laneBox(mobile: boolean, size: LaneSize, room: number | null) {
  const mode = mobile ? 'mobile' : 'desktop'
  const w = Math.min(BOX[mode].w, room && room > 0 ? Math.floor(room / 4) * 4 : FALLBACK[mode])
  return { w, h: BOX[mode].h[size] }
}

const REDUCED = '(prefers-reduced-motion: reduce)'
const subscribeStill = (notify: () => void) => {
  const query = window.matchMedia(REDUCED)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const isStill = () => window.matchMedia(REDUCED).matches

const isTray = (target: EventTarget | null): target is Element =>
  target instanceof Element && /^(tray|front):/.test(target.getAttribute('data-part') ?? '')

const BUMP = { duration: 450, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }

export function SecurityLane({ model }: { model: LaneModel }) {
  const mobile = useMobile() ?? false
  const still = useSyncExternalStore(subscribeStill, isStill, () => false)
  const root = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<number | null>(null)
  const [moving, setMoving] = useState(false)
  const [paused, setPaused] = useState(false)

  const exit = model.trays.find((tray) => tray.slot === 'exit')?.id ?? null
  const [last, setLast] = useState({ size: model.size, exit })
  const [linger, setLinger] = useState(false)
  if (last.size !== model.size || last.exit !== exit) {
    setLast({ size: model.size, exit })
    if (last.size !== model.size)
      setLinger(
        last.size === 'stage' && model.size === 'band' && exit !== null && exit !== last.exit,
      )
  }
  useEffect(() => {
    if (!linger) return
    const timer = setTimeout(() => setLinger(false), LINGER)
    return () => clearTimeout(timer)
  }, [linger])

  const size = linger ? 'stage' : model.size
  const { w, h } = laneBox(mobile, size, room)
  const box = useMemo(() => ({ w, h }), [w, h])
  const frame = `${size}:${w}x${h}`
  const key = JSON.stringify({ ...model, size })
  const shown = useMemo(() => JSON.parse(key) as LaneModel, [key])
  const { figure, camera } = useMemo(() => buildLane(box, shown), [box, shown])

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    setRoom(element.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setRoom(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const travelling = useRef(new Set<Element>())
  useEffect(() => {
    const element = root.current
    if (!element) return
    const { current: trays } = travelling
    const start = (event: TransitionEvent) => {
      if (!isTray(event.target)) return
      trays.add(event.target)
      setMoving(true)
    }
    const end = (event: TransitionEvent) => {
      if (trays.delete(event.target as Element) && !trays.size) setMoving(false)
    }
    element.addEventListener('transitionstart', start)
    element.addEventListener('transitionend', end)
    element.addEventListener('transitioncancel', end)
    return () => {
      element.removeEventListener('transitionstart', start)
      element.removeEventListener('transitionend', end)
      element.removeEventListener('transitioncancel', end)
      trays.clear()
      setMoving(false)
    }
  }, [frame])

  useEffect(() => {
    const element = root.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    let visible = true
    const update = () => setPaused(!visible || document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      update()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  const bumped = useRef<Set<string> | null>(null)
  useEffect(() => {
    const { current: trays } = travelling
    for (const tray of trays) if (!tray.isConnected) trays.delete(tray)
    if (!trays.size) setMoving(false)

    const rejected = shown.trays.filter((tray) => tray.rejected === 'type').map(({ id }) => id)
    const arrived = !bumped.current
    const played = (bumped.current ??= new Set())
    const fresh = new Set(rejected.filter((id) => !played.has(id)))
    for (const id of rejected) played.add(id)
    if (arrived || still || !fresh.size) return
    for (const bump of root.current?.querySelectorAll<SVGGElement>("[data-part='bump']") ?? []) {
      const part = bump.parentElement?.getAttribute('data-part') ?? ''
      if (!fresh.has(part.slice(part.indexOf(':') + 1))) continue
      const style = getComputedStyle(bump)
      const reach = `translate(${style.getPropertyValue('--bump-x')}, ${style.getPropertyValue('--bump-y')})`
      bump.animate?.(
        [
          { transform: 'translate(0, 0)', easing: BUMP.easing },
          { transform: reach, easing: BUMP.easing, offset: 0.45 },
          { transform: 'translate(0, 0)' },
        ],
        BUMP.duration,
      )
    }
  }, [shown, still])

  return (
    <div
      ref={root}
      className="security-lane"
      aria-hidden="true"
      data-size={size}
      data-flaps={model.flaps || undefined}
      data-rolling={model.rollers || moving || undefined}
      data-paused={paused || undefined}
      data-still={still || undefined}
      style={{ height: h }}
    >
      <div
        className="security-lane-view"
        style={
          {
            width: w,
            height: h,
            '--cam-x': `${camera[0]}px`,
            '--cam-y': `${camera[1]}px`,
          } as CSSProperties
        }
      >
        <IsoFigure key={frame} figure={figure} />
      </div>
    </div>
  )
}
