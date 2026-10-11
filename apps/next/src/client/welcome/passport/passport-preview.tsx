'use client'

import { useState, type CSSProperties } from 'react'
import { formatCount, formatDistanceKm, formatNumber, type Locale } from '../../../lib/format'
import { normalizeName } from '@kuuki/shared/address'
import type { PassportPreview as Preview } from '../types'
import './passport.css'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
/** Board rotations, cycling; the first four are the small spread's. */
const ROTATIONS = [-9, 7, -4, 10, -6, 4, -12, 8, -5]
const SMALL_SPREAD_STAMPS = 4
const MRZ_LENGTH = 22

const COPY = {
  en: {
    cover: 'FLIGHT JOURNAL',
    holder: 'HOLDER',
    flights: 'FLIGHTS',
    countries: 'COUNTRIES',
    distance: 'DISTANCE',
    since: 'SINCE',
    placeholder: 'Your name',
    captionName: 'Your passport, printing as you type.',
    captionFlights: 'Stamps land here as flights come in.',
    captionReady: 'Stamped. The card fades into your journal.',
  },
  ru: {
    cover: 'ЖУРНАЛ ПОЛЁТОВ',
    holder: 'ВЛАДЕЛЕЦ',
    flights: 'ПОЛЁТЫ',
    countries: 'СТРАНЫ',
    distance: 'ДИСТАНЦИЯ',
    since: 'С ГОДА',
    placeholder: 'Ваше имя',
    captionName: 'Ваш паспорт печатается, пока вы пишете.',
    captionFlights: 'Штампы появятся здесь по мере полётов.',
    captionReady: 'Штамп поставлен. Карточка растворится в вашем журнале.',
  },
} as const

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

/** `P<KUU<SURNAME<<GIVEN<<<…`: Latin letters only (accents dropped); other scripts fall back to filler. */
export function mrzLine(name: string): string {
  const words = normalizeName(name)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase()
    .split(' ')
    .map((word) => word.replace(/[^A-Z]/g, ''))
    .filter(Boolean)
  const surname = words.length > 1 ? (words.at(-1) ?? '') : (words[0] ?? '')
  const given = words.length > 1 ? words.slice(0, -1).join('<') : ''
  const line = `P<KUU<${surname}<<${given}`.replace(/<+$/, '')
  return `${line}<<<<<<<<<<<<<<<<<<<<<<`.slice(0, MRZ_LENGTH)
}

