'use client'

import { createElement, type ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { SectionLoading } from './section-loading'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import type { TileSpan } from '../mobile/tiles'

import { Skeleton } from '../../ui/skeleton'
import { useLocale } from '../../preferences'

// Tiles have their own code path: desktop chapters never need the mobile preview drawings.
function TileLoading() {
  const locale = useLocale()
  return createElement(Skeleton, {
    height: 128,
    label: locale === 'ru' ? 'Загружаем…' : 'Loading…',
  })
}
export type Copy = { en: string; ru: string }
export type Span = 'full' | 'sheet'
type Entry = {
  title: Copy
  Section: ComponentType<{ span: Span }>
  Tile: ComponentType<{ span: TileSpan }>
}
export const SECTIONS: Record<SectionId, Entry> = {
  rankings: {
    title: { en: 'Rankings', ru: 'Рейтинги' },
    Section: dynamic(() => import('./rankings/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: dynamic(() => import('./rankings/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  routes: {
    title: { en: 'Routes', ru: 'Маршруты' },
    Section: dynamic(() => import('./routes/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: dynamic(() => import('./routes/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  records: {
    title: { en: 'Records', ru: 'Рекорды' },
    Section: dynamic(() => import('./records/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: dynamic(() => import('./records/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  crossings: {
    title: { en: 'Continents', ru: 'Континенты' },
    Section: dynamic(() => import('./crossings/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: dynamic(() => import('./crossings/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  rhythm: {
    title: { en: 'Rhythm', ru: 'Ритм' },
    Section: dynamic(() => import('./rhythm/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: dynamic(() => import('./rhythm/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  clock: {
    title: { en: 'Clock', ru: 'Часы' },
    Section: dynamic(() => import('./clock/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: dynamic(() => import('./clock/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  aircraft: {
    title: { en: 'Aircraft', ru: 'Самолёты' },
    Section: dynamic(() => import('./aircraft/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: dynamic(() => import('./aircraft/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
}
