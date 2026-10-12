'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { isEmptyFilter } from '@kuuki/shared/overview/filter'
import {
  formatCount,
  formatDuration,
  formatNumber,
  type CountForms,
  type Locale,
} from '../../../lib/format'
import { forms, S, t } from '../copy'
import { IsoFigure } from '../iso/iso-figure'
import { heroGlyph, type HeroGlyph } from '../iso/hero-glyphs'
import { fitBox, type IsoFigureData } from '../iso/scene'
import { spike } from '../iso/spike'
import { odometer } from '../iso/odometer'
import { cabinWindow } from '../iso/cabin-window'
import { suitcase } from '../iso/suitcase'
import { carousel } from '../iso/carousel'
import { pickLine, recordLine } from '../narrator/pick'
import type { HeroRecord } from '../narrator/triggers'
import { useOverview, useOverviewUI } from '../store/overview-context'
import {
  HERO_RECORDS,
  odometerDigits,
  pickStickers,
  railValue,
  stubBucket,
  tagCode,
} from './records'
import { ENTER_MS, LEAVE_MS, useTakeover, type TakeoverState } from './use-takeover'
import '../iso/spike.css'
import '../iso/odometer.css'
import '../iso/cabin-window.css'
import '../iso/suitcase.css'
import '../iso/carousel.css'
import './hero.css'

const copy = {
  km: { en: 'km · great-circle', ru: 'км · по дуге большого круга' },
  air: { en: 'in the air', ru: 'в воздухе' },
  byAir: { en: 'by air', ru: 'по воздуху' },
  lastPublished: { en: 'last published total', ru: 'последний опубликованный итог' },
}
const estimatedForms: CountForms = {
  en: { one: '{count} estimated', other: '{count} estimated' },
  ru: {
    one: '{count} оценённый',
    few: '{count} оценённых',
    many: '{count} оценённых',
    other: '{count} оценённых',
  },
}
const countryForms: CountForms = {
  en: { one: '{count} country or territory', other: '{count} countries & territories' },
  ru: forms.countries.ru,
}
/** A count's noun in the form its number takes ("69 flights" → "flights", «69 перелётов» → «перелётов»), for a label under the value. */
const noun = (locale: Locale, n: number, set: CountForms) =>
  formatCount(locale, n, set).replace(formatNumber(locale, n), '').trim()

const GLYPHS: Record<HeroRecord, HeroGlyph> = {
  flights: 'flights',
  km: 'km',
  air: 'air',
  countries: 'countries',
  airports: 'airports',
}
// Glyphs never change, so they are built once, at their true size.
const glyphs = Object.fromEntries(
  HERO_RECORDS.map((record) => [record, heroGlyph(GLYPHS[record])]),
) as Record<HeroRecord, IsoFigureData>
const FIGURE_CLASS: Record<HeroRecord, string> = {
  flights: 'iso-spike',
  km: 'iso-odometer',
  air: 'iso-cabin-window',
  countries: 'iso-suitcase',
  airports: 'iso-carousel',
}
/** Strokes stay 1px at any scale, so a figure is drawn at the stage's size up to this scale instead of stretched by CSS. */
const MAX_K = 1.6

/** The figures card: the five records as a list, each with its glyph, and the winning hero line at the foot. A row under the pointer (or a
 * tap) hands the card to that record's drawing; the list folds into an index rail. The takeover is decoration over the same facts, so it
 * is `aria-hidden` and the list keeps its semantics underneath. */
export function HeroPanel() {
  const { scope, all, payload, filter, locale, ownerKey } = useOverview()
  const { replayStarted } = useOverviewUI()
  const reduced = useReducedMotion() ?? false
  const card = useRef<HTMLElement>(null)
  const zero = scope ? scope.figures.flights === 0 && !isEmptyFilter(filter) : false
  const { state, handlers } = useTakeover(card, !!scope && !zero && !replayStarted, reduced)
  const stickers = useMemo(
    () => (payload && scope ? pickStickers(payload, filter, scope) : { stickers: [], lit: null }),
    [payload, filter, scope],
  )
  if (!payload || !scope || !all) return <p role="status">{t(S.loading, locale)}</p>
  const f = scope.figures
  const value = (record: HeroRecord): string => {
    if (zero) return '—'
    switch (record) {
      case 'flights':
        return formatNumber(locale, f.flights)
      case 'km':
        return formatNumber(locale, Math.round(f.distanceKm))
      case 'air':
        return (f.durationApproximate ? '≈' : '') + formatDuration(locale, f.durationMinutes)
      case 'countries':
        return formatNumber(locale, f.countries.value)
      case 'airports':
        return formatNumber(locale, f.airports)
    }
  }
  const label = (record: HeroRecord): string => {
    switch (record) {
      case 'flights':
        return noun(locale, f.flights, forms.flights)
      case 'km':
        return t(copy.km, locale)
      case 'air':
        return (
          t(copy.air, locale) +
          (f.estimatedFlights > 0
            ? ` · ${formatCount(locale, f.estimatedFlights, estimatedForms)}`
            : '')
        )
      case 'countries':
        return (
          noun(locale, f.countries.value, countryForms) +
          (f.countries.source === 'by_air'
            ? ` · ${t(copy.byAir, locale)}`
            : !payload.derivedReady
              ? ` · ${t(copy.lastPublished, locale)}`
              : '')
        )
      case 'airports':
        return noun(locale, f.airports, forms.airports)
    }
  }
  // Accessible names stay the record's plain name, so "Flights" still reads the flight count.
  const names: Record<HeroRecord, string> = {
    flights: t(S.flights, locale),
    km: t(copy.km, locale),
    air: t(copy.air, locale),
    countries: t(S.countries, locale),
    airports: t(S.airports, locale),
  }
  const footer = zero ? null : pickLine('hero', scope, all, ownerKey, locale)
  return (
    <section
      ref={card}
      className="ov3-hero-panel"
      aria-label={t(S.figures, locale)}
      data-takeover={state ? state.phase : undefined}
      {...handlers}
    >
      <dl className="ov3-hero-list">
        {HERO_RECORDS.map((record) => (
          <div className="ov3-hero-row" data-record={record} key={record}>
            <dt className="ov3-hero-label">{label(record)}</dt>
            <dd className="ov3-hero-value" aria-label={names[record]}>
              {value(record)}
            </dd>
            <span className="ov3-hero-glyph" aria-hidden="true">
              <IsoFigure figure={glyphs[record]} />
            </span>
          </div>
        ))}
      </dl>
      {footer ? <p className="ov3-hero-footer">{footer}</p> : null}
      {state ? (
        <Takeover
          key={state.record}
          state={state}
          card={card}
          reduced={reduced}
          rail={HERO_RECORDS.map((record) => ({ record, value: railValue(locale, record, f) }))}
          value={value(state.record)}
          label={label(state.record)}
          line={recordLine(state.record, scope, all, ownerKey, locale, state.turn)}
          build={(k) => {
            switch (state.record) {
              case 'flights':
                return spike(k, { stubs: stubBucket(f.flights) })
              case 'km':
                return odometer(k, { digits: odometerDigits(f.distanceKm) })
              case 'air':
                return cabinWindow(k)
              case 'countries':
                return suitcase(k, stickers)
              case 'airports':
                return carousel(k, { code: tagCode(scope) ?? '' })
            }
          }}
          buildKey={`${state.record}|${f.flights}|${Math.round(f.distanceKm)}|${stickers.stickers.join()}|${stickers.lit}|${tagCode(scope)}`}
        />
      ) : null}
    </section>
  )
}

