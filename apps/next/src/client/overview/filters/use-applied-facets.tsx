'use client'

import { useMemo, type ReactNode } from 'react'
import { formatPeriodDate, formatNumber } from '../../../lib/format'
import { referenceLabels } from '../labels'
import { scopeTitle } from '../page/scope-title'
import { useOverview } from '../store/overview-context'
import { MakerSwatch, AllianceMark } from '../../ui/category-mark'
import { chipLabel, type FilterFacet } from './chip-label'
import { buildFacetIndex, FACET_ORDER } from './facet-index'

export type AppliedFacet = {
  facet: FilterFacet
  /** `name · values`, with `+N` when more values are applied than the chip names. */
  label: string
  swatch?: ReactNode
  removeLabel: string
  remove: () => void
}

/** The applied facets as chips, in facet order: the page's filter bar and the mobile sheet's filter row draw the same list. */
export function useAppliedFacets(): AppliedFacet[] {
  const { filter, payload, locale, actions, isCurrent } = useOverview()
  const labels = useMemo(() => referenceLabels(locale, payload?.refs), [locale, payload?.refs])
  const index = useMemo(
    () => (payload ? buildFacetIndex(payload, labels, locale) : []),
    [payload, labels, locale],
  )
  return FACET_ORDER.filter((facet) =>
    facet === 'period'
      ? !!filter.period && (!('years' in filter.period) || filter.period.years.length > 0)
      : !!filter[facet]?.length,
  ).map((facet) => {
    const values =
      facet === 'period'
        ? filter.period && 'years' in filter.period
          ? filter.period.years
          : filter.period && 'from' in filter.period
            ? [
                `${formatPeriodDate(locale, filter.period.from)} – ${formatPeriodDate(locale, filter.period.to)}`,
              ]
            : []
        : (filter[facet] ?? [])
    const label = chipLabel(facet, values, labels, locale)
    const option =
      values.length === 1
        ? index.find((option) => option.facet === facet && option.value === String(values[0]))
        : undefined
    const removal = scopeTitle({ [facet]: filter[facet] }, labels, locale).slice(3)
    return {
      facet,
      label: `${label.name} · ${label.values}${label.more ? ` +${formatNumber(locale, label.more)}` : ''}`,
      swatch:
        option?.mark?.kind === 'maker' ? (
          <MakerSwatch maker={option.mark.key} />
        ) : option?.mark?.kind === 'alliance' ? (
          <AllianceMark alliance={option.mark.key} />
        ) : undefined,
      removeLabel: locale === 'ru' ? `Убрать ${removal}` : `Remove ${removal}`,
      remove: () => {
        if (!isCurrent()) return
        if (facet === 'period') actions.setPeriod(null)
        else actions.removeFacet(facet)
      },
    }
  })
}
