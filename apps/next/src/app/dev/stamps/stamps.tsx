'use client'

import './stamps.css'
import { useEffect, useRef, useState } from 'react'
import { SHAPE_NAMES } from '../../../lib/stamp-art/frame'
import { setTheme } from '../../../client/appearance'
import { CountryStamp } from '../../../client/stamps/country-stamp'
import { emWidth } from '../../../client/stamps/ring-fit'
import { stampCodes, stampMeta, stampNames } from '../../../client/stamps/stamp-meta'
import { Button } from '../../../client/ui/button'
import { SegmentedControl } from '../../../client/ui/segmented-control'
import type { Locale } from '../../../lib/format'
import type { ReviewFile, ReviewStatus } from './review-store'

export type SheetState = {
  theme: 'light' | 'dark'
  locale: Locale
  size: 96 | 160
  worn: boolean
  compare: boolean
  filter: 'all' | 'unmarked' | 'redo' | 'accepted'
}

const CODES = stampCodes()
const fullName = (code: string, locale: Locale) => stampNames(code, locale).name

export type Row = { iso2: string; kind: 'recipe' | 'fallback'; issues: string[] }

/** The longest ring names of the catalog in one locale, by estimated width. */
function longestNames(locale: Locale, count: number): string[] {
  const width = (c: string) => emWidth(fullName(c, locale).toLocaleUpperCase(locale))
  return [...CODES].sort((a, b) => width(b) - width(a)).slice(0, count)
}

