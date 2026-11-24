'use client'

import { useEffect, useRef } from 'react'
import './ring-backdrop.css'

const STEP = 60
const RINGS = 26
const DRIFT = 14
const FOLLOW = 0.35

export function RingBackdrop() {
  const root = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const element = root.current
    if (!element) return
    const fine = matchMedia('(hover: hover) and (pointer: fine)')
    const still = matchMedia('(prefers-reduced-motion: reduce)')
    const circles = [...element.querySelectorAll('circle')].map((circle, index) => ({
      circle,
      depth: (DRIFT * (RINGS - index)) / RINGS,
    }))
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
      for (const { circle, depth } of circles) {
        circle.style.transform = `translate(${(x * depth).toFixed(3)}px, ${(y * depth).toFixed(3)}px)`
      }
      const resting = Math.abs(targetX - x) < 0.002 && Math.abs(targetY - y) < 0.002
      frame = resting ? 0 : requestAnimationFrame(tick)
    }
    const move = (event: PointerEvent) => {
      if (document.hidden || !fine.matches || still.matches || event.pointerType !== 'mouse') return
      targetX = (event.clientX / window.innerWidth) * 2 - 1
      targetY = (event.clientY / window.innerHeight) * 2 - 1
      if (!frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }
    const sync = () => {
      if (document.hidden || still.matches || !fine.matches) stop()
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('visibilitychange', sync)
    still.addEventListener('change', sync)
    fine.addEventListener('change', sync)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('visibilitychange', sync)
      still.removeEventListener('change', sync)
      fine.removeEventListener('change', sync)
      stop()
    }
  }, [])
  return (
    <svg ref={root} className="auth-rings" aria-hidden="true" focusable="false">
      <line x1="0" x2="100%" y1="50%" y2="50%" />
      <line x1="50%" x2="50%" y1="0" y2="100%" />
      {Array.from({ length: RINGS }, (_, index) => (
        <circle key={index} cx="50%" cy="50%" r={(index + 1) * STEP} />
      ))}
    </svg>
  )
}
