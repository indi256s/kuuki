'use client'

// The holder data page's three decorative interactions (spec .scratch/achievements-redesign/passport-code-spec.md):
// tilt (OVI sheen, perforation glint, ghost parallax), UV inspection and the MRZ read on reveal. None carries meaning.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { ChipMark } from './data-page-art'
import { Tooltip } from '../ui/tooltip'
import type { Locale } from '../../lib/format'

const MAX_TILT = 3
/** Critically damped time constant: no overshoot past the cap, back to flat in about 400ms after leave. */
const TILT_T = 0.07
const STILL = '(prefers-reduced-motion: reduce)'
const FINE = '(hover: hover) and (pointer: fine)'
const MOBILE = '(max-width: 700px)'

const UvContext = createContext<{ uv: boolean; setUv: (on: boolean) => void }>({
  uv: false,
  setUv: () => {},
})

type Axis = { x: number; v: number; target: number }

/** One critically damped step in four sub-steps; true while still moving. */
function settle(axis: Axis, dt: number) {
  const w = 1 / TILT_T
  const h = dt / 4
  for (let i = 0; i < 4; i++) {
    axis.v += (w * w * (axis.target - axis.x) - 2 * w * axis.v) * h
    axis.x += axis.v * h
  }
  if (Math.abs(axis.target - axis.x) < 1e-3 && Math.abs(axis.v) < 1e-3) {
    axis.x = axis.target
    axis.v = 0
    return false
  }
  return true
}

const query = (media: string) =>
  typeof window.matchMedia === 'function' && window.matchMedia(media).matches

/** The laminated page: writes --tilt-x / --tilt-y from one rAF loop and carries the UV state. */
export function DataPage({ children }: { children: ReactNode }) {
  const page = useRef<HTMLDivElement>(null)
  const tilt = useRef({
    x: { x: 0, v: 0, target: 0 } as Axis,
    y: { x: 0, v: 0, target: 0 } as Axis,
    frame: 0,
    last: 0,
  })
  const [uv, setUv] = useState(false)

  const write = () => {
    const node = page.current
    if (!node) return
    node.style.setProperty('--tilt-x', tilt.current.x.x.toFixed(3))
    node.style.setProperty('--tilt-y', tilt.current.y.x.toFixed(3))
  }
  const tick = (now: number) => {
    const state = tilt.current
    const dt = state.last ? Math.min((now - state.last) / 1000, 1 / 30) : 1 / 60
    state.last = now
    const movingX = settle(state.x, dt)
    const movingY = settle(state.y, dt)
    const moving = movingX || movingY
    write()
    state.frame = moving ? requestAnimationFrame(tick) : 0
  }
  const run = () => {
    const state = tilt.current
    if (state.frame) return
    state.last = 0
    state.frame = requestAnimationFrame(tick)
  }
  useEffect(() => {
    const state = tilt.current
    const node = page.current
    const still = typeof window.matchMedia === 'function' ? window.matchMedia(STILL) : null
    // Reduced motion switched on mid-tilt: lie flat at once.
    const onChange = () => {
      if (!still?.matches) return
      cancelAnimationFrame(state.frame)
      state.frame = 0
      for (const axis of [state.x, state.y]) Object.assign(axis, { x: 0, v: 0, target: 0 })
      node?.style.removeProperty('--tilt-x')
      node?.style.removeProperty('--tilt-y')
    }
    still?.addEventListener('change', onChange)
    return () => {
      still?.removeEventListener('change', onChange)
      cancelAnimationFrame(state.frame)
    }
  }, [])

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || !query(FINE) || query(STILL) || query(MOBILE)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nx = Math.min(1, Math.max(-1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
    const ny = Math.min(1, Math.max(-1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
    // The edge under the pointer comes toward the viewer: --tilt-y > 0 lifts the right edge, --tilt-x > 0 the top.
    tilt.current.y.target = nx * MAX_TILT
    tilt.current.x.target = -ny * MAX_TILT
    run()
  }
  const onPointerLeave = () => {
    const state = tilt.current
    if (state.x.target === 0 && state.y.target === 0 && !state.frame) return
    state.x.target = 0
    state.y.target = 0
    run()
  }

  return (
    <UvContext.Provider value={{ uv, setUv }}>
      <div
        ref={page}
        className="profile-data-page"
        data-uv={uv || undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </div>
    </UvContext.Provider>
  )
}

/** The chip mark in the page header, as a real toggle for the UV print. */
export function UvToggle({ locale }: { locale: Locale }) {
  const { uv, setUv } = useContext(UvContext)
  const label = locale === 'ru' ? 'Показать УФ-защиту' : 'Show UV security print'
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && uv) setUv(false)
  }
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        className="profile-uv-toggle"
        aria-label={label}
        aria-pressed={uv}
        onClick={() => setUv(!uv)}
        onKeyDown={onKeyDown}
      >
        <ChipMark />
      </button>
    </Tooltip>
  )
}

export const MRZ_READ_KEY = 'kuuki:profile-mrz-read'
const OCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
const SCAN_MS = 450
/** Unread characters re-roll this often, not every frame. */
const ROLL_MS = 60

function sessionFlag(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return window.sessionStorage
  } catch {
    return { getItem: () => '1', setItem: () => {} }
  }
}

