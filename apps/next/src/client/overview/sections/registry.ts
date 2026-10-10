'use client'

import type { ComponentType } from 'react'
import type { Gate, OverviewScope } from '@kuuki/shared/overview/figures'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
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
  gate: (scope: OverviewScope) => Gate<unknown> | null
}
export const SECTIONS: Record<SectionId, Entry> = {
  rankings: {
    title: { en: 'Rankings', ru: 'Рейтинги' },
    Section: rankingsSection,
    Tile: rankingsTile,
    gate: () => null,
  },
  routes: {
    title: { en: 'Routes', ru: 'Маршруты' },
    Section: routesSection,
    Tile: routesTile,
    gate: SECTION_GATES.routes.gate,
  },
  records: {
    title: { en: 'Records', ru: 'Рекорды' },
    Section: recordsSection,
    Tile: recordsTile,
    gate: SECTION_GATES.records.gate,
  },
  crossings: {
    title: { en: 'Crossings', ru: 'Пересечения' },
    Section: crossingsSection,
    Tile: crossingsTile,
    gate: SECTION_GATES.crossings.gate,
  },
  rhythm: {
    title: { en: 'Rhythm', ru: 'Ритм' },
    Section: rhythmSection,
    Tile: rhythmTile,
    gate: SECTION_GATES.rhythm.gate,
  },
  clock: {
    title: { en: 'Clock', ru: 'Часы' },
    Section: clockSection,
    Tile: clockTile,
    gate: SECTION_GATES.clock.gate,
  },
  aircraft: {
    title: { en: 'Aircraft', ru: 'Самолёты' },
    Section: aircraftSection,
    Tile: aircraftTile,
    gate: SECTION_GATES.aircraft.gate,
  },
}
