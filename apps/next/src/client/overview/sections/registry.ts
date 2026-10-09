'use client'

import type { ComponentType } from 'react'
import type { Gate, OverviewScope } from '@kuuki/shared/overview/figures'
import type { SectionId } from '@kuuki/shared/overview/prefs'

import { Section as rankingsSection } from './rankings/section'
import { Tile as rankingsTile } from './rankings/tile'
import { Section as recordsSection } from './records/section'
import { Tile as recordsTile } from './records/tile'
import { Section as manufacturersSection } from './manufacturers/section'
import { Tile as manufacturersTile } from './manufacturers/tile'
import { Section as fleetSection } from './fleet/section'
import { Tile as fleetTile } from './fleet/tile'
import { Section as clockSection } from './clock/section'
import { Tile as clockTile } from './clock/tile'
import { Section as rhythmSection } from './rhythm/section'
import { Tile as rhythmTile } from './rhythm/tile'
import { Section as timelineSection } from './timeline/section'
import { Tile as timelineTile } from './timeline/tile'
import { Section as crossingsSection } from './crossings/section'
import { Tile as crossingsTile } from './crossings/tile'
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
  records: {
    title: { en: 'Records', ru: 'Рекорды' },
    Section: recordsSection,
    Tile: recordsTile,
    gate: (scope) => scope.records,
  },
  manufacturers: {
    title: { en: 'Manufacturers', ru: 'Производители' },
    Section: manufacturersSection,
    Tile: manufacturersTile,
    gate: (scope) => scope.makers,
  },
  fleet: {
    title: { en: 'Fleet', ru: 'Парк' },
    Section: fleetSection,
    Tile: fleetTile,
    gate: (scope) => scope.fleet,
  },
  clock: {
    title: { en: 'Clock', ru: 'Часы' },
    Section: clockSection,
    Tile: clockTile,
    gate: (scope) => scope.clock,
  },
  rhythm: {
    title: { en: 'Rhythm', ru: 'Ритм' },
    Section: rhythmSection,
    Tile: rhythmTile,
    gate: (scope) => scope.rhythm,
  },
  timeline: {
    title: { en: 'Over time', ru: 'Со временем' },
    Section: timelineSection,
    Tile: timelineTile,
    gate: (scope) => scope.rhythm,
  },
  crossings: {
    title: { en: 'Crossings', ru: 'Пересечения' },
    Section: crossingsSection,
    Tile: crossingsTile,
    gate: (scope) => scope.crossings,
  },
}
