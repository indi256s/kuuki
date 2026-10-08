'use client'

import type { CSSProperties } from 'react'
import { Stamp, type StampKind } from '../signature/stamp'
import { Button } from '../ui/button'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import type { PassportData } from '../../server/passport'
import { AWAITING_QUEUE_HREF, CATALOG_TOTAL, REGION_LABELS, catalogCountry, formatVisitPoint, stampCaption, type HeaderFigures, type PassportEntry, type RegionGroup } from './model'
import './passport.css'

const PENDING_FORMS = {
  en: { one: '{count} waiting for confirmation', other: '{count} waiting for confirmation' },
  ru: { one: '{count} ждёт отметки', few: '{count} ждут отметки', many: '{count} ждут отметки', other: '{count} ждут отметки' },
}
const KIND_LABELS: Record<StampKind, Record<Locale, string>> = {
  air: { en: 'by air', ru: 'самолётом' },
  land: { en: 'by land', ru: 'по суше' },
  sea: { en: 'by sea', ru: 'по морю' },
  claim: { en: 'claimed without flights', ru: 'отмечена без перелётов' },
}

/** Props shared by every stamp the passport draws: native name, localized name, ink, rings and first year. */
export function stampProps(entry: PassportEntry, locale: Locale, name: (code: string) => string) {
  const country = catalogCountry(entry.code)
  return {
    countryCode: entry.code,
    nativeName: country?.nativeName ?? name(entry.code),
    name: name(entry.code),
    kind: entry.kind,
    visits: Math.max(1, entry.visits),
    firstYear: entry.firstYear ?? undefined,
    status: entry.status,
    color: country?.dominantColor ?? null,
    locale,
  }
}

// Arc metric-card/progress composition (uiarc.dev, MIT; docs/research/2026-10-08-arc-source-inventory.md): immediate values, labelled track; Stamp stays native.
/** The unboxed cover: stated total of the catalog, waiting caption, regions, new this year and the latest stamp. */
export function PassportCover({ locale, figures, regions, name, onAdd, now }: {
  locale: Locale; figures: HeaderFigures; regions: PassportData['regions']; name: (code: string) => string; onAdd: () => void; now: Date
}) {
  const ru = locale === 'ru'
  const share = Math.min(100, (figures.total / CATALOG_TOTAL) * 100)
  return <section className="passport-cover" aria-label={ru ? 'Сводка паспорта' : 'Passport summary'}>
    <div className="passport-figures">
      <div className="passport-figure">
        <span className="eyebrow">{ru ? 'Страны и территории' : 'Countries and territories'}</span>
        <p className="passport-caption"><strong>{formatNumber(locale, figures.total)}</strong> <span className="passport-figure-of">{ru ? `из ${formatNumber(locale, CATALOG_TOTAL)}` : `of ${formatNumber(locale, CATALOG_TOTAL)}`}</span></p>
        <div className="passport-progress" role="progressbar" aria-label={ru ? 'Страны и территории в паспорте' : 'Countries and territories in passport'} aria-valuemin={0} aria-valuemax={CATALOG_TOTAL} aria-valuenow={figures.total}><span style={{ width: `${share}%` } as CSSProperties} /></div>
        {figures.pending > 0 ? <p className="passport-caption">· <a href={AWAITING_QUEUE_HREF}>{formatCount(locale, figures.pending, PENDING_FORMS)}</a></p> : null}
      </div>
      <div className="passport-figure passport-figure-regions">
        <span className="eyebrow">{ru ? 'Регионы' : 'Regions'}</span>
        <ul className="passport-regions">
          {regions.map(region => <li key={region.id} data-filled={region.pressed > 0}>
            {REGION_LABELS[region.id][locale]} <span>{formatNumber(locale, region.pressed)}</span>
            <span className="sr-only">{ru ? ` из ${formatNumber(locale, region.total)}` : ` of ${formatNumber(locale, region.total)}`}</span>
          </li>)}
        </ul>
      </div>
      <div className="passport-figure">
        <span className="eyebrow">{ru ? `Новые в ${now.getUTCFullYear()}` : `New in ${now.getUTCFullYear()}`}</span>
        <strong>{formatNumber(locale, figures.newThisYear)}</strong>
      </div>
      <div className="passport-figure passport-figure-latest">
        <span className="eyebrow">{ru ? 'Последний штамп' : 'Latest stamp'}</span>
        {figures.latest ? <div className="passport-latest">
          <Stamp {...stampProps(figures.latest, locale, name)} static />
          <p className="passport-caption"><span>{name(figures.latest.code)}</span><br />{formatVisitPoint(locale, figures.latest.first!, 'month')}</p>
        </div> : <p className="passport-caption">{ru ? 'Пока нет' : 'None yet'}</p>}
      </div>
    </div>
    <div className="passport-cover-actions">
      <Button variant="primary" onClick={onAdd}>{ru ? '＋ Добавить страну' : '＋ Add country'}</Button>
      <a className="ui-button" data-variant="secondary" href="/passport/manage"><span>{ru ? 'Самолёты в журнале' : 'Aircraft in journal'}</span></a>
    </div>
  </section>
}

