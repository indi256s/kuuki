import { useEffect, useRef, useState, type RefObject } from 'react'
import type { BenchController, BenchInput } from './bench-live'

/** The bench only shows beside the card; on a phone the strip stands in for it and the drawing never loads. */
const DESK = '(min-width: 701px)'

/**
 * Mounts the passport bench in `stage` once its module has loaded (after hydration, so it never holds up the step) and
 * hands it every later `input`. The bench redraws itself frame by frame; React only passes the facts down.
 * `initial` is what the first render showed: a reload or resume starts from it with nothing replayed, and anything
 * that arrived since is pressed. Returns whether the drawing is in place.
 */
export function usePassportBench(
  stage: RefObject<HTMLDivElement | null>,
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
    const desk = matchMedia(DESK)
    let alive = true
    let loading = false
    const load = () => {
      if (loading || !desk.matches) return
      loading = true
      void import('./bench-live').then(({ mountBench }) => {
        if (!alive || !stage.current) return
        controller.current = mountBench(stage.current, { ...latest.current, ...initial })
        controller.current.update(latest.current)
        setReady(true)
      })
    }
    load()
    desk.addEventListener('change', load)
    return () => {
      alive = false
      desk.removeEventListener('change', load)
      controller.current?.destroy()
      controller.current = null
    }
    // `initial` is the first render's, and the stage is mounted once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ready
}
