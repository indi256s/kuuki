'use client'

import { useRef, useState } from 'react'
import { formatCount, formatNumber, type Locale } from '../../../lib/format'
import { normalizeName } from '@kuuki/shared/address'
import type { PassportPreview as Preview } from '../types'
import type { BenchCopy } from './bench-live'
import { usePassportBench } from './use-passport-bench'
import './passport.css'

const COPY = {
  en: {
    holder: 'HOLDER',
    flights: 'FLIGHTS',
    countries: 'COUNTRIES',
    placeholder: 'Your name',
    captionName: 'Your passport, printing as you type.',
    captionFlights: 'Stamps land here as flights come in.',
    captionReady: 'Stamped. The card fades into your journal.',
  },
  ru: {
    holder: 'ВЛАДЕЛЕЦ',
    flights: 'ПОЛЁТЫ',
    countries: 'СТРАНЫ',
    placeholder: 'Ваше имя',
    captionName: 'Ваш паспорт печатается, пока вы пишете.',
    captionFlights: 'Штампы появятся здесь по мере полётов.',
    captionReady: 'Штамп поставлен. Карточка растворится в вашем журнале.',
  },
} as const

/** What the drawing prints on the passport itself. */
const PRINT: Record<Locale, BenchCopy> = {
  en: {
    cover: 'FLIGHT JOURNAL',
    foot: 'PASSPORT',
    holder: 'HOLDER',
    placeholder: 'Your name',
    eyebrow: 'FLIGHT JOURNAL · HOLDER',
    visa: 'VISAS / ВИЗЫ',
  },
  ru: {
    cover: 'ЖУРНАЛ ПОЛЁТОВ',
    foot: 'ПАСПОРТ',
    holder: 'ВЛАДЕЛЕЦ',
    placeholder: 'Ваше имя',
    eyebrow: 'ЖУРНАЛ ПОЛЁТОВ · ВЛАДЕЛЕЦ',
    visa: 'ВИЗЫ / VISAS',
  },
}

const CAPTION_REVIEW = {
  en: {
    one: '{count} country. The passport grows with you.',
    other: '{count} countries. The passport grows with you.',
  },
  ru: {
    one: '{count} страна. Паспорт растёт вместе с вами.',
    few: '{count} страны. Паспорт растёт вместе с вами.',
    many: '{count} стран. Паспорт растёт вместе с вами.',
    other: '{count} страны. Паспорт растёт вместе с вами.',
  },
}

/** The strip's cover thumbnail: a ring and a plane. */
function Emblem({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M20 38 L44 26 M39 25.5 L44 26 L41.5 30.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The brand side of the name and following steps. On desktop it is the passport bench (bench-live.ts): the closed cover
 * prints the name as it is typed, the cover swings open on the flights step, the bridge presses one stamp per country
 * found and the ready step takes a WELCOME entry stamp. On a phone it is the strip. The drawing is decorative; the
 * captions and the card carry the facts.
 */
export function PassportPreview({ preview, locale = 'en' }: { preview: Preview; locale?: Locale }) {
  const t = COPY[locale]
  const { step, found } = preview
  // What the first render already showed (a reload or resume) stays still; only later arrivals animate.
  const [initial] = useState(() => ({
    countries: [...found.countries],
    open: preview.open,
    ready: step === 'ready',
  }))
  const name = normalizeName(preview.name)
  const shown = name || t.placeholder
  const tall = step === 'review'
  const caption =
    step === 'name'
      ? t.captionName
      : tall
        ? formatCount(locale, found.countries.length, CAPTION_REVIEW)
        : step === 'ready'
          ? t.captionReady
          : t.captionFlights
  const stripStats = step === 'name' ? null : step === 'flights'
  const stage = useRef<HTMLDivElement>(null)
  const drawn = usePassportBench(
    stage,
    {
      open: preview.open,
      ready: step === 'ready',
      name,
      locale,
      countries: found.countries,
      flights: found.flights,
      copy: PRINT[locale],
    },
    initial,
  )
  return (
    <div className="welcome-passport" data-open={preview.open || undefined} data-step={step}>
      <div className="wp-desk" data-tall={tall || undefined}>
        <div className="wp-figure">
          <div className="wp-bench" data-ready={drawn || undefined}>
            <div ref={stage} className="iso-stage" />
          </div>
          <p className="wp-caption">{caption}</p>
        </div>
      </div>
      <div className="wp-strip">
        <div className="wp-mini" aria-hidden="true">
          <Emblem size={22} />
        </div>
        <div className="wp-strip-holder">
          <span className="wp-label">{t.holder}</span>
          <span className="wp-strip-name" dir="auto" data-empty={name ? undefined : true}>
            {shown}
          </span>
        </div>
        {stripStats === null ? null : (
          <div className="wp-strip-stat">
            <span className="wp-label">
              {stripStats ? t.flights : `${t.flights} · ${t.countries}`}
            </span>
            <span className="wp-strip-count">
              {stripStats
                ? formatNumber(locale, found.flights)
                : `${formatNumber(locale, found.flights)} · ${formatNumber(locale, found.countries.length)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
