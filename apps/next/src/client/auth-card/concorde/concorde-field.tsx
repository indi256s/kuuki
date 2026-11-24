'use client'

import { useEffect, useRef, useState } from 'react'
import './concorde.generated.css'
import './concorde.css'

type Figure = (typeof import('./concorde.generated'))['CONCORDE']
type Runtime = (typeof import('./turn.generated.js'))['TURN']
type Mount = (typeof import('./reheat'))['mountReheat']

const SPEED = 12
const EASE = 0.7
const SLOW = 14
const FAST = 9
const SPIN = 240

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
    let spin = 0
    let launching = false
    let last = 0
    let frame = 0
    let onScreen = false
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
      spin += ((launching ? SPIN : 0) - spin) * (1 - Math.exp(-dt / (launching ? 0.08 : 0.25)))
      angle = (angle + (speed + spin) * dt) % 360
      if (still.matches) {
        flame?.reset()
        launching = false
        spin = 0
      }
      if (launching && flame?.showing()) {
        launching = false
        flame.launch()
      }
      const burning =
        flame && !still.matches ? flame.step(dt, target > 0 && speed > SPEED / 2) : false
      const settled = target === 0 && speed < 0.05 && !launching && spin < 0.05 && !burning
      if (half && !settled) {
        drawNext = !drawNext
        if (drawNext) {
          next = (angle + (speed + spin) * dt) % 360
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
        speed = spin = 0
        launching = false
        drawNext = false
        flame?.reset()
      }
    }
    const sync = () => {
      if (frame || !wanted()) return
      last = 0
      frame = requestAnimationFrame(tick)
    }
    const launch = () => {
      if (!flame || still.matches) return
      if (flame.showing()) flame.launch()
      else launching = true
      if (frame) return
      last = 0
      frame = requestAnimationFrame(tick)
    }
    element.addEventListener('click', launch)
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1]!.isIntersecting
      sync()
    })
    observer.observe(element)
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
      element.removeEventListener('click', launch)
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
            dangerouslySetInnerHTML={{ __html: figure.art.html }}
          />
        ) : null}
      </div>
    </>
  )
}
