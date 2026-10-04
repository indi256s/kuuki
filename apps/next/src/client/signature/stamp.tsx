'use client'

import clsx from 'clsx'
import { useLayoutEffect, useState, type CSSProperties } from 'react'
import { stampInk } from '../../lib/stamp-ink'
import type { Locale } from '../../lib/format'
import './signature.css'

export type StampKind = 'air' | 'land' | 'sea' | 'claim'
export type StampStatus = 'pressed' | 'pending'

export type StampProps = {
  countryCode: string
  /** Native-script name: the hero of the face. */
  nativeName: string
  /** Localized name in small caps. */
  name?: string
  kind: StampKind
  /** Number of visits; drives the ring count (see ringCount). */
  visits?: number
  firstYear?: number
  status?: StampStatus
  /** Flag-derived color (hex); normalized per theme by stampInk, neutral when missing. */
  color?: string | null
  theme: 'light' | 'dark'
  locale: Locale
  /** Readable text below the stamp, e.g. «×12 · 2 мес. назад» (relative time is formatted by the caller). */
  caption?: string
  /** Immutable ID of the press event. The press animation plays once per ID per browser session. */
  pressEventId?: string
  /** No animation at all (grids, print). */
  static?: boolean
  className?: string
}

/**
 * Ring count by visits: 1 visit = 1 ring, 2–3 visits = 2 rings, 4 or more = 3 rings.
 * (The UX brief §6.4 suggests 1 / 2–9 / 10+; this task's rule is 1 / 2–3 / 4+ so progression is visible earlier.)
 */
export function ringCount(visits: number): 1 | 2 | 3 {
  return visits >= 4 ? 3 : visits >= 2 ? 2 : 1
}

// ----- one-shot press: module-level Set + sessionStorage, so remount / refetch / route changes never replay -----
const STORAGE_KEY = 'kuuki:stamp-press'
const seen = new Set<string>()
let loaded = false
function load() {
  if (loaded) return
  loaded = true
  try { for (const id of JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '[]') as string[]) seen.add(id) } catch { /* storage unavailable */ }
}
function wasPressed(id: string): boolean { load(); return seen.has(id) }
function markPressed(id: string) {
  load()
  seen.add(id)
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...seen].slice(-200))) } catch { /* storage unavailable */ }
}
/** Test helper: forget what this session has seen. */
export function resetStampPressMemory() {
  seen.clear()
  loaded = false
  try { window.sessionStorage.removeItem(STORAGE_KEY) } catch { /* storage unavailable */ }
}

const COPY = {
  claim: { en: 'no flights', ru: 'без перелётов' },
  pending: { en: 'waiting', ru: 'ждёт отметки' },
  kind: { air: { en: 'by air', ru: 'самолётом' }, land: { en: 'by land', ru: 'по суше' }, sea: { en: 'by sea', ru: 'по морю' }, claim: { en: 'claimed', ru: 'отмечена вручную' } },
} as const

export function Stamp({ countryCode, nativeName, name, kind, visits = 1, firstYear, status = 'pressed', color, theme, locale, caption, pressEventId, static: isStatic, className }: StampProps) {
  const round = kind === 'air'
  const pending = status === 'pending'
  const rings = ringCount(visits)
  // Decided once per mount, after hydration (so SSR markup always matches). Marked synchronously, so a remount or refetch can never replay it.
  const [play, setPlay] = useState(false)
  useLayoutEffect(() => {
    if (isStatic || pending || !pressEventId || wasPressed(pressEventId)) return
    markPressed(pressEventId)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, derived from browser-session memory that cannot be read during render
    setPlay(true)
  }, [isStatic, pending, pressEventId])

  const ink = pending ? undefined : stampInk(color, theme)
  const style = ink ? ({ '--stamp-ink': ink } as CSSProperties) : undefined
  const tag = pending ? COPY.pending[locale] : kind === 'claim' ? COPY.claim[locale] : null

  return (
    <figure className={clsx('stamp', className)} data-kind={kind} data-status={status} data-shape={round ? 'round' : 'rect'} data-press={play ? 'play' : 'idle'} style={style}>
      <div className="stamp-face">
        <svg className="stamp-rings" viewBox={round ? '0 0 120 120' : '0 0 160 120'} aria-hidden="true" focusable="false">
          {round
            ? Array.from({ length: rings }, (_, i) => <circle key={i} cx="60" cy="60" r={56 - i * 5} fill="none" stroke="currentColor" strokeWidth={2.5 - i * 0.75} />)
            : Array.from({ length: rings }, (_, i) => <rect key={i} x={4 + i * 5} y={4 + i * 5} width={152 - i * 10} height={112 - i * 10} rx={8 - i} fill="none" stroke="currentColor" strokeWidth={2.5 - i * 0.75} />)}
        </svg>
        <div className="stamp-text">
          <span className="stamp-code">{countryCode}</span>
          <span className="stamp-native">{nativeName}</span>
          {name ? <span className="stamp-name">{name}</span> : null}
          {firstYear && !pending ? <span className="stamp-year">{firstYear}</span> : null}
          {tag ? <span className="stamp-tag">{tag}</span> : null}
        </div>
      </div>
      <span className="sr-only">{COPY.kind[kind][locale]}</span>
      {caption ? <figcaption className="stamp-caption">{caption}</figcaption> : null}
    </figure>
  )
}
