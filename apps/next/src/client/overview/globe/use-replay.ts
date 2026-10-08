'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createReplaySchedule, type TimelineItem } from './replay'

function createClock(schedule: ReturnType<typeof createReplaySchedule>) {
  let elapsed = 0, seeking = false
  return {
    advance(delta: number) {
      if (seeking) return null
      elapsed += delta
      return schedule.advance(elapsed)
    },
    seek(time: number, phase: 'preview' | 'commit' | 'cancel') {
      seeking = phase === 'preview'; elapsed = time
      schedule.seek(time)
      return schedule.advance(time)
    },
  }
}

export function useReplay(timeline: TimelineItem[], durationMs: number, paused: boolean, reduced: boolean,
  fullscreen: boolean, host: RefObject<HTMLElement | null>, isCurrent: () => boolean) {
  const schedule = useMemo(() => createReplaySchedule(timeline, durationMs), [timeline, durationMs])
  const clock = useMemo(() => createClock(schedule), [schedule])
  const initialFrame = useMemo(() => schedule.advance(0), [schedule])
  const admitted = useRef(isCurrent)
  useEffect(() => { admitted.current = isCurrent }, [isCurrent])
  const [state, setState] = useState({ schedule, frame: initialFrame })
  const [visible, setVisible] = useState(true)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const change = () => setHidden(document.visibilityState === 'hidden')
    change(); document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])
  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)))
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [host])
  useEffect(() => {
    if (paused || reduced || hidden || (!visible && !fullscreen) || !timeline.length) return
    let raf = 0, previous: number | null = null, retired = false
    const tick = (time: number) => {
      if (retired || !admitted.current()) return
      const frame = clock.advance(previous === null ? 0 : time - previous)
      previous = time
      if (frame) setState({ schedule, frame })
      raf = requestAnimationFrame(tick)
    }
    const stop = () => { retired = true; cancelAnimationFrame(raf) }
    window.addEventListener('kuuki:identity-reset', stop)
    raf = requestAnimationFrame(tick)
    return () => { stop(); window.removeEventListener('kuuki:identity-reset', stop) }
  }, [schedule, clock, paused, reduced, hidden, visible, fullscreen, timeline.length])
  const seek = useCallback((time: number, phase: 'preview' | 'commit' | 'cancel') => {
    if (!admitted.current()) return
    setState({ schedule, frame: clock.seek(time, phase) })
  }, [schedule, clock])
  return { ...(state.schedule === schedule ? state.frame : initialFrame), seek }
}