export function StampSheet({
  initial,
  review: initialReview,
  rows,
}: {
  initial: SheetState
  review: ReviewFile
  rows: Row[]
}) {
  const [s, setS] = useState(initial)
  const [review, setReview] = useState(initialReview)
  const set = <K extends keyof SheetState>(key: K, value: SheetState[K]) =>
    setS((prev) => ({ ...prev, [key]: value }))
  useEffect(() => {
    setTheme(s.theme)
  }, [s.theme])
  const ru = s.locale === 'ru'
  const t = (en: string, rus: string) => (ru ? rus : en)
  const shown = rows.filter((r) => {
    const status = review[r.iso2]?.status
    return s.filter === 'all' || (s.filter === 'unmarked' ? !status : status === s.filter)
  })

  const headingRef = useRef<HTMLHeadingElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // The card to focus once the list has re-rendered without the card that was just marked.
  const focusAfter = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const target = focusAfter.current
    if (target === undefined) return
    focusAfter.current = undefined
    const accept = target
      ? gridRef.current?.querySelector<HTMLElement>(`[data-iso2="${target}"] [data-accept]`)
      : null
    ;(accept ?? headingRef.current)?.focus()
  }, [review])

  /** Resolves true when the mark reached the file. */
  async function save(iso2: string, status: ReviewStatus | null, note: string): Promise<boolean> {
    try {
      const res = await fetch('/dev/stamps/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iso2, status, note }),
      })
      if (!res.ok) return false
      if (s.filter === 'unmarked' && status) {
        const i = shown.findIndex((r) => r.iso2 === iso2)
        focusAfter.current = (shown[i + 1] ?? shown[i - 1])?.iso2 ?? null
      }
      setReview((await res.json()) as ReviewFile)
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="stamp-sheet" lang={s.locale}>
      <h1>{t('Passport stamps (development only)', 'Штампы паспорта (только для разработки)')}</h1>
      <div className="stamp-sheet-controls">
        <SegmentedControl
          label={t('Theme', 'Тема')}
          value={s.theme}
          onChange={(v) => set('theme', v)}
          options={[
            { value: 'light', label: t('Light', 'Светлая') },
            { value: 'dark', label: t('Dark', 'Тёмная') },
          ]}
        />
        <SegmentedControl
          label={t('Language', 'Язык')}
          value={s.locale}
          onChange={(v) => set('locale', v)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ru', label: 'Русский' },
          ]}
        />
        <SegmentedControl
          label={t('Size', 'Размер')}
          value={String(s.size)}
          onChange={(v) => set('size', v === '96' ? 96 : 160)}
          options={[
            { value: '96', label: '96' },
            { value: '160', label: t('Card', 'Карточка') },
          ]}
        />
        <SegmentedControl
          label={t('Impression', 'Оттиск')}
          value={s.worn ? 'on' : 'off'}
          onChange={(v) => set('worn', v === 'on')}
          options={[
            { value: 'on', label: t('Worn', 'С износом') },
            { value: 'off', label: t('Clean', 'Чистый') },
          ]}
        />
        <SegmentedControl
          label={t('Compare', 'Сравнение')}
          value={s.compare ? 'on' : 'off'}
          onChange={(v) => set('compare', v === 'on')}
          options={[
            { value: 'off', label: t('Single', 'Один') },
            { value: 'on', label: t('Worn | clean', 'Износ | чистый') },
          ]}
        />
        <SegmentedControl
          label={t('Filter', 'Фильтр')}
          value={s.filter}
          onChange={(v) => set('filter', v)}
          options={[
            { value: 'all', label: t('All', 'Все') },
            { value: 'unmarked', label: t('Unmarked', 'Без отметки') },
            { value: 'redo', label: t('Redo', 'Переделать') },
            { value: 'accepted', label: t('Accepted', 'Принято') },
          ]}
        />
      </div>

      <section>
        <h2 ref={headingRef} tabIndex={-1}>
          {t('Recipes and fallback examples', 'Рецепты и запасные примеры')}
        </h2>
        <div className="stamp-sheet-grid" ref={gridRef}>
          {shown.map((row) => (
            <Card
              key={row.iso2}
              row={row}
              s={s}
              title={fullName(row.iso2, s.locale)}
              mark={review[row.iso2]}
              onSave={save}
              t={t}
            />
          ))}
          {shown.length === 0 ? <p>{t('Nothing matches.', 'Ничего не подходит.')}</p> : null}
        </div>
      </section>

      <section>
        <h2>{t('Worst-case ring names', 'Самые длинные названия на кольце')}</h2>
        {(['en', 'ru'] as const).map((loc) => (
          <div key={loc} className="stamp-sheet-worst">
            {longestNames(loc, 3).map((code) => (
              <div key={code} className="stamp-sheet-worst-name">
                <p>
                  {loc.toUpperCase()} · {fullName(code, loc)}
                </p>
                <div className="stamp-sheet-row">
                  {SHAPE_NAMES.map((shape) => (
                    <CountryStamp
                      key={shape}
                      iso2={code}
                      locale={loc}
                      status="inked"
                      size={s.size === 96 ? 96 : 160}
                      shape={shape}
                      worn={s.worn}
                      static
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}

function Card({
  row,
  s,
  title,
  mark,
  onSave,
  t,
}: {
  row: Row
  s: SheetState
  title: string
  mark: ReviewFile[string] | undefined
  onSave: (iso2: string, status: ReviewStatus | null, note: string) => Promise<boolean>
  t: (en: string, rus: string) => string
}) {
  const meta = stampMeta(row.iso2)
  // Built in the click handler, so markup never carries it during SSR; the timestamp keeps a replay after a reload from hitting the session's pressed memory.
  const [impressionId, setImpressionId] = useState<string>()
  const [note, setNote] = useState(mark?.note ?? '')
  const [failed, setFailed] = useState(false)
  async function commit(status: ReviewStatus | null, text: string) {
    const ok = await onSave(row.iso2, status, text)
    setFailed(!ok)
    return ok
  }
  const common = { iso2: row.iso2, locale: s.locale, size: s.size } as const
  const strip = 64
  return (
    <article className="stamp-sheet-card" data-iso2={row.iso2} data-review={mark?.status}>
      <header>
        <h3>
          {row.iso2} · {title}
        </h3>
        <p>
          {meta.shape} · {meta.ink} · {meta.cluster ?? t('no cluster', 'без кластера')} ·{' '}
          {row.kind === 'recipe' ? meta.tier : t('fallback example', 'запасной пример')}
        </p>
        <p data-lint={row.issues.length ? 'fail' : 'ok'}>
          {row.issues.length
            ? row.issues.join('; ')
            : row.kind === 'recipe'
              ? t('Lint: inside the window', 'Линтер: в пределах окна')
              : t('Lint: no recipe', 'Линтер: рецепта нет')}
        </p>
      </header>
      <div
        className="stamp-sheet-row stamp-sheet-main"
        data-stamp-host
        role="group"
        tabIndex={0}
        aria-label={t(`Stamp ${row.iso2}`, `Штамп ${row.iso2}`)}
      >
        {s.compare ? (
          <>
            <figure>
              <CountryStamp
                {...common}
                status="inked"
                impressionId={impressionId && `${impressionId}-w`}
                worn
              />
              <figcaption>{t('Worn', 'Износ')}</figcaption>
            </figure>
            <figure>
              <CountryStamp
                {...common}
                status="inked"
                impressionId={impressionId && `${impressionId}-c`}
                worn={false}
              />
              <figcaption>{t('Clean', 'Чистый')}</figcaption>
            </figure>
          </>
        ) : (
          <CountryStamp {...common} status="inked" impressionId={impressionId} worn={s.worn} />
        )}
      </div>
      <div className="stamp-sheet-row stamp-sheet-strip">
        {(
          [
            ['rest', t('Rest', 'Покой'), undefined, 'inked'],
            ['hover', t('Straight', 'Прямо'), 'hover', 'inked'],
            ['press', t('Pressed', 'Нажатие'), 'press', 'inked'],
            ['pending', t('Pending', 'Ожидает'), undefined, 'pending'],
          ] as const
        ).map(([key, label, pose, status]) => (
          <figure key={key}>
            <CountryStamp
              iso2={row.iso2}
              locale={s.locale}
              size={strip}
              status={status}
              pose={pose}
              static={!pose}
              worn={s.worn}
            />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
        <Button dense onClick={() => setImpressionId(`dev-${row.iso2}-${Date.now().toString(36)}`)}>
          {t('Replay impression', 'Повторить оттиск')}
        </Button>
      </div>
      <div className="stamp-sheet-review">
        <div className="stamp-sheet-row">
          <Button
            dense
            variant={mark?.status === 'accepted' ? 'primary' : 'secondary'}
            aria-pressed={mark?.status === 'accepted'}
            data-accept
            onClick={() => void commit('accepted', note)}
          >
            {t('Accept', 'Принять')}
          </Button>
          <Button
            dense
            variant={mark?.status === 'redo' ? 'primary' : 'secondary'}
            aria-pressed={mark?.status === 'redo'}
            onClick={() => void commit('redo', note)}
          >
            {t('Redo', 'Переделать')}
          </Button>
          {mark ? (
            <Button
              dense
              variant="ghost"
              onClick={() =>
                void commit(null, '').then((ok) => {
                  if (ok) setNote('')
                })
              }
            >
              {t('Clear', 'Сбросить')}
            </Button>
          ) : null}
        </div>
        <textarea
          aria-label={t(`Note for ${row.iso2}`, `Заметка для ${row.iso2}`)}
          placeholder={t('Note for the next batch', 'Заметка для следующей партии')}
          value={note}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (mark?.note ?? '')) void commit(mark?.status ?? null, note)
          }}
        />
        <p className="stamp-sheet-error" role="alert">
          {failed
            ? t('Could not save. Try again.', 'Не удалось сохранить. Попробуйте ещё раз.')
            : null}
        </p>
      </div>
    </article>
  )
}
