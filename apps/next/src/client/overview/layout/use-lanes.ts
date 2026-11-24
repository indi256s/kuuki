'use client'

import { useLayoutEffect, useState } from 'react'
import { READING_COLUMN } from './figure-box'

export const LANE_UNIT = 4
export const LANE_GAP = 16
export const LANES_MIN_WIDTH = 2 * (READING_COLUMN + 50) + LANE_GAP
export const laneSpan = (height: number) => Math.max(1, Math.ceil((height + LANE_GAP) / LANE_UNIT))

export function useLanes(signature: string) {
  const [root, setRoot] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!root) return
    const cards = ([...root.children] as HTMLElement[]).filter(
      (card) => !card.hasAttribute('data-ov-ghost'),
    )
    const span = (card: HTMLElement, height: number) =>
      card.style.setProperty('--ov-span', String(laneSpan(height)))
    const lanes = (width: number) =>
      root.setAttribute('data-lanes', width >= LANES_MIN_WIDTH ? '2' : '1')
    lanes(root.clientWidth)
    for (const card of cards) span(card, card.offsetHeight)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const { target, borderBoxSize } of entries) {
        if (target === root) lanes(root.clientWidth)
        else
          span(
            target as HTMLElement,
            borderBoxSize?.[0]?.blockSize ?? (target as HTMLElement).offsetHeight,
          )
      }
    })
    observer.observe(root)
    for (const card of cards) observer.observe(card)
    return () => observer.disconnect()
  }, [root, signature])
  return setRoot
}
