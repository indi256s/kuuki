'use client'

import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { setAccent } from '../appearance'
import { ACCENTS, isAccent, type Accent } from '../../lib/theme-colors'
import type { Locale } from '../../lib/format'
import './ui.css'

const NAMES: Record<Accent, { en: string; ru: string }> = {
  terracotta: { en: 'Terracotta', ru: 'Терракота' },
  ai: { en: 'Ai', ru: 'Ай' },
  matcha: { en: 'Matcha', ru: 'Матча' },
  kincha: { en: 'Kincha', ru: 'Кинча' },
  sakura: { en: 'Sakura', ru: 'Сакура' },
  sumi: { en: 'Sumi', ru: 'Суми' },
}

export type SwatchPickerProps = {
  locale: Locale
  label?: string
  /** Controlled value; when omitted the picker follows `data-accent` on <html> (terracotta by default). */
  value?: Accent
  onChange?: (accent: Accent) => void
}

/** Only the six named accents; selection goes through `setAccent`, which stores the name, never a color. */
export function SwatchPicker({ locale, label, value, onChange }: SwatchPickerProps) {
  const [own, setOwn] = useState<Accent>('terracotta')
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    const read = () => { const current = document.documentElement.dataset.accent; setOwn(isAccent(current) ? current : 'terracotta') }
    read()
    window.addEventListener('kuuki:appearance', read)
    return () => window.removeEventListener('kuuki:appearance', read)
  }, [])
  const current = value ?? own
  const choose = (accent: Accent) => { setOwn(accent); setAccent(accent); onChange?.(accent) }
  const move = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + ACCENTS.length) % ACCENTS.length
    refs.current[next]?.focus()
    choose(ACCENTS[next])
  }
  return (
    <div className="ui-swatches" role="radiogroup" aria-label={label ?? (locale === 'ru' ? 'Акцентный цвет' : 'Accent color')}>
      {ACCENTS.map((accent, index) => (
        <button
          key={accent}
          ref={node => { refs.current[index] = node }}
          type="button"
          role="radio"
          className="ui-swatch"
          aria-checked={accent === current}
          tabIndex={accent === current ? 0 : -1}
          onClick={() => choose(accent)}
          onKeyDown={event => move(event, index)}
        >
          <span className="ui-swatch-dot" style={{ '--swatch': `var(--swatch-${accent})` } as CSSProperties} aria-hidden="true">
            {accent === current ? <Check size={16} strokeWidth={2.5} /> : null}
          </span>
          <span className="ui-swatch-name">{NAMES[accent][locale]}</span>
        </button>
      ))}
    </div>
  )
}