const roll = (text: string, from: number) =>
  text.slice(0, from) +
  Array.from(text.slice(from), (char) =>
    char === ' ' ? char : OCR[Math.floor(Math.random() * OCR.length)],
  ).join('')

/** The MRZ band. The first time it scrolls into view in a session, a scan line reads it once, left to right. */
export function DataPageMrz({ lines, page }: { lines: [string, string]; page: string }) {
  const [first, second] = lines
  const band = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const node = band.current
    if (!node || typeof IntersectionObserver === 'undefined' || query(STILL)) return
    const flag = sessionFlag()
    if (flag.getItem(MRZ_READ_KEY)) return
    const text = [first, second]
    let frame = 0
    const restore = () => {
      rows.current.forEach((row, i) => {
        if (row) row.textContent = text[i]
      })
      delete node.dataset.reading
    }
    const read = () => {
      flag.setItem(MRZ_READ_KEY, '1')
      const bandBox = node.getBoundingClientRect()
      // Where each row's text starts and how wide one character is, so a character resolves as the line crosses it.
      const geometry = rows.current.map((row, i) => {
        const box = row?.getBoundingClientRect()
        return box
          ? { left: box.left - bandBox.left, char: box.width / Math.max(1, text[i].length) }
          : { left: 0, char: 0 }
      })
      node.dataset.reading = ''
      let start = 0
      let rolled = -ROLL_MS
      const step = (now: number) => {
        if (!start) start = now
        const elapsed = now - start
        const scanX = (Math.min(elapsed, SCAN_MS) / SCAN_MS) * bandBox.width
        if (elapsed - rolled >= ROLL_MS || elapsed >= SCAN_MS) {
          rolled = elapsed
          rows.current.forEach((row, i) => {
            if (!row) return
            const { left, char } = geometry[i]
            const done = char ? Math.max(0, Math.floor((scanX - left) / char)) : text[i].length
            row.textContent = done >= text[i].length ? text[i] : roll(text[i], done)
          })
        }
        if (elapsed >= SCAN_MS) {
          frame = 0
          restore()
          return
        }
        frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[entries.length - 1]?.isIntersecting) return
        observer.disconnect()
        read()
      },
      { threshold: 0.6 },
    )
    observer.observe(node)
    // No text restore here: new lines remount their rows (keyed by text), and writing this run's text would overwrite them.
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      delete node.dataset.reading
    }
  }, [first, second])

  return (
    <div className="profile-mrz-wrap" aria-hidden="true">
      <div ref={band} className="profile-mrz">
        {/* Keyed by text: the scan writes textContent, which detaches React's text node, so a changed line needs a fresh row. */}
        {lines.map((line, i) => (
          <span
            key={`${i}:${line}`}
            ref={(row) => {
              rows.current[i] = row
            }}
          >
            {line}
          </span>
        ))}
        <span className="profile-mrz-scan" />
        <span className="profile-page-number">{page}</span>
      </div>
    </div>
  )
}
