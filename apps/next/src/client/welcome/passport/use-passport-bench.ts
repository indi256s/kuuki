import { useEffect, useRef, useState, type RefObject } from 'react'
import type { BenchController, BenchInput } from './bench-live'

/**
 * Mounts the passport bench in `stage` once it is `active` and its module has loaded (after hydration, so it never
 * holds up the step), and hands it every later `input`. Beside the card it is always active; on a phone the caller
 * activates it while a batch is read and on the reveal, and it stays mounted after that. The bench redraws itself
 * frame by frame; React only passes the facts down.
 * `initial` is what the first render showed: a reload or resume starts from it with nothing replayed, and anything
 * that arrived since is pressed. Returns whether the drawing is in place.
 */
export function usePassportBench(
  stage: RefObject<HTMLDivElement | null>,
  active: boolean,
  input: BenchInput,
  initial: Pick<BenchInput, 'open' | 'ready' | 'countries'>,
): boolean {
  const [ready, setReady] = useState(false)
  const controller = useRef<BenchController | null>(null)
  const latest = useRef(input)

  useEffect(() => {
    latest.current = input
    controller.current?.update(input)
  })

  useEffect(() => {
    if (!active || controller.current) return
    let alive = true
    void import('./bench-live').then(({ mountBench }) => {
      if (!alive || !stage.current) return
      controller.current = mountBench(stage.current, { ...latest.current, ...initial })
      controller.current.update(latest.current)
      setReady(true)
    })
    return () => {
      alive = false
    }
    // `initial` is the first render's, and the stage is mounted once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(
    () => () => {
      controller.current?.destroy()
      controller.current = null
    },
    [],
  )

  return ready
}
