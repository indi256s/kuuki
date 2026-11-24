'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const ROLL_MS = 200,
  PRESS_MS = 100,
  RETURN_MS = 150
const REACH = 2

export type StampPhase = 'rest' | 'set' | 'roll' | 'plate' | 'press' | 'return'
type Stamp = { target: number; impression: number; from: number; phase: StampPhase }
const NEXT: Partial<Record<StampPhase, readonly [StampPhase, number]>> = {
  roll: ['plate', ROLL_MS],
  press: ['return', PRESS_MS],
  return: ['rest', RETURN_MS],
}

function away(from: number, to: number, size: number, wrap: boolean) {
  let steps = from - to
  if (wrap) steps = ((((steps + size / 2) % size) + size) % size) - size / 2
  return Math.max(-REACH, Math.min(REACH, steps))
}

export function useStamp(target: number, animate: boolean, size: number, wrap: boolean) {
  const [stamp, setStamp] = useState<Stamp>({ target, impression: target, from: 0, phase: 'rest' })
  const host = useRef<HTMLDivElement>(null)
  if (stamp.target !== target || (!animate && stamp.phase !== 'rest')) {
    setStamp(
      animate
        ? {
            target,
            impression: stamp.impression,
            from: away(stamp.target, target, size, wrap),
            phase: 'set',
          }
        : { target, impression: target, from: 0, phase: 'rest' },
    )
  }
  const { phase } = stamp
  useLayoutEffect(() => {
    if (phase !== 'set' && phase !== 'plate') return
    void host.current?.getBoundingClientRect()
    const frame = requestAnimationFrame(() =>
      setStamp((old) =>
        old.phase === phase ? { ...old, phase: phase === 'set' ? 'roll' : 'press' } : old,
      ),
    )
    return () => cancelAnimationFrame(frame)
  }, [phase])
  useEffect(() => {
    const step = NEXT[phase]
    if (!step) return
    const timer = setTimeout(
      () =>
        setStamp((old) => ({
          ...old,
          phase: step[0],
          impression: step[0] === 'plate' ? old.target : old.impression,
          from: step[0] === 'rest' ? 0 : old.from,
        })),
      step[1],
    )
    return () => clearTimeout(timer)
  }, [phase])
  return { phase, from: stamp.from, impression: stamp.impression, host }
}
