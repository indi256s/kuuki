import type { SectionId } from '@kuuki/shared/overview/prefs'

/** DESIGN.md Motion: siblings slide on-screen (--ease-in-out), the drop settles with --ease-out, an Escape return exits about 20% faster. */
export const FLIP_MS = 280
export const SETTLE_MS = 200
export const RETURN_MS = 180
export type LiveRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}
export type Flips = Map<HTMLElement, Animation>
export type Ghost = {
  layer: HTMLElement
  card: HTMLElement
  grabX: number
  grabY: number
  x: number
  y: number
  settle?: Animation
}

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const token = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
export const easeOut = () => token('--ease-out', 'cubic-bezier(.23,1,.32,1)')
const easeInOut = () => token('--ease-in-out', 'cubic-bezier(.77,0,.175,1)')

const translateOf = (el: HTMLElement) => {
  const match = /^matrix\(([^)]+)\)$/.exec(getComputedStyle(el).transform)
  const values = match ? match[1].split(',').map(Number) : []
  return { x: values[4] || 0, y: values[5] || 0 }
}
/** The box the element's layout gives it: getBoundingClientRect minus any in-flight FLIP translate, so drop targets do not jitter while cards slide. */
export function layoutRect(el: HTMLElement, flips: Flips): LiveRect {
  const r = el.getBoundingClientRect()
  const { x, y } = flips.has(el) ? translateOf(el) : { x: 0, y: 0 }
  return {
    left: r.left - x,
    right: r.right - x,
    top: r.top - y,
    bottom: r.bottom - y,
    width: r.width,
    height: r.height,
  }
}

/** Gives every card its slot with CSS `order` (the DOM never moves, so pointer capture and focus survive) and slides the cards from where they are on screen right now. Running slides are read live, cancelled, and restarted from that offset, so a quick second change never snaps. */
export function placeCards(entries: [HTMLElement, number][], flips: Flips, animate: boolean) {
  const first = animate ? new Map(entries.map(([el]) => [el, el.getBoundingClientRect()])) : null
  for (const animation of flips.values()) animation.cancel()
  flips.clear()
  for (const [el, index] of entries) el.style.order = String(index)
  if (!first || typeof entries[0]?.[0].animate !== 'function') return
  const easing = easeInOut()
  for (const [el] of entries) {
    const from = first.get(el)!,
      to = el.getBoundingClientRect()
    const dx = from.left - to.left,
      dy = from.top - to.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    const animation = el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: FLIP_MS, easing },
    )
    flips.set(el, animation)
    const done = () => {
      if (flips.get(el) === animation) flips.delete(el)
    }
    animation.onfinish = done
    animation.oncancel = done
  }
}
export function clearCards(ids: SectionId[], nodes: Map<SectionId, HTMLElement>, flips: Flips) {
  for (const animation of flips.values()) animation.cancel()
  flips.clear()
  for (const id of ids) nodes.get(id)?.style.removeProperty('order')
}

/** A visual-only copy of the card in a fixed layer. The layer carries the 1:1 pointer translate (no transition); the copy carries the lift. The original stays in the grid as the placeholder slot, so lane spans, ResizeObserver and open tooltips keep working. */
export function createGhost(
  node: HTMLElement,
  rect: LiveRect,
  pointerX: number,
  pointerY: number,
): Ghost {
  const layer = document.createElement('div')
  layer.className = 'ov3-ghost'
  layer.setAttribute('data-ov-ghost', '')
  layer.setAttribute('aria-hidden', 'true')
  layer.setAttribute('inert', '')
  const card = node.cloneNode(true) as HTMLElement
  for (const el of [card, ...card.querySelectorAll<HTMLElement>('*')]) {
    el.removeAttribute('id')
    el.removeAttribute('aria-labelledby')
    el.removeAttribute('aria-controls')
    el.removeAttribute('tabindex')
    for (const name of [
      'data-section',
      'data-section-options',
      'data-section-tile',
      'data-dragging',
    ])
      el.removeAttribute(name)
  }
  card.classList.add('ov3-ghost-card')
  const grabX = pointerX - rect.left,
    grabY = pointerY - rect.top
  layer.style.width = `${rect.width}px`
  layer.style.height = `${rect.height}px`
  layer.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`
  card.style.transformOrigin = `${grabX}px ${grabY}px`
  layer.appendChild(card)
  node.parentElement!.appendChild(layer)
  void card.offsetWidth
  card.setAttribute('data-lifted', '')
  return { layer, card, grabX, grabY, x: rect.left, y: rect.top }
}
export function moveGhost(ghost: Ghost, pointerX: number, pointerY: number) {
  const x = pointerX - ghost.grabX,
    y = pointerY - ghost.grabY
  if (ghost.x === x && ghost.y === y) return
  ghost.x = x
  ghost.y = y
  ghost.layer.style.transform = `translate3d(${ghost.x}px, ${ghost.y}px, 0)`
}
/** Glides the ghost from its current spot into the slot, then calls done. Instant under reduced motion or without WAAPI. */
export function settleGhost(
  ghost: Ghost,
  to: { left: number; top: number },
  duration: number,
  done: () => void,
) {
  ghost.card.removeAttribute('data-lifted')
  if (reducedMotion() || typeof ghost.layer.animate !== 'function') {
    done()
    return
  }
  const animation = ghost.layer.animate(
    [
      { transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)` },
      { transform: `translate3d(${to.left}px, ${to.top}px, 0)` },
    ],
    { duration, easing: easeOut(), fill: 'forwards' },
  )
  ghost.settle = animation
  animation.onfinish = done
  animation.oncancel = done
}
