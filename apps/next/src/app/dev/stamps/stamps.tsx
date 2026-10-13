'use client'

import './stamps.css'
import { useEffect, useMemo, useState } from 'react'
import { loadRecipes } from '../../../lib/stamp-art/recipes'
import { SHAPE_NAMES } from '../../../lib/stamp-art/frame'
import { lintGeometry } from '../../../lib/stamp-art/lint'
import registry from '../../../lib/stamp-art/registry.json'
import { setTheme } from '../../../client/appearance'
import { countryNamer } from '../../../client/passport/model'
import { CountryStamp } from '../../../client/stamps/country-stamp'
import { emWidth } from '../../../client/stamps/ring-fit'
import { stampMeta } from '../../../client/stamps/stamp-meta'
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

const CODES = (registry as { iso2: string }[]).map((r) => r.iso2)

type Row = { iso2: string; kind: 'recipe' | 'fallback'; issues: string[] }

/** The six recipes, then one fallback example per frame shape. */
function buildRows(): Row[] {
  const recipes = loadRecipes()
  const rows: Row[] = recipes.map((r) => ({
    iso2: r.iso2,
    kind: 'recipe',
    issues: lintGeometry(r).map((i) => i.message),
  }))
  const have = new Set(rows.map((r) => r.iso2))
  for (const shape of SHAPE_NAMES) {
    const iso2 = CODES.find((c) => !have.has(c) && stampMeta(c).shape === shape)
    if (iso2) {
      have.add(iso2)
      rows.push({ iso2, kind: 'fallback', issues: [] })
    }
  }
  return rows
}

/** The longest ring names of the catalog in one locale, by estimated width. */
function longestNames(locale: Locale, count: number): string[] {
  const name = countryNamer(locale)
  return [...CODES]
    .sort(
      (a, b) =>
        emWidth(name(b).toLocaleUpperCase(locale)) - emWidth(name(a).toLocaleUpperCase(locale)),
    )
    .slice(0, count)
}

export function StampSheet({
  initial,
  review: initialReview,
}: {
  initial: SheetState
  review: ReviewFile
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
  const rows = useMemo(() => buildRows(), [])
  const name = useMemo(() => countryNamer(s.locale), [s.locale])
  const shown = rows.filter((r) => {
    const status = review[r.iso2]?.status
    return s.filter === 'all' || (s.filter === 'unmarked' ? !status : status === s.filter)
  })

  async function save(iso2: string, status: ReviewStatus | null, note: string) {
    const res = await fetch('/dev/stamps/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iso2, status, note }),
    })
    if (res.ok) setReview((await res.json()) as ReviewFile)
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
        <h2>{t('Recipes and fallback examples', 'Рецепты и запасные примеры')}</h2>
        <div className="stamp-sheet-grid">
          {shown.map((row) => (
            <Card
              key={row.iso2}
              row={row}
              s={s}
              title={name(row.iso2)}
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
                  {loc.toUpperCase()} · {countryNamer(loc)(code)}
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
  onSave: (iso2: string, status: ReviewStatus | null, note: string) => Promise<void>
  t: (en: string, rus: string) => string
}) {
  const meta = stampMeta(row.iso2)
  const [replay, setReplay] = useState(0)
  const [note, setNote] = useState(mark?.note ?? '')
  const impressionId = replay ? `dev-${row.iso2}-${replay}` : undefined
  const common = { iso2: row.iso2, locale: s.locale, size: s.size } as const
  const strip = 64
  return (
    <article className="stamp-sheet-card" data-stamp-host data-review={mark?.status}>
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
      <div className="stamp-sheet-row stamp-sheet-main">
        {s.compare ? (
          <>
            <figure>
              <CountryStamp {...common} status="inked" impressionId={impressionId} worn />
              <figcaption>{t('Worn', 'Износ')}</figcaption>
            </figure>
            <figure>
              <CountryStamp {...common} status="inked" impressionId={impressionId} worn={false} />
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
            ['hover', t('Hover', 'Наведение'), 'hover', 'inked'],
            ['focus', t('Focus', 'Фокус'), 'focus', 'inked'],
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
              worn={s.worn}
            />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
        <Button dense onClick={() => setReplay((n) => n + 1)}>
          {t('Replay impression', 'Повторить оттиск')}
        </Button>
      </div>
      <div className="stamp-sheet-review">
        <div className="stamp-sheet-row">
          <Button
            dense
            variant={mark?.status === 'accepted' ? 'primary' : 'secondary'}
            onClick={() => void onSave(row.iso2, 'accepted', note)}
          >
            {t('Accept', 'Принять')}
          </Button>
          <Button
            dense
            variant={mark?.status === 'redo' ? 'primary' : 'secondary'}
            onClick={() => void onSave(row.iso2, 'redo', note)}
          >
            {t('Redo', 'Переделать')}
          </Button>
          {mark ? (
            <Button dense variant="ghost" onClick={() => void onSave(row.iso2, null, '')}>
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
            if (mark && note !== (mark.note ?? '')) void onSave(row.iso2, mark.status, note)
          }}
        />
      </div>
    </article>
  )
}
