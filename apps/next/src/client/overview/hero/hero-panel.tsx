'use client'

import { Fragment, useId, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from '@keyline-icons/react'
import {
  formatCount,
  formatDuration,
  formatNumber,
  type CountForms,
  type Locale,
} from '../../../lib/format'
import { forms, S, t } from '../copy'
import { IsoFigure } from '../iso/iso-figure'
import { spike } from '../iso/spike'
import { odometer } from '../iso/odometer'
import { pickLine } from '../narrator/pick'
import { useOverview } from '../store/overview-context'
import { facetName } from '../filters/chip-label'
import { journalLinkFor } from '../page/journal-link'
import { isZeroScope } from '../store/scope-state'
import { odometerDigits, stubBucket } from './records'
import './hero.css'

const copy = {
  distance: { en: 'Distance', ru: 'Расстояние' },
  km: { en: 'km', ru: 'км' },
  air: { en: 'Flight time', ru: 'Время перелётов' },
  geography: { en: 'Geography', ru: 'География' },
  byAir: { en: 'by air', ru: 'по воздуху' },
  byGround: { en: 'by ground', ru: 'по земле' },
  allTravel: { en: 'in total', ru: 'всего' },
  lastPublished: { en: 'last published total', ru: 'последний опубликованный итог' },
}
const countryForms: CountForms = {
  en: { one: '{count} country or territory', other: '{count} countries & territories' },
  ru: forms.countries.ru,
}
const noun = (locale: Locale, n: number, set: CountForms) =>
  formatCount(locale, n, set).replace(formatNumber(locale, n), '').trim()

/** One leading fact and a static drawing; explanations stay with the values they qualify. */
export function HeroPanel() {
  const { scope, all, payload, filter, locale, ownerKey } = useOverview()
  const f = scope?.figures
  const ground = f?.scope === 'ground'
  const flights = f?.flights ?? 0
  const distance = f?.travelKm ?? 0
  const figure = useMemo(
    () =>
      ground
        ? odometer(0.36, { digits: odometerDigits(distance) })
        : spike(0.65, { stubs: stubBucket(flights) }),
    [ground, flights, distance],
  )
  if (!payload || !scope || !all || !f) return <p role="status">{t(S.loading, locale)}</p>
  const zero = isZeroScope(scope, filter)
  const number = (n: number) => (zero ? '—' : formatNumber(locale, n))
  const km = number(Math.round(f.travelKm))
  const countrySource =
    f.countries.source === 'by_air'
      ? t(copy.byAir, locale)
      : f.countries.source === 'ground'
        ? t(copy.byGround, locale)
        : f.countries.source === 'all' && payload.ground.length > 0
          ? t(copy.allTravel, locale)
          : !payload.derivedReady
            ? t(copy.lastPublished, locale)
            : ''
  const footer = zero ? null : pickLine('hero', scope, all, ownerKey, locale)
  return (
    <section className="ov3-hero-panel" data-scope={f.scope} aria-label={t(S.figures, locale)}>
      <div className="ov3-hero-heading">
        <dl className="ov3-hero-lead">
          <dt>{ground ? t(copy.distance, locale) : noun(locale, f.flights, forms.flights)}</dt>
          <dd aria-label={ground ? t(copy.distance, locale) : t(S.flights, locale)}>
            <NumericValue locale={locale} value={ground ? km : number(f.flights)} />
            {ground ? (
              <span className="ov3-hero-unit">
                {' '}
                {t(copy.km, locale)}
              </span>
            ) : null}
          </dd>
        </dl>
        {!zero ? (
          <span className="ov3-hero-drawing" aria-hidden="true">
            <IsoFigure figure={figure} />
          </span>
        ) : null}
      </div>
      <dl className="ov3-hero-facts">
        {!ground ? (
          <>
            <div className="ov3-hero-row" data-record="km">
              <dt>{t(copy.distance, locale)}</dt>
              <dd>
                <NumericValue locale={locale} value={km} />
                <span className="ov3-hero-unit">
                  {' '}
                  {t(copy.km, locale)}
                </span>
              </dd>
            </div>
            <div className="ov3-hero-row" data-record="air">
              <dt>{t(copy.air, locale)}</dt>
              <dd>
                {zero ? (
                  '—'
                ) : (
                  <>
                    {formatDuration(locale, f.durationMinutes)
                      .split(' ')
                      .map((part, index) => {
                        const separator = part.lastIndexOf(' ')
                        const quantity = part.slice(0, separator)
                        const unit = part.slice(separator + 1)
                        return (
                          <Fragment key={index}>
                            {index > 0 ? ' ' : null}
                            <span className="ov3-hero-duration-part">
                              <NumericValue locale={locale} value={quantity} />
                              <span className="ov3-hero-unit">
                                {' '}
                                {unit}
                              </span>
                            </span>
                          </Fragment>
                        )
                      })}
                  </>
                )}
              </dd>
            </div>
          </>
        ) : null}
        <div className="ov3-hero-row" data-record="countries">
          <dt>{t(copy.geography, locale)}</dt>
          <dd>
            <NumericValue locale={locale} value={number(f.countries.value)} />
            <span className="ov3-hero-unit">
              {' '}
              {noun(locale, f.countries.value, countryForms)}
            </span>
            {countrySource ? <span className="ov3-hero-note">{countrySource}</span> : null}
            {!ground ? (
              <span className="ov3-hero-note">
                {zero
                  ? `— ${t(S.airports, locale).toLocaleLowerCase(locale)}`
                  : formatCount(locale, f.airports, forms.airports)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
      {!zero && f.flights > 0 && !ground ? <JournalLink /> : null}
      {footer ? <p className="ov3-hero-footer">{footer}</p> : null}
    </section>
  )
}

function NumericValue({ locale, value }: { locale: Locale; value: string }) {
  const separator = new Intl.NumberFormat(locale)
    .formatToParts(1000)
    .find((part) => part.type === 'group')?.value
  if (!separator) return value
  return value.split(separator).map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? (
        <>
          {separator}
          <wbr />
        </>
      ) : null}
      {part}
    </Fragment>
  ))
}

function JournalLink() {
  const { filter, payload, locale, flushPrefs, isCurrent } = useOverview()
  const router = useRouter()
  const note = useId()
  const { href, dropped } = useMemo(() => journalLinkFor(filter, payload!), [filter, payload])
  const names = dropped
    .map((facet) => facetName(facet, locale).toLocaleLowerCase(locale))
    .join(', ')
  return (
    <div className="ov3-hero-journal">
      {dropped.length ? (
        <p id={note}>
          {locale === 'ru' ? `В журнале без фильтров «${names}».` : `Journal omits ${names}.`}
        </p>
      ) : null}
      <Link
        href={href}
        aria-describedby={dropped.length ? note : undefined}
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return
          event.preventDefault()
          void flushPrefs().finally(() => {
            if (isCurrent()) router.push(href)
          })
        }}
      >
        {locale === 'ru' ? 'Открыть в журнале' : 'Open in Journal'}
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </div>
  )
}
