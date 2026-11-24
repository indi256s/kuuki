'use client'

import { useLayoutEffect, useState } from 'react'

export const FALLBACK_WIDTH = 600

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
