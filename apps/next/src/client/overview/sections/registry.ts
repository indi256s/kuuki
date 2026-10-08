'use client'

import { createElement, type ComponentType } from 'react'
import type { Gate, OverviewScope } from '@kuuki/shared/overview/figures'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { Skeleton } from '../../ui/skeleton'
import { useOverview } from '../store/overview-context'
import { t } from '../copy'

export type Copy = { en: string; ru: string }
export type Span = 'narrow' | 'wide' | 'full' | 'sheet'
type Entry = { title: Copy; Section: ComponentType<{ span: Span }>; Tile: ComponentType; gate: (scope: OverviewScope) => Gate<unknown> | null }
function pending(title: Copy, gate: Entry['gate']): Entry {
  function Placeholder({ span }: { span: Span }) {
    const { locale } = useOverview()
    const label = t(title, locale)
    return createElement('div', { 'data-span': span }, createElement('h2', null, label),
      createElement(Skeleton, { height: span === 'narrow' ? 240 : 280, label }))
  }
  function Tile() {
    const { locale } = useOverview()
    const label = t(title, locale)
    return createElement('div', null, createElement('h2', null, label), createElement(Skeleton, { height: 96, label }))
  }
  return { title, Section: Placeholder, Tile, gate }
}
export const SECTIONS: Record<SectionId, Entry> = {
  rankings: pending({ en: 'Rankings', ru: 'Рейтинги' }, () => null),
  records: pending({ en: 'Records', ru: 'Рекорды' }, scope => scope.records),
  manufacturers: pending({ en: 'Manufacturers', ru: 'Производители' }, scope => scope.makers),
  fleet: pending({ en: 'Fleet', ru: 'Парк' }, scope => scope.fleet),
  clock: pending({ en: 'Clock', ru: 'Часы' }, scope => scope.clock),
  rhythm: pending({ en: 'Rhythm', ru: 'Ритм' }, scope => scope.rhythm),
  crossings: pending({ en: 'Crossings', ru: 'Пересечения' }, scope => scope.crossings),
}