/** Region groups (H2 with a count), each a grid whose columns follow its own width (passport.css). */
export function StampGroups({ groups, locale, name, onOpen, onOpenArrival, opening = null, pressed, now }: {
  groups: RegionGroup[]; locale: Locale; name: (code: string) => string
  onOpen: (code: string) => void
  /** A pending slot resolves its arrival card from the country's evidence; the href is the queue fallback. */
  onOpenArrival: (code: string) => void
  /** The pending slot whose arrival card is being resolved: busy, and not activated again. */
  opening?: string | null
  pressed: ReadonlyMap<string, string>; now: Date
}) {
  const ru = locale === 'ru'
  return <div className="passport-groups">
    {groups.map(group => <section key={group.region ?? 'other'} className="passport-group">
      <h2>{group.region ? REGION_LABELS[group.region][locale] : (ru ? 'Другие' : 'Other')} <span>· {formatNumber(locale, group.entries.length)}</span></h2>
      <ul className="passport-grid">
        {group.entries.map(entry => {
          const caption = stampCaption(locale, entry, now)
          const label = `${name(entry.code)}, ${KIND_LABELS[entry.kind][locale]}${caption ? `, ${caption}` : ''}`
          const press = pressed.get(entry.code)
          return <li key={entry.code} className="passport-cell" data-status={entry.status} data-hero-enter-key={entry.code}>
            <Stamp {...stampProps(entry, locale, name)} caption={caption} static={!press} pressEventId={press} />
            {entry.status === 'pending'
              ? <a className="passport-cell-action" href={AWAITING_QUEUE_HREF} aria-busy={opening === entry.code || undefined}
                onClick={event => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  if (opening !== entry.code) onOpenArrival(entry.code)
                }}
                aria-label={ru ? `${name(entry.code)}: ждёт отметки. Открыть карточку прилёта` : `${name(entry.code)}: waiting for confirmation. Open the arrival card`} />
              : <button type="button" className="passport-cell-action" aria-label={label} onClick={() => onOpen(entry.code)} />}
          </li>
        })}
      </ul>
    </section>)}
  </div>
}

const GHOSTS = ['round', 'rect', 'round', 'round', 'rect', 'round'] as const
const WAITING_FORMS = {
  en: { one: '{count} country is waiting for you', other: '{count} countries are waiting for you' },
  ru: { one: '{count} страна ждёт вас', few: '{count} страны ждут вас', many: '{count} стран ждут вас', other: '{count} страны ждут вас' },
}

/** An empty passport page: six ghost stamps, the catalog headline and the two ways in. */
export function EmptyPassport({ locale, onAdd }: { locale: Locale; onAdd: () => void }) {
  const ru = locale === 'ru'
  return <section className="passport-empty" aria-labelledby="passport-empty-title">
    <ul className="passport-ghosts" aria-hidden="true">{GHOSTS.map((shape, index) => <li key={index} className="passport-ghost" data-shape={shape} />)}</ul>
    <h2 id="passport-empty-title">{formatCount(locale, CATALOG_TOTAL, WAITING_FORMS)}</h2>
    <p>{ru ? 'Добавьте страну, где вы были, или импортируйте перелёты: штампы появятся здесь.' : 'Add a country you have visited or import your flights, and the stamps appear here.'}</p>
    <div className="read-actions">
      <Button variant="primary" onClick={onAdd}>{ru ? 'Добавить страну' : 'Add country'}</Button>
      <a className="ui-button" data-variant="secondary" href="/import"><span>{ru ? 'Импортировать перелёты' : 'Import flights'}</span></a>
    </div>
  </section>
}

/** The shape key under the view switch: what round, rectangular and dashed stamps mean. */
export function StampKey({ locale }: { locale: Locale }) {
  const ru = locale === 'ru'
  return <ul className="passport-key" aria-label={ru ? 'Обозначения штампов' : 'Stamp key'}>
    <li><span className="passport-key-shape" data-shape="round" aria-hidden="true" />{ru ? 'круглый — самолётом' : 'round — by air'}</li>
    <li><span className="passport-key-shape" data-shape="rect" aria-hidden="true" />{ru ? 'прямоугольный — по суше или морю' : 'rectangular — by land or sea'}</li>
    <li><span className="passport-key-shape" data-shape="dashed" aria-hidden="true" />{ru ? 'пунктир — без перелётов' : 'dashed — no flights'}</li>
  </ul>
}
