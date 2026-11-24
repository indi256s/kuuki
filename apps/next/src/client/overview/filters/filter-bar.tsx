'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Plus } from '../../ui/animated-icons'
import { formatNumber } from '../../../lib/format'
import { useOverview } from '../store/overview-context'
import { Chip } from '../../ui/chip'
import { Button } from '../../ui/button'
import { SegmentedControl } from '../../ui/segmented-control'
import { S, t } from '../copy'
import type { FilterFacet } from './chip-label'
import { FilterPanel } from './filter-panel'
import { periodLabel, periodName } from './period-label'
import { useAppliedFacets } from './use-applied-facets'
import './filters.css'

export function FilterBar() {
  const { filter, locale, isCurrent, payload, scope, actions } = useOverview()
  const hasGround = (payload?.ground.length ?? 0) > 0
  const travelScope = scope?.figures.scope ?? 'all'
  const facets = useAppliedFacets().filter(({ facet }) => facet !== 'period')
  const conditions = facets.length + (filter.period ? 1 : 0)
  const bar = useRef<HTMLDivElement>(null),
    chips = useRef<HTMLDivElement>(null),
    overflow = useRef<HTMLButtonElement>(null),
    reset = useRef<HTMLButtonElement>(null)
  const [shown, setShown] = useState(Infinity)
  const focusAfter = useRef<string | null>(null)
  useLayoutEffect(() => {
    const key = focusAfter.current
    if (!key) return
    focusAfter.current = null
    const target =
      key === 'add'
        ? null
        : chips.current?.querySelector<HTMLElement>(
            `[data-filter-chip="${key}"]:not([hidden]) .ui-chip-remove`,
          )
    ;(target ?? bar.current?.querySelector<HTMLElement>('.ov-filter-add'))?.focus()
  })
  const [panel, setPanel] = useState<{ anchor: HTMLElement; facet?: FilterFacet } | null>(null)
  const open = (anchor: HTMLElement, facet?: FilterFacet) => {
    if (!isCurrent()) return
    anchor.focus()
    setPanel({ anchor, facet })
  }
  useLayoutEffect(() => {
    const node = bar.current
    if (!node) return
    const corner = node.parentElement,
      right = node.closest('.globe-card')?.querySelector<HTMLElement>('.globe-top-right')
    const measure = () => {
      if (right)
        corner?.style.setProperty(
          '--ov-filter-reserve',
          `${right.getBoundingClientRect().width + 12}px`,
        )
      const row = chips.current
      if (!row) return
      const items = [...row.querySelectorAll<HTMLElement>('[data-filter-chip]')],
        more = overflow.current
      const trailing = () => reset.current ?? (more && !more.hidden ? more : null)
      const focused = document.activeElement
      items.forEach((item) => {
        item.hidden = false
      })
      if (more) more.hidden = true
      const middle = (item: Element) => {
        const rect = item.getBoundingClientRect()
        return Math.round(rect.top + rect.height / 2)
      }
      const tops = [...new Set([...row.children].filter(visibleBox).map(middle))].sort(
        (a, b) => a - b,
      )
      if (!tops.length) {
        setShown(Infinity)
        return
      }
      const second = tops[1] ?? tops[0]
      const fits = (count: number) => {
        const end = trailing()
        return (
          (count === 0 || middle(items[count - 1]) <= second) && (!end || middle(end) <= second)
        )
      }
      let count = items.length
      while (count > 0 && !fits(count)) {
        count--
        items.forEach((item, position) => {
          item.hidden = position >= count
        })
        if (more) more.hidden = false
      }
      if (more) more.hidden = count === items.length
      if (items.some((item) => item.hidden && item.contains(focused))) more?.focus()
      setShown((old) => (old === count ? old : count))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    if (right) observer?.observe(right)
    window.addEventListener('resize', measure)
    document.fonts?.addEventListener('loadingdone', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      document.fonts?.removeEventListener('loadingdone', measure)
    }
  }, [filter, locale, hasGround])
  const visible = Math.min(shown, facets.length),
    remaining = facets.length - visible
  return (
    <>
      <div
        className="ov-filter-bar"
        ref={bar}
        role="group"
        aria-label={locale === 'ru' ? 'Фильтры обзора' : 'Overview filters'}
      >
        <div className="ov-filter-controls">
          {hasGround ? (
            <SegmentedControl
              toolbar
              label={t(S.scopeLabel, locale)}
              value={travelScope}
              onChange={(next) => {
                if (isCurrent()) actions.setScope(next === 'all' ? null : next)
              }}
              options={[
                { value: 'all', label: t(S.scopeAll, locale) },
                { value: 'flights', label: t(S.scopeFlights, locale) },
                { value: 'ground', label: t(S.scopeGround, locale) },
              ]}
            />
          ) : null}
          <Button
            className="ov-filter-period"
            aria-label={periodName(filter.period, locale)}
            data-active={filter.period ? '' : undefined}
            onClick={(event) => open(event.currentTarget, 'period')}
          >
            {periodLabel(filter.period, locale)}
          </Button>
          <Button className="ov-filter-add" onClick={(event) => open(event.currentTarget)}>
            <Plus size={16} aria-hidden="true" />
            {locale === 'ru' ? 'Фильтр' : 'Filter'}
          </Button>
        </div>
        {facets.length ? (
          <div className="ov-filter-chips" ref={chips}>
            {facets.map(({ facet, label, swatch, removeLabel, remove }, position) => (
              <span key={facet} data-filter-chip={facet} hidden={position >= visible}>
                <Chip
                  label={label}
                  swatch={swatch}
                  onOpen={() => {
                    const anchor = chips.current?.querySelector<HTMLElement>(
                      `[data-filter-chip="${facet}"] .ui-chip-body`,
                    )
                    if (anchor) open(anchor, facet)
                  }}
                  onRemove={() => {
                    if (!isCurrent()) return
                    focusAfter.current =
                      facets[position + 1]?.facet ?? facets[position - 1]?.facet ?? 'add'
                    remove()
                  }}
                  removeLabel={removeLabel}
                />
              </span>
            ))}
            <Button
              ref={overflow}
              hidden={!remaining}
              className="ov-filter-overflow"
              aria-label={
                locale === 'ru'
                  ? `Ещё фильтров: ${formatNumber(locale, remaining)}`
                  : `${formatNumber(locale, remaining)} more filters`
              }
              onClick={(event) => open(event.currentTarget)}
            >
              +{formatNumber(locale, remaining)}
            </Button>
            {conditions > 1 ? (
              <Button
                ref={reset}
                variant="ghost"
                className="ov-filter-reset"
                onClick={() => {
                  if (!isCurrent()) return
                  focusAfter.current = 'add'
                  actions.clear()
                }}
              >
                {locale === 'ru' ? 'Сбросить всё' : 'Clear all'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {panel ? (
        <FilterPanel
          key={panel.facet ?? 'all'}
          anchor={panel.anchor}
          initialFacet={panel.facet}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </>
  )
}

const visibleBox = (item: Element) =>
  item instanceof HTMLElement && !item.hidden && item.getClientRects().length > 0
