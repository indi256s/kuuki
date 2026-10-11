'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createReplaySchedule, monthAt, type TimelineItem } from './replay'

function createClock(schedule: ReturnType<typeof createReplaySchedule>) {
  let elapsed = 0,
    seeking = false
  return {
    advance(delta: number) {
      if (seeking) return null
      elapsed += delta
      const frame = schedule.advance(elapsed, true)
      elapsed = frame.absoluteMs
      return frame
    },
    seek(time: number, phase: 'preview' | 'commit' | 'cancel') {
      seeking = phase === 'preview'
      elapsed = time
      schedule.seek(time)
      return schedule.advance(time)
    },
  }
}

function createFrames(
  schedule: ReturnType<typeof createReplaySchedule>,
  timeline: TimelineItem[],
  durationMs: number,
) {
  let current = schedule.advance(0)
  let rendered = current
  const listeners = new Set<() => void>()
  return {
    initial: current,
    getFrame: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    publish(frame: typeof current, force = false) {
      current = frame
      for (const listener of listeners) listener()
      if (
        !force &&
        rendered.arcs === frame.arcs &&
        rendered.planes.length === frame.planes.length &&
        rendered.planes.every((plane, index) => plane.key === frame.planes[index].key) &&
        monthAt(timeline, rendered.timeMs, durationMs) ===
          monthAt(timeline, frame.timeMs, durationMs)
      )
        return false
      rendered = frame
      return true
    },
  }
}

export function useReplay(
  timeline: TimelineItem[],
  durationMs: number,
  paused: boolean,
  reduced: boolean,
  fullscreen: boolean,
  host: RefObject<HTMLElement | null>,
  isCurrent: () => boolean,
) {
  const schedule = useMemo(() => createReplaySchedule(timeline, durationMs), [timeline, durationMs])
  const clock = useMemo(() => createClock(schedule), [schedule])
  const frames = useMemo(
    () => createFrames(schedule, timeline, durationMs),
    [schedule, timeline, durationMs],
  )
  const admitted = useRef(isCurrent)
  useEffect(() => {
    admitted.current = isCurrent
  }, [isCurrent])
  const [state, setState] = useState({ frames, frame: frames.initial })
  const [visible, setVisible] = useState(true)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const change = () => setHidden(document.visibilityState === 'hidden')
    change()
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])
  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) =>
      setVisible(entries.some((entry) => entry.isIntersecting)),
    )
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [host])
  useEffect(() => {
    if (paused || reduced || hidden || (!visible && !fullscreen) || !timeline.length) return
    let raf = 0,
      previous: number | null = null,
      retired = false
    const tick = (time: number) => {
      if (retired || !admitted.current()) return
      const frame = clock.advance(previous === null ? 0 : time - previous)
      previous = time
      if (frame && frames.publish(frame)) setState({ frames, frame })
      raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      retired = true
      cancelAnimationFrame(raf)
    }
    window.addEventListener('kuuki:identity-reset', stop)
    raf = requestAnimationFrame(tick)
    return () => {
      stop()
      window.removeEventListener('kuuki:identity-reset', stop)
    }
  }, [frames, clock, paused, reduced, hidden, visible, fullscreen, timeline.length])
  const seek = useCallback(
    (time: number, phase: 'preview' | 'commit' | 'cancel') => {
      if (!admitted.current()) return
      const frame = clock.seek(time, phase)
      frames.publish(frame, true)
      setState({ frames, frame })
    },
    [frames, clock],
  )
  return {
    ...(state.frames === frames ? state.frame : frames.initial),
    seek,
    getFrame: frames.getFrame,
    subscribe: frames.subscribe,
  }
}
