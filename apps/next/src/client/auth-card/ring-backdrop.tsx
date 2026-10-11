'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import './ring-backdrop.css'

/** Ring spacing and count: enough rings to reach the corners of a 2560px screen. */
const STEP = 60
const RINGS = 26
/** The furthest the innermost ring drifts from the centre, in px; outer rings drift less, so the set reads as depth. */
const DRIFT = 14
/** Exponential follow time constant for the drift, in seconds. */
const FOLLOW = 0.35

/**
 * The auth page's backdrop: concentric hairline rings on a crosshair, centred on the screen like a radar scope (after
 * Arc's centered login). Decorative and hidden from assistive tech. With a fine pointer the rings drift toward it while
 * it moves, written as CSS variables with no re-render; they stay still on touch, under reduced motion and on phones,
 * where the card fills the screen.
 */
export function RingBackdrop() {
  const root = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const element = root.current
    if (!element) return
    const fine = matchMedia('(hover: hover) and (pointer: fine)')
    const still = matchMedia('(prefers-reduced-motion: reduce)')
    let targetX = 0
    let targetY = 0
    let x = 0
    let y = 0
    let last = 0
    let frame = 0
    const tick = (time: number) => {
      const dt = last ? Math.min(0.1, (time - last) / 1000) : 0
      last = time
      const k = 1 - Math.exp(-dt / FOLLOW)
      x += (targetX - x) * k
      y += (targetY - y) * k
      element.style.setProperty('--ring-x', x.toFixed(3))
      element.style.setProperty('--ring-y', y.toFixed(3))
      const resting = Math.abs(targetX - x) < 0.002 && Math.abs(targetY - y) < 0.002
      frame = resting ? 0 : requestAnimationFrame(tick)
    }
    const move = (event: PointerEvent) => {
      if (!fine.matches || still.matches || event.pointerType !== 'mouse') return
      targetX = (event.clientX / window.innerWidth) * 2 - 1
      targetY = (event.clientY / window.innerHeight) * 2 - 1
      if (!frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [])
  return (
    <svg ref={root} className="auth-rings" aria-hidden="true" focusable="false">
      <line x1="0" x2="100%" y1="50%" y2="50%" />
      <line x1="50%" x2="50%" y1="0" y2="100%" />
      {Array.from({ length: RINGS }, (_, index) => (
        <circle
          key={index}
          cx="50%"
          cy="50%"
          r={(index + 1) * STEP}
          style={
            { '--ring-depth': ((DRIFT * (RINGS - index)) / RINGS).toFixed(2) } as CSSProperties
          }
        />
      ))}
    </svg>
  )
}
