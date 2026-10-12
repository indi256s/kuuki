'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { SectionLoading } from './section-loading'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import type { TileSpan } from '../mobile/tiles'

import { Tile as rankingsTile } from './rankings/tile'
import { Tile as routesTile } from './routes/tile'
import { Tile as recordsTile } from './records/tile'
import { Tile as clockTile } from './clock/tile'
import { Tile as rhythmTile } from './rhythm/tile'
import { Tile as crossingsTile } from './crossings/tile'
import { Tile as aircraftTile } from './aircraft/tile'
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
    Tile: rankingsTile,
  },
  routes: {
    title: { en: 'Routes', ru: 'Маршруты' },
    Section: dynamic(() => import('./routes/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: routesTile,
  },
  records: {
    title: { en: 'Records', ru: 'Рекорды' },
    Section: dynamic(() => import('./records/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: recordsTile,
  },
  crossings: {
    title: { en: 'Continents', ru: 'Континенты' },
    Section: dynamic(() => import('./crossings/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: crossingsTile,
  },
  rhythm: {
    title: { en: 'Rhythm', ru: 'Ритм' },
    Section: dynamic(() => import('./rhythm/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: rhythmTile,
  },
  clock: {
    title: { en: 'Clock', ru: 'Часы' },
    Section: dynamic(() => import('./clock/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: clockTile,
  },
  aircraft: {
    title: { en: 'Aircraft', ru: 'Самолёты' },
    Section: dynamic(() => import('./aircraft/section').then((module) => module.Section), {
      loading: SectionLoading,
    }),
    Tile: aircraftTile,
  },
}