function entryDate(): string {
  const now = new Date()
  return `${String(now.getDate()).padStart(2, '0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
}

function nameSize(name: string): 'md' | 'sm' | 'xs' {
  const length = [...name].length
  return length > 28 ? 'xs' : length > 18 ? 'sm' : 'md'
}

function Emblem({ size }: { size: number }) {
  const small = size < 32
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="29"
        stroke="currentColor"
        strokeWidth={small ? 2.5 : 1.25}
        opacity={small ? 1 : 0.75}
      />
      {small ? null : (
        <circle
          cx="32"
          cy="32"
          r="22"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="2 3"
          opacity="0.45"
        />
      )}
      <path
        d={
          small
            ? 'M20 38 L44 26 M39 25.5 L44 26 L41.5 30.5'
            : 'M20 38 L44 26 M39 25.5 L44 26 L41.5 30.5 M27 34.5 L24 29 M33 31.5 L31 40'
        }
        stroke="currentColor"
        strokeWidth={small ? 3 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A stamp presses in only when its country arrives; one already on the page at load is simply there. */
function Stamp({ code, index, fresh }: { code: string; index: number; fresh: boolean }) {
  return (
    <span
      className="wp-stamp"
      aria-hidden="true"
      data-ink={index % 9}
      data-fresh={fresh || undefined}
      style={
        {
          '--wp-rot': `${ROTATIONS[index % ROTATIONS.length]}deg`,
          // Countries that land together press in a short ripple; the offset is fixed per slot so it never replays.
          '--wp-delay': `${(index % 4) * 60}ms`,
        } as CSSProperties
      }
    >
      {code}
    </span>
  )
}

function Stat({
  label,
  value,
  size,
}: {
  label: string
  value: string
  size: 'name' | 'lg' | 'md'
}) {
  return (
    <div className="wp-stat">
      <span className="wp-label">{label}</span>
      <span className="wp-value" data-size={size}>
        {value}
      </span>
    </div>
  )
}

/** The brand side of the name and following steps: the cover while naming, the open spread with stamps after. */
export function PassportPreview({ preview, locale = 'en' }: { preview: Preview; locale?: Locale }) {
  const t = COPY[locale]
  const { step, found } = preview
  // What the first render already showed (a reload or resume) stays still; only later arrivals animate.
  const [initial] = useState(() => ({ countries: new Set(found.countries), step }))
  const name = normalizeName(preview.name)
  const shown = name || t.placeholder
  const tall = step === 'review'
  const reveal = step === 'ready'
  const countries = found.countries
  const stamps = tall ? countries : countries.slice(0, SMALL_SPREAD_STAMPS)
  const slots = tall ? 1 : stamps.length === 0 ? SMALL_SPREAD_STAMPS : 0
  const caption =
    step === 'name'
      ? t.captionName
      : tall
        ? formatCount(locale, countries.length, CAPTION_REVIEW)
        : reveal
          ? t.captionReady
          : t.captionFlights
  const stripStats = step === 'name' ? null : step === 'flights'
  return (
    <div className="welcome-passport" data-open={preview.open || undefined} data-step={step}>
      <div className="wp-desk" data-tall={tall || undefined}>
        <div className="wp-figure">
          {step === 'name' ? (
            <div className="wp-cover" aria-hidden="true">
              <div className="wp-cover-top">
                <span className="wp-cover-title">{t.cover}</span>
                <span className="wp-cover-kana">くうき</span>
              </div>
              <Emblem size={64} />
              <div className="wp-cover-bottom">
                <span className="wp-cover-holder">{t.holder}</span>
                <span
                  className="wp-cover-name"
                  dir="auto"
                  data-size={nameSize(shown)}
                  data-empty={name ? undefined : true}
                >
                  {shown}
                </span>
              </div>
            </div>
          ) : (
            <div className="wp-spread" data-tall={tall || undefined}>
              <div className="wp-page wp-page-left">
                {tall ? (
                  <>
                    <Stat label={t.holder} value={shown} size="name" />
                    <Stat label={t.flights} value={formatNumber(locale, found.flights)} size="lg" />
                    <Stat
                      label={t.countries}
                      value={formatNumber(locale, countries.length)}
                      size="lg"
                    />
                    {found.km ? (
                      <Stat
                        label={t.distance}
                        value={formatDistanceKm(locale, found.km)}
                        size="md"
                      />
                    ) : null}
                    {found.since ? (
                      <Stat label={t.since} value={String(found.since)} size="md" />
                    ) : null}
                  </>
                ) : (
                  <>
                    <Stat label={t.holder} value={shown} size="name" />
                    <Stat label={t.flights} value={formatNumber(locale, found.flights)} size="md" />
                    <span className="wp-mrz" aria-hidden="true">
                      {mrzLine(name)}
                    </span>
                  </>
                )}
              </div>
              <div className="wp-gutter" />
              <div className="wp-page wp-page-right" data-tall={tall || undefined}>
                {stamps.map((code, index) => (
                  <Stamp
                    key={code}
                    code={code}
                    index={index}
                    fresh={!initial.countries.has(code)}
                  />
                ))}
                {Array.from({ length: slots }, (_, slot) => (
                  <span key={slot} className="wp-slot" aria-hidden="true" />
                ))}
              </div>
              {reveal ? (
                <div
                  className="wp-entry"
                  aria-hidden="true"
                  data-fresh={initial.step !== 'ready' || undefined}
                >
                  <span className="wp-entry-kicker">KUUKI · ENTRY</span>
                  <span className="wp-entry-word">WELCOME</span>
                  <span className="wp-entry-date" suppressHydrationWarning>
                    {entryDate()}
                  </span>
                </div>
              ) : null}
            </div>
          )}
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
                : `${formatNumber(locale, found.flights)} · ${formatNumber(locale, countries.length)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
