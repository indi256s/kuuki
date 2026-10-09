'use client'

import { useLayoutEffect, useState } from 'react'

/** Two-lane masonry on a plain grid: each card spans enough 4px rows to cover its height plus the 16px (--space-4) gap, and auto-placement drops it into the lane that frees up first. DOM order stays the saved order. */
export const LANE_UNIT = 4
export const LANE_GAP = 16
export const LANES_MIN_WIDTH = 1280
export const laneSpan = (height: number) => Math.max(1, Math.ceil((height + LANE_GAP) / LANE_UNIT))

/** Returns the callback ref for the root; `signature` changes when its cards do (ids and order). It sets --ov-span on each direct child and data-lanes on the root. A container query would put layout containment on the root and re-anchor the fixed-position menus inside the cards. */
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
