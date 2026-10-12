'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** The rest of the sequence in ms (iso/stamper.css): the band's roll is --dur-base, the press 100ms, the return --dur-fast. 450ms in all, plus the frame each of "set" and "plate" holds. */
const ROLL_MS = 200,
  PRESS_MS = 100,
  RETURN_MS = 150
/** The band draws two months either side of the centre, so a roll starts at most that far away. */
const REACH = 2

export type StampPhase = 'rest' | 'set' | 'roll' | 'plate' | 'press' | 'return'
type Stamp = { target: number; impression: number; from: number; phase: StampPhase }
const NEXT: Partial<Record<StampPhase, readonly [StampPhase, number]>> = {
  roll: ['plate', ROLL_MS],
  press: ['return', PRESS_MS],
  return: ['rest', RETURN_MS],
}

/** Signed steps from `to` back to `from` along the shorter way round, held to what the band can show. */
function away(from: number, to: number, size: number, wrap: boolean) {
  let steps = from - to
  if (wrap) steps = ((((steps + size / 2) % size) + size) % size) - size / 2
  return Math.max(-REACH, Math.min(REACH, steps))
}

/**
 * What the stamper draws while the reading changes. A pick runs set, roll, plate, press and return (stamper.css reads the
 * host's `data-stamp`); `impression` is the position whose lettering is printed, which only catches up with `target` at the plate.
 * `animate` is false for everything that is not a pick (first render, a swipe, a filter, reduced motion): everything lands at once.
 * A new pick restarts from "set" on the new target, so the band retargets and the head presses once, after the last pick; nothing queues.
 * The band is built around `target`; `from` offsets it so the position it was showing stays put at the start of the roll.
 */
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
  // The offset band and the unprinted impression are flushed as drawn, then released a frame later, so the transitions start from them.
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
