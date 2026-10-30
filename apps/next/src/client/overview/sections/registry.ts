'use client'

import { Suspense, createElement, useState, useSyncExternalStore, type ComponentType } from 'react'
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
type SectionView = ComponentType<{ span: Span }>
type Entry = {
  title: Copy
  Section: SectionView
  /** Draws nothing. Rendered on the server it adds the chapter's code to the page's preloads; on the client it loads that code. */
  Preload: ComponentType
  Tile: ComponentType<{ span: TileSpan }>
}

// Chapter code that has arrived. A chapter mounted after that renders at once instead of passing through its loading bands.
const loaded = new Map<SectionId, SectionView>()
const listeners = new Set<() => void>()
const keep =
  (id: SectionId) =>
  ({ Section }: { Section: SectionView }) => {
    if (!loaded.has(id)) {
      loaded.set(id, Section)
      for (const notify of listeners) notify()
    }
    return Section
  }
const Nothing = () => null
// A preload is optional: a chunk that fails to load leaves the chapter to fetch its own code when it mounts, instead of failing the page.
const nothing = () => Nothing

function chapter(id: SectionId, Lazy: SectionView): SectionView {
  return function Chapter(props: { span: Span }) {
    // Chosen once per mount: swapping the lazy wrapper for the loaded chapter later would remount it and drop its state.
    const [Loaded] = useState(() => loaded.get(id))
    return createElement(Loaded ?? Lazy, props)
  }
}

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}
/** Whether the code of every listed chapter has arrived. */
export function useChaptersLoaded(ids: readonly SectionId[]) {
  return useSyncExternalStore(
    subscribe,
    () => ids.every((id) => loaded.has(id)),
    () => false,
  )
}

/** Fetches the listed chapters' code alongside the page's own scripts. */
export function ChapterPreloads({ ids }: { ids: readonly SectionId[] }) {
  // Its own boundary, so hydrating the page does not wait for chapter code.
  return createElement(
    Suspense,
    { fallback: null },
    ids.map((id) => createElement(SECTIONS[id].Preload, { key: id })),
  )
}

export const SECTIONS: Record<SectionId, Entry> = {
  rankings: {
    title: { en: 'Rankings', ru: 'Рейтинги' },
    Section: chapter(
      'rankings',
      dynamic(() => import('./rankings/section').then(keep('rankings')), {
        loading: SectionLoading,
      }),
    ),
    Preload: dynamic(() =>
      import('./rankings/section').then(keep('rankings')).then(nothing, nothing),
    ),
    Tile: dynamic(() => import('./rankings/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  routes: {
    title: { en: 'Routes', ru: 'Маршруты' },
    Section: chapter(
      'routes',
      dynamic(() => import('./routes/section').then(keep('routes')), {
        loading: SectionLoading,
      }),
    ),
    Preload: dynamic(() => import('./routes/section').then(keep('routes')).then(nothing, nothing)),
    Tile: dynamic(() => import('./routes/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  records: {
    title: { en: 'Records', ru: 'Рекорды' },
    Section: chapter(
      'records',
      dynamic(() => import('./records/section').then(keep('records')), {
        loading: SectionLoading,
      }),
    ),
    Preload: dynamic(() =>
      import('./records/section').then(keep('records')).then(nothing, nothing),
    ),
    Tile: dynamic(() => import('./records/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  crossings: {
    title: { en: 'Continents', ru: 'Континенты' },
    Section: chapter(
      'crossings',
      dynamic(() => import('./crossings/section').then(keep('crossings')), {
        loading: SectionLoading,
      }),
    ),
    Preload: dynamic(() =>
      import('./crossings/section').then(keep('crossings')).then(nothing, nothing),
    ),
    Tile: dynamic(() => import('./crossings/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  rhythm: {
    title: { en: 'Rhythm', ru: 'Ритм' },
    Section: chapter(
      'rhythm',
      dynamic(() => import('./rhythm/section').then(keep('rhythm')), {
        loading: SectionLoading,
      }),
    ),
    Preload: dynamic(() => import('./rhythm/section').then(keep('rhythm')).then(nothing, nothing)),
    Tile: dynamic(() => import('./rhythm/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  clock: {
    title: { en: 'Clock', ru: 'Часы' },
    Section: chapter(
      'clock',
      dynamic(() => import('./clock/section').then(keep('clock')), {
        loading: SectionLoading,
      }),
    ),
    Preload: dynamic(() => import('./clock/section').then(keep('clock')).then(nothing, nothing)),
    Tile: dynamic(() => import('./clock/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
  aircraft: {
    title: { en: 'Aircraft', ru: 'Самолёты' },
    Section: chapter(
      'aircraft',
      dynamic(() => import('./aircraft/section').then(keep('aircraft')), {
        loading: SectionLoading,
      }),
    ),
    Preload: dynamic(() =>
      import('./aircraft/section').then(keep('aircraft')).then(nothing, nothing),
    ),
    Tile: dynamic(() => import('./aircraft/tile').then((module) => module.Tile), {
      loading: TileLoading,
    }),
  },
}
