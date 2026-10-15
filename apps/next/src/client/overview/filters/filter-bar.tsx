'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Plus } from '../../ui/animated-icons'
import { formatNumber } from '../../../lib/format'
import { useOverview } from '../store/overview-context'
import { isAviationFacetNote } from '../store/scope-state'
import { Chip } from '../../ui/chip'
import { Button } from '../../ui/button'
import { SegmentedControl } from '../../ui/segmented-control'
import { S, t } from '../copy'
import type { FilterFacet } from './chip-label'
import { FilterPanel } from './filter-panel'
import { useAppliedFacets } from './use-applied-facets'
import './filters.css'

export function FilterBar() {
  const { filter, locale, isCurrent, payload, scope, actions } = useOverview()
  // The segment exists only with ground data; a stored scope without it is already ignored by the compute.
  const hasGround = (payload?.ground.length ?? 0) > 0
  const travelScope = hasGround ? (scope?.figures.scope ?? 'all') : 'all'
  const aviationNote = !!scope && isAviationFacetNote(scope, filter)
  const facets = useAppliedFacets()
  const bar = useRef<HTMLDivElement>(null),
    overflow = useRef<HTMLButtonElement>(null)
  const [shown, setShown] = useState(0)
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
      right = (
        node.closest('.globe-card') ?? node.closest('.ov3-overview-workspace')
      )?.querySelector<HTMLElement>('.globe-top-right')
    const measure = () => {
      corner?.style.setProperty(
        '--ov-filter-reserve',
        `${right ? right.getBoundingClientRect().width + 12 : 0}px`,
      )
      const items = [...node.querySelectorAll<HTMLElement>('[data-filter-chip]')],
        more = overflow.current
      const focused = document.activeElement
      // Measure the actual wrapped controls before paint; collapsed controls use native hidden.
      items.forEach((item) => {
        item.hidden = false
      })
      if (more) more.hidden = true
      const tops = [
        ...new Set(
          [...node.children]
            .filter(
              (item) =>
                item instanceof HTMLElement && !item.hidden && item.getClientRects().length > 0,
            )
            .map((item) => item.getBoundingClientRect().top),
        ),
      ].sort((a, b) => a - b)
      const second = tops[1] ?? tops[0]
      let count = items.findIndex((item) => item.getBoundingClientRect().top > second)
      if (count < 0) count = items.length
      if (more && count < items.length) {
        do {
          items.forEach((item, position) => {
            item.hidden = position >= count
          })
          more.hidden = false
          if (more.getBoundingClientRect().top <= second || count === 0) break
          count--
        } while (count >= 0)
      }
      items.forEach((item, position) => {
        item.hidden = position >= count
      })
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
        aria-label={locale === 'ru' ? 'Фильтры обзора' : 'Overview filters'}
      >
        {hasGround ? (
          <SegmentedControl
            dense
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
          onClick={(event) => open(event.currentTarget, 'period')}
        >
          {filter.period
            ? locale === 'ru'
              ? 'Период'
              : 'Period'
            : locale === 'ru'
              ? 'За всё время'
              : 'All time'}
        </Button>
        <Button className="ov-filter-add" onClick={(event) => open(event.currentTarget)}>
          <Plus size={16} aria-hidden="true" />
          {locale === 'ru' ? 'Фильтр' : 'Filter'}
        </Button>
        {aviationNote ? (
          <span className="ov-filter-note">{t(S.aviationFacetNote, locale)}</span>
        ) : null}
        {!facets.length ? (
          <span className="ov-filter-all">
            {hasGround && travelScope === 'all'
              ? t(S.summaryAllTravel, locale)
              : hasGround && travelScope === 'ground'
                ? t(S.summaryGround, locale)
                : locale === 'ru'
                  ? 'Все перелёты за всё время'
                  : 'All flights, all time'}
          </span>
        ) : null}
        {facets.map(({ facet, label, swatch, removeLabel, remove }, position) => (
          <span key={facet} data-filter-chip={facet} hidden={position >= visible}>
            <Chip
              label={label}
              swatch={swatch}
              onOpen={() => {
                const anchor = bar.current?.querySelector<HTMLElement>(
                  `[data-filter-chip="${facet}"] .ui-chip-body`,
                )
                if (anchor) open(anchor, facet)
              }}
              onRemove={remove}
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