function Takeover({
  state,
  card,
  reduced,
  rail,
  value,
  label,
  line,
  build,
  buildKey,
}: {
  state: TakeoverState
  card: React.RefObject<HTMLElement | null>
  reduced: boolean
  rail: { record: HeroRecord; value: string }[]
  value: string
  label: string
  line: string | null
  build: (k: number) => IsoFigureData
  buildKey: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const drawing = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<[number, number] | null>(null)
  // The drawing is fitted to the box the stage leaves it, measured before paint so the first frame is already the right size.
  useLayoutEffect(() => {
    const node = drawing.current
    if (!node) return
    const measure = () => {
      const { width, height } = node.getBoundingClientRect()
      setBox((old) =>
        old && Math.abs(old[0] - width) < 1 && Math.abs(old[1] - height) < 1
          ? old
          : [Math.floor(width), Math.floor(height)],
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const figure = useMemo(
    () => {
      if (!box || box[0] < 40 || box[1] < 40) return null
      return build(Math.min(MAX_K, fitBox(box[0], box[1], build)))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `build` is a fresh closure every render; `buildKey` carries everything it reads.
    [box, buildKey],
  )
  // Values glide from their list rows to their rail slots; closing glides them back. Reduced motion swaps at once.
  const glide = (direction: 'in' | 'out') => {
    if (reduced || !root.current || !card.current) return
    const easing =
      getComputedStyle(root.current).getPropertyValue('--ease-out').trim() || 'ease-out'
    for (const slot of root.current.querySelectorAll<HTMLElement>('[data-rail-value]')) {
      const from = card.current.querySelector<HTMLElement>(
        `.ov3-hero-row[data-record="${slot.dataset.railValue}"] .ov3-hero-value`,
      )
      if (!from) continue
      const a = from.getBoundingClientRect(),
        b = slot.getBoundingClientRect()
      if (!b.height) continue
      const listed = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.height / b.height})`
      slot.animate(
        direction === 'in'
          ? [{ transform: listed }, { transform: 'none' }]
          : [{ transform: 'none' }, { transform: listed }],
        { duration: direction === 'in' ? ENTER_MS : LEAVE_MS, easing, fill: 'both' },
      )
    }
  }
  const entered = state.entered
  useLayoutEffect(() => {
    if (entered) glide('in')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the glide runs once, when the takeover first opens from the list.
  }, [])
  const closing = state.phase === 'closing'
  useLayoutEffect(() => {
    if (closing) glide('out')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the phase turns to closing.
  }, [closing])
  return (
    <div
      ref={root}
      className="ov3-takeover"
      aria-hidden="true"
      data-phase={state.phase}
      data-entered={entered ? '' : undefined}
      data-posed={state.posed ? '' : undefined}
    >
      <div className="ov3-takeover-rail">
        {rail.map(({ record, value: compact }) => (
          <div
            className="ov3-takeover-entry"
            data-record={record}
            data-active={record === state.record ? '' : undefined}
            key={record}
          >
            <span className="ov3-takeover-tick" />
            <span className="ov3-takeover-compact" data-rail-value={record}>
              {compact}
            </span>
          </div>
        ))}
      </div>
      <div className="ov3-takeover-stage">
        <div className="ov3-takeover-drawing" ref={drawing}>
          {figure ? <IsoFigure figure={figure} className={FIGURE_CLASS[state.record]} /> : null}
        </div>
        <div
          className="ov3-takeover-value"
          style={{ '--chars': value.length } as React.CSSProperties}
        >
          {value}
        </div>
        <p className="ov3-takeover-label">{label}</p>
        {line ? <p className="ov3-takeover-line">{line}</p> : null}
      </div>
    </div>
  )
}
