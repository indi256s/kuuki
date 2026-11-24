import { useEffect, useRef, useState, type RefObject } from 'react'
import type { BenchController, BenchInput } from './bench-live'

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
