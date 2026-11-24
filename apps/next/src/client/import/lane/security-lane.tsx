'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { IsoFigure } from '../../overview/iso/iso-figure'
import { useMobile } from '../../ui/use-mobile'
import { buildLane } from './lane-figure'
import type { LaneModel } from './lane-model'
import './security-lane.css'

const BOX = {
  desktop: { hero: { w: 560, h: 216 }, band: { w: 560, h: 120 } },
  mobile: { hero: { w: 328, h: 168 }, band: { w: 328, h: 96 } },
} as const

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
  const box = BOX[useMobile() ? 'mobile' : 'desktop'][model.size]
  const key = JSON.stringify(model)
  const shown = useMemo(() => JSON.parse(key) as LaneModel, [key])
  const figure = useMemo(() => buildLane(box, shown), [box, shown])
  const still = useSyncExternalStore(subscribeStill, isStill, () => false)
  const root = useRef<HTMLDivElement>(null)
  const [moving, setMoving] = useState(false)
  const [paused, setPaused] = useState(false)

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
  }, [box])

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
      data-size={model.size}
      data-flaps={model.flaps || undefined}
      data-rolling={model.rollers || moving || undefined}
      data-paused={paused || undefined}
      data-still={still || undefined}
      style={{ height: box.h }}
    >
      <IsoFigure key={`${box.w}x${box.h}`} figure={figure} />
    </div>
  )
}
