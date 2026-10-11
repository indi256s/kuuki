'use client'

import type { ComponentType } from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'

import { Section as rankingsSection } from './rankings/section'
import { Tile as rankingsTile } from './rankings/tile'
import { Section as routesSection } from './routes/section'
import { Tile as routesTile } from './routes/tile'
import { Section as recordsSection } from './records/section'
import { Tile as recordsTile } from './records/tile'
import { Section as clockSection } from './clock/section'
import { Tile as clockTile } from './clock/tile'
import { Section as rhythmSection } from './rhythm/section'
import { Tile as rhythmTile } from './rhythm/tile'
import { Section as crossingsSection } from './crossings/section'
import { Tile as crossingsTile } from './crossings/tile'
import { Section as aircraftSection } from './aircraft/section'
import { Tile as aircraftTile } from './aircraft/tile'
export type Copy = { en: string; ru: string }
export type Span = 'full' | 'sheet'
type Entry = {
  title: Copy
  Section: ComponentType<{ span: Span }>
  Tile: ComponentType
}
export const SECTIONS: Record<SectionId, Entry> = {
  rankings: {
    title: { en: 'Rankings', ru: 'Рейтинги' },
    Section: rankingsSection,
    Tile: rankingsTile,
  },
  routes: {
    title: { en: 'Routes', ru: 'Маршруты' },
    Section: routesSection,
    Tile: routesTile,
  },
  records: {
    title: { en: 'Records', ru: 'Рекорды' },
    Section: recordsSection,
    Tile: recordsTile,
  },
  crossings: {
    title: { en: 'Crossings', ru: 'Пересечения' },
    Section: crossingsSection,
    Tile: crossingsTile,
  },
  rhythm: {
    title: { en: 'Rhythm', ru: 'Ритм' },
    Section: rhythmSection,
    Tile: rhythmTile,
  },
  clock: {
    title: { en: 'Clock', ru: 'Часы' },
    Section: clockSection,
    Tile: clockTile,
  },
  aircraft: {
    title: { en: 'Aircraft', ru: 'Самолёты' },
    Section: aircraftSection,
    Tile: aircraftTile,
  },
}
