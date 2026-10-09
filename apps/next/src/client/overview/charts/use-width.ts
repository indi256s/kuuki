'use client'

import { useLayoutEffect, useState } from 'react'

/** Width used on the server and before the first measurement, so SSR and tests still render a full chart. */
export const FALLBACK_WIDTH = 600

/** Callback ref for the element to measure plus its rendered width in whole CSS pixels. Sub-pixel changes and hidden (0px) states are ignored so a chart never re-renders in a loop. */
export function useMeasuredWidth<E extends HTMLElement>() {
  const [node, setNode] = useState<E | null>(null),
    [width, setWidth] = useState(FALLBACK_WIDTH)
  useLayoutEffect(() => {
    if (!node) return
    const read = (value: number) => {
      const next = Math.round(value)
      if (next > 0) setWidth((current) => (current === next ? current : next))
    }
    read(node.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) =>
      read(entries[entries.length - 1].contentRect.width),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, width] as const
}
