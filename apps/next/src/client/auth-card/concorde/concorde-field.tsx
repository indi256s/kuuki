'use client'

import { useEffect, useRef, useState } from 'react'
import './concorde.generated.css'
import './concorde.css'

type Figure = (typeof import('./concorde.generated'))['CONCORDE']
type Runtime = (typeof import('./turn.generated.js'))['TURN']
type Mount = (typeof import('./reheat'))['mountReheat']

/** Degrees per second at full speed: one turn every 30 s. */
const SPEED = 12
/** How quickly the turn speeds up after a pause and slows to a stop for one, in seconds (exponential follow). */
const EASE = 0.7
/**
 * Adaptive half rate (the anatomy kit's lever 5): when a drawn frame costs more than SLOW ms of main thread (the
 * runtime's writes plus the style, layout and paint they cause), draw every other frame; below FAST, every frame again.
 * The angle stays time-based, so the speed never changes; at 30 fps a step moves the wingtip about 1.3px.
 */
const SLOW = 14
const FAST = 9

/**
 * The brand panel's decoration: the くうき watermark with a 1:200 Concorde display model turning slowly on its stand
 * (an anatomy-kit iso figure in its 3D mode, built by `scripts/generate-concorde.mjs`).
 *
 * The figure and its runtime load after hydration so they never hold up the form, then fade in at their rest pose,
 * which is the frame the generator drew. The turn eases to a stop while the field is off screen, the page is hidden or
 * focus is inside the form (auth-card.tsx sets `data-form-focus` on the card), or the user pauses it. It eases back in
 * after the gates clear. Under reduced motion the model stands still at its rest pose.
 *
 * As the model first reaches speed, then once a lap, reheat lights for a few seconds (reheat.ts): a WebGL flame over
 * the live layer. It spools down with the turn and goes out at once off screen, under reduced motion or when the GPU
 * drops its context; without WebGL the nozzles keep their glow.
 */
export function ConcordeField() {
  const stage = useRef<HTMLDivElement>(null)
  const [figure, setFigure] = useState<{ art: Figure; turn: Runtime; reheat: Mount } | null>(null)

  useEffect(() => {
    let alive = true
    void Promise.all([
      import('./concorde.generated'),
      import('./turn.generated.js'),
      import('./reheat'),
    ]).then(([{ CONCORDE }, { TURN }, { mountReheat }]) => {
      if (alive) setFigure({ art: CONCORDE, turn: TURN, reheat: mountReheat })
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const element = stage.current
    if (!figure || !element) return
    const card = element.closest<HTMLElement>('.auth-card')
    const still = matchMedia('(prefers-reduced-motion: reduce)')
    const controller = figure.turn.mount(element, figure.art.data)
    const flame = figure.reheat(element, controller, figure.art.reheat)
    let angle = 0
    let speed = 0
    let last = 0
    let frame = 0
    let onScreen = false
    // A message posted from a tick runs once the browser has finished that frame. It times the frame's rendering and,
    // at half rate, carries the next drawn frame's writes into the idle frame before it, so neither frame overruns: the
    // writes are about half of a drawn frame's cost, and the style, layout and paint they cause are the other half.
    let cost = 0
    let scriptMs = 0
    let renderedAt = 0
    let half = false
    let drawNext = false
    let next = 0
    const write = (at: number) => {
      const start = performance.now()
      controller.set({ model: at })
      controller.events()
      flame?.paint()
      scriptMs = performance.now() - start
    }
    const after = new MessageChannel()
    after.port1.onmessage = ({ data }: MessageEvent<'write' | 'measure'>) => {
      if (data === 'write') {
        write(next)
        return
      }
      const ms = scriptMs + performance.now() - renderedAt
      cost = cost ? cost + (ms - cost) * 0.1 : ms
      if (cost > SLOW) half = true
      else if (cost < FAST) half = false
    }
    const wanted = () =>
      onScreen &&
      !document.hidden &&
      !still.matches &&
      !card?.hasAttribute('data-form-focus') &&
      !card?.hasAttribute('data-motion-paused')
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      const target = wanted() ? SPEED : 0
      speed += (target - speed) * (1 - Math.exp(-dt / (EASE / 3)))
      angle = (angle + speed * dt) % 360
      // Reduced motion puts the flame out at once; otherwise it spools down with the turn.
      if (still.matches) flame?.reset()
      const burning =
        flame && !still.matches ? flame.step(dt, target > 0 && speed > SPEED / 2) : false
      // Off screen or hidden, stop at once; otherwise run until the ease-out and the reheat have settled.
      const settled = target === 0 && speed < 0.05 && !burning
      if (half && !settled) {
        // Alternate frames: write the next frame's pose (one frame ahead) after this one, then show it.
        drawNext = !drawNext
        if (drawNext) {
          next = (angle + speed * dt) % 360
          after.port2.postMessage('write')
        } else {
          renderedAt = performance.now()
          after.port2.postMessage('measure')
        }
      } else {
        drawNext = false
        renderedAt = performance.now()
        write(angle)
        scriptMs = 0
        after.port2.postMessage('measure')
      }
      frame = settled || !onScreen || document.hidden ? 0 : requestAnimationFrame(tick)
      if (!frame) {
        speed = 0
        flame?.reset()
      }
    }
    const sync = () => {
      if (frame || !wanted()) return
      last = 0
      frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1]!.isIntersecting
      sync()
    })
    observer.observe(element)
    // Resume after temporary gates clear only if the user's persistent pause is off.
    const focus = new MutationObserver(sync)
    if (card)
      focus.observe(card, {
        attributes: true,
        attributeFilter: ['data-form-focus', 'data-motion-paused'],
      })
    document.addEventListener('visibilitychange', sync)
    still.addEventListener('change', sync)
    return () => {
      cancelAnimationFrame(frame)
      after.port1.close()
      observer.disconnect()
      focus.disconnect()
      document.removeEventListener('visibilitychange', sync)
      still.removeEventListener('change', sync)
      flame?.destroy()
      controller.destroy()
    }
  }, [figure])

  return (
    <>
      <div className="auth-watermark">
        <span>く</span>
        <span>う</span>
        <span>き</span>
      </div>
      <div className="auth-concorde" data-ready={figure ? 'true' : undefined}>
        {figure ? (
          <div
            ref={stage}
            className="iso-stage iso-turn"
            // The generator's own markup: the static stand, the live model layer at its rest pose, the front layer.
            dangerouslySetInnerHTML={{ __html: figure.art.html }}
          />
        ) : null}
      </div>
    </>
  )
}
