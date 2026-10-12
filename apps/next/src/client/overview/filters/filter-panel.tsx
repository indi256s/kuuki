'use client'

import { Anchor } from '@radix-ui/react-popover'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatNumber } from '../../../lib/format'
import { referenceLabels } from '../labels'
import { useOverview } from '../store/overview-context'
import { Button } from '../../ui/button'
import { PopoverRoot, PopoverContent } from '../../ui/popover'
import { Sheet } from '../../ui/sheet'
import { periodDays } from '@kuuki/shared/overview/range'
import { DateRangePicker, type DateRangeValue } from '../../ui/date-range-picker'
import { MakerSwatch, AllianceMark } from '../../ui/category-mark'
import { useMobile } from '../../ui/use-mobile'
import { facetName, type FilterFacet } from './chip-label'
import {
  buildFacetIndex,
  FACET_ORDER,
  searchFacets,
  topPicks,
  type FacetOption,
} from './facet-index'
import './filters.css'

export function FilterPanel({
  anchor,
  initialFacet,
  onClose,
}: {
  anchor: HTMLElement
  initialFacet?: FilterFacet
  onClose: () => void
}) {
  const { payload, filter, actions, locale, isCurrent } = useOverview()
  const mobile = useMobile(),
    id = useId(),
    input = useRef<HTMLInputElement>(null)
  const fallback = useRef(
    anchor.closest('.ov-filter-bar')?.querySelector<HTMLElement>('.ov-filter-add') ?? null,
  )
  const closing = useRef(false)
  const close = () => {
    closing.current = true
    onClose()
  }
  const anchorAvailable = () => anchor.isConnected && !anchor.closest('[hidden]')
  const restoreTarget = () =>
    anchorAvailable()
      ? anchor
      : fallback.current?.isConnected
        ? fallback.current
        : document.querySelector<HTMLElement>('main h1, .ov3-page h1')
  const [query, setQuery] = useState(''),
    [facet, setFacet] = useState(initialFacet)
  const [browse, setBrowse] = useState(false),
    [custom, setCustom] = useState(false),
    [active, setActive] = useState(0)
  const period = filter.period && 'from' in filter.period ? filter.period : null
  const source = JSON.stringify(period)
  const [rangeDraft, setRangeDraft] = useState<{ source: string; value: DateRangeValue } | null>(
    null,
  )
  const [rangeError, setRangeError] = useState('')
  const range =
    rangeDraft?.source === source
      ? rangeDraft.value
      : (period && periodDays(period)) || { from: '', to: '' }
  const dailyAvailable = payload?.mode !== 'aggregate' || payload.aggregateResolution === 'day'
  const index = useMemo(
    () => (payload ? buildFacetIndex(payload, referenceLabels(locale), locale) : []),
    [payload, locale],
  )
  const searching = query.trim().length > 0
  const groups = searching
    ? searchFacets(index, query, locale)
    : [{ facet: 'period' as const, options: topPicks(index) }]
  const results = groups.flatMap((group) => group.options)
  const activeIndex = Math.min(active, results.length - 1)
  useEffect(() => {
    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [id, activeIndex, query])
  const selected = (option: FacetOption) =>
    option.facet === 'period'
      ? !!filter.period &&
        'years' in filter.period &&
        filter.period.years.includes(Number(option.value))
      : !!filter[option.facet]?.some((value) => String(value) === option.value)
  const toggle = (option: FacetOption) => {
    if (!isCurrent()) return
    const key = option.facet
    if (key === 'period') {
      if (!/^\d{1,4}$/.test(option.value)) return
      const year = Number(option.value),
        old = filter.period && 'years' in filter.period ? filter.period.years : []
      const years = old.includes(year) ? old.filter((value) => value !== year) : [...old, year]
      actions.setPeriod(years.length ? { years } : null)
    } else if (key === 'depHours' || key === 'arrHours') {
      const hour = Number(option.value)
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) return
      if (selected(option)) actions.remove(key, hour)
      else actions.add(key, hour)
    } else if (key === 'months') {
      const month = Number(option.value)
      if (!Number.isInteger(month) || month < 1 || month > 12) return
      if (selected(option)) actions.remove(key, month)
      else actions.add(key, month)
    } else {
      if (selected(option)) actions.remove(key, option.value)
      else actions.add(key, option.value)
    }
  }
  const mark = (option: FacetOption) =>
    option.mark?.kind === 'maker' ? (
      <MakerSwatch maker={option.mark.key} />
    ) : option.mark?.kind === 'alliance' ? (
      <AllianceMark alliance={option.mark.key} />
    ) : null
  const details = (option: FacetOption) => (
    <>
      {mark(option)}
      <span className="ov-filter-option-text">
        <span>{option.label}</span>
        {option.sublabel ? <small>{option.sublabel}</small> : null}
      </span>
      <span className="ov-filter-count">{formatNumber(locale, option.count)}</span>
    </>
  )
  const title = locale === 'ru' ? 'Фильтры' : 'Filters'
  const body = (
    <div className="ov-filter-content" lang={locale}>
      <label className="ov-filter-search" htmlFor={`${id}-search`}>
        {locale === 'ru' ? 'Поиск по всем фильтрам' : 'Search all filters'}
      </label>
      <input
        id={`${id}-search`}
        ref={input}
        className="ui-field-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={searching || (!facet && !browse)}
        aria-controls={searching || (!facet && !browse) ? `${id}-results` : undefined}
        aria-activedescendant={
          (searching || (!facet && !browse)) && activeIndex >= 0
            ? `${id}-option-${activeIndex}`
            : undefined
        }
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (!searching && (facet || browse)) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (results.length)
              setActive(
                (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
                  results.length,
              )
          } else if (event.key === 'Enter' && results[activeIndex]) {
            event.preventDefault()
            toggle(results[activeIndex])
          }
        }}
      />
      {searching || (!facet && !browse) ? (
        <>
          {!searching ? <h3>{locale === 'ru' ? 'Чаще всего' : 'Top picks'}</h3> : null}
          <div
            id={`${id}-results`}
            role="listbox"
            aria-label={searching ? title : locale === 'ru' ? 'Чаще всего' : 'Top picks'}
            aria-multiselectable="true"
          >
            {groups.map((group) => (
              <div
                key={group.facet}
                role="group"
                aria-label={searching ? facetName(group.facet, locale) : title}
              >
                {searching ? <h3>{facetName(group.facet, locale)}</h3> : null}
                {group.options.map((option) => {
                  const position = results.indexOf(option)
                  return (
                    <div
                      key={`${option.facet}:${option.value}`}
                      id={`${id}-option-${position}`}
                      role="option"
                      aria-selected={selected(option)}
                      className="ov-filter-option"
                      data-active={position === activeIndex}
                      onPointerDown={(event) => event.preventDefault()}
                      onPointerMove={() => setActive(position)}
                      onClick={() => {
                        toggle(option)
                        input.current?.focus()
                      }}
                    >
                      <span className="ov-filter-check" aria-hidden="true">
                        {selected(option) ? '✓' : ''}
                      </span>
                      {details(option)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {!results.length ? (
            <p role="status">{locale === 'ru' ? 'Ничего не найдено' : 'No results'}</p>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => {
              setQuery('')
              setFacet(undefined)
              setBrowse(true)
            }}
          >
            {locale === 'ru' ? 'Все фильтры ›' : 'Browse all facets ›'}
          </Button>
        </>
      ) : facet ? (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setFacet(undefined)
              setBrowse(true)
              setCustom(false)
            }}
          >
            {locale === 'ru' ? '‹ Все фильтры' : '‹ All facets'}
          </Button>
          <h3>{facetName(facet, locale)}</h3>
          {index
            .filter((option) => option.facet === facet)
            .map((option) => (
              <label className="ov-filter-option" key={option.value}>
                <input type="checkbox" checked={selected(option)} onChange={() => toggle(option)} />
                {details(option)}
              </label>
            ))}
          {facet === 'period' ? (
            <>
              <Button
                variant="ghost"
                aria-expanded={custom || (!!filter.period && 'from' in filter.period)}
                onClick={() => setCustom((value) => !value)}
              >
                {locale === 'ru' ? 'Свой диапазон' : 'Custom range'}
              </Button>
              {!dailyAvailable ? (
                <p role="status">
                  {locale === 'ru'
                    ? 'Точные даты недоступны в старой сводке. Обновите страницу.'
                    : 'Exact dates are unavailable in this older summary. Refresh the page.'}
                </p>
              ) : null}
              {custom || (filter.period && 'from' in filter.period) ? (
                <DateRangePicker
                  locale={locale}
                  {...range}
                  disabled={!dailyAvailable}
                  error={rangeError}
                  onChange={(value) => {
                    setRangeDraft({ source, value })
                    setRangeError('')
                  }}
                  onApply={() => {
                    const days = periodDays(range)
                    if (!days) {
                      setRangeError(
                        locale === 'ru'
                          ? 'Укажите обе даты в правильном порядке.'
                          : 'Enter both dates in chronological order.',
                      )
                      return
                    }
                    if (isCurrent() && dailyAvailable) {
                      actions.setPeriod(days)
                      setRangeDraft(null)
                      setRangeError('')
                    }
                  }}
                  onClear={() => {
                    if (isCurrent()) {
                      actions.setPeriod(null)
                      setRangeDraft(null)
                      setRangeError('')
                    }
                  }}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <div className="ov-filter-facets">
          {FACET_ORDER.map((key) => (
            <Button
              key={key}
              variant="ghost"
              onClick={() => {
                setFacet(key)
                setCustom(false)
              }}
            >
              {facetName(key, locale)} ›
            </Button>
          ))}
        </div>
      )}
    </div>
  )
  if (mobile === null) return null
  const closeLabel = locale === 'ru' ? 'Закрыть' : 'Close'
  if (mobile)
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={title}
        closeLabel={closeLabel}
        className="ov-filter-sheet"
        initialFocusRef={input}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (closing.current && isCurrent()) restoreTarget()?.focus()
        }}
      >
        {body}
      </Sheet>
    )
  return (
    <PopoverRoot
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Anchor
        virtualRef={{
          current: {
            getBoundingClientRect: () =>
              (anchorAvailable() ? anchor : (fallback.current ?? anchor)).getBoundingClientRect(),
          },
        }}
      />
      <PopoverContent
        className="ov-filter-popover"
        aria-label={title}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          input.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          if (
            !anchorAvailable() &&
            isCurrent() &&
            (document.activeElement === document.body ||
              (event.target instanceof HTMLElement &&
                event.target.contains(document.activeElement)))
          ) {
            event.preventDefault()
            restoreTarget()?.focus()
          }
        }}
      >
        <div className="ov-filter-heading">
          <strong>{title}</strong>
          <Button variant="ghost" onClick={close}>
            {closeLabel}
          </Button>
        </div>
        {body}
      </PopoverContent>
    </PopoverRoot>
  )
}
