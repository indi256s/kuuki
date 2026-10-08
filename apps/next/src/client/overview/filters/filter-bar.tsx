'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { formatPeriodDate, formatNumber } from '../../../lib/format'
import { referenceLabels } from '../labels'
import { scopeTitle } from '../page/scope-title'
import { useOverview } from '../store/overview-context'
import { Chip } from '../../ui/chip'
import { Button } from '../../ui/button'
import { MakerSwatch, AllianceMark } from '../../ui/category-mark'
import { chipLabel, type FilterFacet } from './chip-label'
import { buildFacetIndex, FACET_ORDER } from './facet-index'
import { FilterPanel } from './filter-panel'
import './filters.css'

export function FilterBar() {
  const { filter, payload, locale, actions, isCurrent } = useOverview()
  const labels = useMemo(() => referenceLabels(locale), [locale])
  const index = useMemo(() => payload ? buildFacetIndex(payload, labels, locale) : [], [payload, labels, locale])
  const facets = FACET_ORDER.filter(facet => facet === 'period'
    ? !!filter.period && (!('years' in filter.period) || filter.period.years.length > 0) : !!filter[facet]?.length)
  const bar = useRef<HTMLDivElement>(null), overflow = useRef<HTMLButtonElement>(null)
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
    const corner = node.parentElement, right = node.closest('.globe-card')?.querySelector<HTMLElement>('.globe-top-right')
    const measure = () => {
      corner?.style.setProperty('--ov-filter-reserve', `${right ? right.getBoundingClientRect().width + 12 : 0}px`)
      const items = [...node.querySelectorAll<HTMLElement>('[data-filter-chip]')], more = overflow.current
      const focused = document.activeElement
      // Measure the actual wrapped controls before paint; collapsed controls use native hidden.
      items.forEach(item => { item.hidden = false })
      if (more) more.hidden = true
      const tops = [...new Set([...node.children].filter(item => item instanceof HTMLElement && !item.hidden)
        .map(item => item.getBoundingClientRect().top))].sort((a, b) => a - b)
      const second = tops[1] ?? tops[0]
      let count = items.findIndex(item => item.getBoundingClientRect().top > second)
      if (count < 0) count = items.length
      if (more && count < items.length) {
        do {
          items.forEach((item, position) => { item.hidden = position >= count })
          more.hidden = false
          if (more.getBoundingClientRect().top <= second || count === 0) break
          count--
        } while (count >= 0)
      }
      items.forEach((item, position) => { item.hidden = position >= count })
      if (more) more.hidden = count === items.length
      if (items.some(item => item.hidden && item.contains(focused))) more?.focus()
      setShown(old => old === count ? old : count)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    if (right) observer?.observe(right)
    window.addEventListener('resize', measure)
    document.fonts?.addEventListener('loadingdone', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); document.fonts?.removeEventListener('loadingdone', measure) }
  }, [filter, locale])
  const visible = Math.min(shown, facets.length), remaining = facets.length - visible
  return <>
    <div className="ov-filter-bar" ref={bar} aria-label={locale === 'ru' ? 'Фильтры обзора' : 'Overview filters'}>
      <Button className="ov-filter-add" onClick={event => open(event.currentTarget)}><Plus size={16} aria-hidden="true" />{locale === 'ru' ? 'Фильтр' : 'Filter'}</Button>
      {!facets.length ? <span className="ov-filter-all">{locale === 'ru' ? 'Все перелёты за всё время' : 'All flights, all time'}</span> : null}
      {facets.map((facet, position) => {
        const values = facet === 'period' ? filter.period && 'years' in filter.period ? filter.period.years
          : filter.period && 'from' in filter.period ? [`${formatPeriodDate(locale, filter.period.from)} – ${formatPeriodDate(locale, filter.period.to)}`] : [] : filter[facet] ?? []
        const label = chipLabel(facet, values, labels, locale)
        const option = values.length === 1 ? index.find(option => option.facet === facet && option.value === String(values[0])) : undefined
        const mark = option?.mark?.kind === 'maker' ? <MakerSwatch maker={option.mark.key} /> : option?.mark?.kind === 'alliance' ? <AllianceMark alliance={option.mark.key} /> : undefined
        const removal = scopeTitle({ [facet]: filter[facet] }, labels, locale).slice(3)
        return <span key={facet} data-filter-chip={facet} hidden={position >= visible}>
          <Chip label={`${label.name} · ${label.values}${label.more ? ` +${formatNumber(locale, label.more)}` : ''}`} swatch={mark}
            onOpen={() => {
              const anchor = bar.current?.querySelector<HTMLElement>(`[data-filter-chip="${facet}"] .ui-chip-body`)
              if (anchor) open(anchor, facet)
            }} onRemove={() => { if (isCurrent()) { if (facet === 'period') actions.setPeriod(null); else actions.removeFacet(facet) } }}
            removeLabel={locale === 'ru' ? `Убрать ${removal}` : `Remove ${removal}`} />
        </span>
      })}
      <Button ref={overflow} hidden={!remaining} className="ov-filter-overflow"
        aria-label={locale === 'ru' ? `Ещё фильтров: ${formatNumber(locale, remaining)}` : `${formatNumber(locale, remaining)} more filters`}
        onClick={event => open(event.currentTarget)}>+{formatNumber(locale, remaining)}</Button>
    </div>
    {panel ? <FilterPanel key={panel.facet ?? 'all'} anchor={panel.anchor} initialFacet={panel.facet} onClose={() => setPanel(null)} /> : null}
  </>
}
