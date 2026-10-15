'use client'

import { useEffect, useRef } from 'react'
import { poseOf, windAt } from './windsock-geom'
import { WINDSOCK } from './windsock.generated'
import './windsock.generated.css'
import './windsock.css'

const MARKUP = { __html: WINDSOCK.svg }
/** The loading screen fades in after this delay (shell.css); the wind starts building when it shows. */
const REVEAL_MS = 250

/** The route loading figure: a windsock that fills band by band as the wind builds, then rides the gusts. */
export function Windsock() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const svg = element?.querySelector('svg')
    const stack = svg?.querySelector<SVGGElement>('.ws-bands')
    if (!element || !svg || !stack) return
    const one = <T extends Element>(selector: string) => svg.querySelector<T>(selector)!
    const bands = [...svg.querySelectorAll<SVGGElement>('.ws-band')].map((group) => ({
      band: Number(group.dataset.band),
      group,
      cloth: group.querySelector('.ws-cloth')!,
      light: group.querySelector('.ws-light')!,
      seam: group.querySelector('.ws-seam')!,
    }))
    const byBand = new Map(bands.map((entry) => [entry.band, entry]))
    const glows = new Map(
      [...svg.querySelectorAll<SVGPathElement>('.ws-glow path')].map((path) => [
        Number(path.dataset.band),
        path,
      ]),
    )
    const gradients = new Map(
      [...svg.querySelectorAll<SVGLinearGradientElement>('linearGradient')].map((g) => [
        Number(g.id.split('-').at(-1)),
        g,
      ]),
    )
    const arms = [one<SVGPathElement>('[data-arm="0"]'), one<SVGPathElement>('[data-arm="1"]')]
    const hoop = one<SVGPathElement>('.ws-hoop')
    const still = matchMedia('(prefers-reduced-motion: reduce)')
    let order = bands.map(({ band }) => band).join()

    const draw = (seconds: number) => {
      const pose = poseOf(windAt(seconds, still.matches), WINDSOCK.projection)
      for (const b of pose.bands) {
        const entry = byBand.get(b.band)!
        entry.cloth.setAttribute('d', b.d)
        entry.light.setAttribute('d', b.d)
        entry.seam.setAttribute('d', b.seam)
        glows.get(b.band)?.setAttribute('d', b.d)
        const gradient = gradients.get(b.band)
        if (gradient) {
          const [x1, y1, x2, y2] = b.light
          gradient.setAttribute('x1', x1.toFixed(1))
          gradient.setAttribute('y1', y1.toFixed(1))
          gradient.setAttribute('x2', x2.toFixed(1))
          gradient.setAttribute('y2', y2.toFixed(1))
        }
      }
      // Paint order follows depth; only touch the DOM when it changes.
      const next = pose.bands.map(({ band }) => band).join()
      if (next !== order) {
        for (const b of pose.bands) stack.appendChild(byBand.get(b.band)!.group)
        order = next
      }
      arms[0]!.setAttribute('d', pose.arms[0])
      arms[1]!.setAttribute('d', pose.arms[1])
      hoop.setAttribute('d', pose.hoop)
    }

    let frame = 0
    let revealed = false
    let visible = false
    let drawnStill = false
    const start = performance.now() + REVEAL_MS
    const tick = (now: number) => {
      draw(Math.max(0, now - start) / 1000)
      frame = requestAnimationFrame(tick)
    }
    const run = () => {
      cancelAnimationFrame(frame)
      frame = 0
      if (!still.matches) drawnStill = false
      if (!revealed || !visible || document.hidden) return
      if (still.matches) {
        if (!drawnStill) draw(0)
        drawnStill = true
      } else frame = requestAnimationFrame(tick)
    }
    const reveal = window.setTimeout(() => {
      revealed = true
      run()
    }, REVEAL_MS)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', run)
    still.addEventListener('change', run)
    return () => {
      window.clearTimeout(reveal)
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', run)
      still.removeEventListener('change', run)
    }
  }, [])

  return <div ref={ref} className="windsock" aria-hidden dangerouslySetInnerHTML={MARKUP} />
}
