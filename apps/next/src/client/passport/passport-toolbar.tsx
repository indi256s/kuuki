'use client'

import { ArrowUpDown, Search, SlidersHorizontal } from '@keyline-icons/react'
import { useId } from 'react'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Menu, MenuRadioGroup, MenuRadioItem } from '../ui/menu'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../ui/popover'
import { SegmentedControl } from '../ui/segmented-control'
import type { Locale } from '../../lib/format'
import {
  PASSPORT_REGIONS,
  PASSPORT_SOURCES,
  type PassportRegion,
  type PassportSource,
  type PassportState,
} from '../../lib/url-state'
import { REGION_LABELS, SOURCE_LABELS, type PassportSort } from './model'
import type { PassportPatch } from './use-passport-query'
import './passport.css'

export type MapScope = 'all' | 'flights' | 'ground'
/** The canonical `src` behind each map segment; `null` clears it. */
export const MAP_SCOPE_SRC: Record<MapScope, string | null> = {
  all: null,
  flights: 'flights',
  ground: 'trains,road',
}
/** The segment a source selection stands for, or null when it is another combination (manual only, say). */
export function mapScopeOf(sources: readonly PassportSource[]): MapScope | null {
  const src = sources.length ? sources.join(',') : null
  return (
    (Object.keys(MAP_SCOPE_SRC) as MapScope[]).find((scope) => MAP_SCOPE_SRC[scope] === src) ?? null
  )
}
const MAP_SCOPE_LABELS: Record<MapScope, Record<Locale, string>> = {
  all: { en: 'All', ru: 'Всё' },
  flights: { en: 'Flights', ru: 'Перелёты' },
  ground: { en: 'Ground', ru: 'По земле' },
}

const SORT_LABELS: Record<PassportSort, Record<Locale, string>> = {
  recent: { en: 'Recent', ru: 'Недавние' },
  name: { en: 'Name', ru: 'По имени' },
  records: { en: 'Records', ru: 'По визитам' },
}

/**
 * Search, Cards/Map, Filters and (for the owner) a compact sort. Everything applies at once and lives in the URL.
 * Reset appears only while a search or filter is active. A visitor has no sources group and no sort: the collection
 * is always by name.
 */
export function PassportToolbar({
  locale,
  owner,
  state,
  query,
  onQuery,
  filterCount,
  filtersActive,
  onReset,
  navigate,
}: {
  locale: Locale
  owner: boolean
  state: PassportState
  /** The search text as typed; the URL follows it. */
  query: string
  onQuery: (value: string) => void
  /** Active conditions behind the Filters button (region and sources; search is its own field). */
  filterCount: number
  filtersActive: boolean
  onReset: () => void
  navigate: (patch: PassportPatch, mode?: 'push' | 'replace') => void
}) {
  const ru = locale === 'ru'
  const searchId = useId()
  return (
    <div
      className="passport-toolbar"
      role="group"
      aria-label={ru ? 'Поиск, вид и фильтры паспорта' : 'Passport search, view and filters'}
    >
      <div className="passport-search-field">
        <label className="sr-only" htmlFor={searchId}>
          {ru ? 'Найти в паспорте' : 'Search the passport'}
        </label>
        <Search size={18} strokeWidth={1.75} aria-hidden="true" />
        <input
          id={searchId}
          type="search"
          className="ui-field-input passport-search-input"
          placeholder={ru ? 'Страна или код' : 'Country or code'}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !query) return
            event.preventDefault()
            onQuery('')
          }}
        />
      </div>
      <SegmentedControl
        label={ru ? 'Вид паспорта' : 'Passport view'}
        value={state.view}
        onChange={(view) => navigate({ view: view === 'cards' ? null : view }, 'push')}
        options={[
          { value: 'cards', label: ru ? 'Карточки' : 'Cards' },
          { value: 'map', label: ru ? 'Карта' : 'Map' },
        ]}
      />
      {owner && state.view === 'map' ? (
        <MapScopeControl locale={locale} state={state} navigate={navigate} />
      ) : null}
      <FiltersPopover
        locale={locale}
        owner={owner}
        state={state}
        count={filterCount}
        navigate={navigate}
      />
      {owner && state.view === 'cards' ? (
        <Menu
          align="end"
          trigger={
            <Button
              aria-label={ru ? 'Порядок штампов' : 'Sort stamps'}
              icon={<ArrowUpDown size={16} strokeWidth={1.75} aria-hidden="true" />}
            >
              {SORT_LABELS[state.sort][locale]}
            </Button>
          }
        >
          <MenuRadioGroup
            value={state.sort}
            onValueChange={(sort) => navigate({ sort: sort === 'recent' ? null : sort })}
          >
            {(Object.keys(SORT_LABELS) as PassportSort[]).map((sort) => (
              <MenuRadioItem key={sort} value={sort}>
                {SORT_LABELS[sort][locale]}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </Menu>
      ) : null}
      {filtersActive ? (
        <Button variant="ghost" onClick={onReset}>
          {ru ? 'Сбросить' : 'Reset'}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * The owner's map picks which travel fills the countries. It writes the same `src` the Sources filter does; any other
 * combination is named instead, and the toolbar's Reset clears it.
 */
function MapScopeControl({
  locale,
  state,
  navigate,
}: {
  locale: Locale
  state: PassportState
  navigate: (patch: PassportPatch) => void
}) {
  const ru = locale === 'ru'
  const scope = mapScopeOf(state.sources)
  if (!scope)
    return (
      <p className="passport-map-sources">
        {(ru ? 'Источники: ' : 'Sources: ') +
          state.sources.map((source) => SOURCE_LABELS[source][locale]).join(', ')}
      </p>
    )
  return (
    <SegmentedControl
      dense
      label={ru ? 'Что показывает карта' : 'What the map shows'}
      value={scope}
      onChange={(next) => navigate({ src: MAP_SCOPE_SRC[next] })}
      options={(Object.keys(MAP_SCOPE_LABELS) as MapScope[]).map((value) => ({
        value,
        label: MAP_SCOPE_LABELS[value][locale],
      }))}
    />
  )
}

function FiltersPopover({
  locale,
  owner,
  state,
  count,
  navigate,
}: {
  locale: Locale
  owner: boolean
  state: PassportState
  count: number
  navigate: (patch: PassportPatch) => void
}) {
  const ru = locale === 'ru'
  const regionName = useId()
  const toggleSource = (source: PassportSource, on: boolean) => {
    const next = PASSPORT_SOURCES.filter((item) =>
      item === source ? on : state.sources.includes(item),
    )
    navigate({ src: next.length ? next.join(',') : null })
  }
  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            count
              ? ru
                ? `Фильтры, активно: ${count}`
                : `Filters, ${count} active`
              : ru
                ? 'Фильтры'
                : 'Filters'
          }
          icon={<SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          {ru ? 'Фильтры' : 'Filters'}
          {count ? <span className="passport-filter-count">{count}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="passport-filters" aria-label={ru ? 'Фильтры' : 'Filters'}>
        <fieldset className="passport-filter-group">
          <legend>{ru ? 'Регион' : 'Region'}</legend>
          <div className="passport-regions-pick">
            {([null, ...PASSPORT_REGIONS] as (PassportRegion | null)[]).map((region) => (
              <label key={region ?? 'all'} className="passport-pick">
                <input
                  type="radio"
                  name={regionName}
                  checked={state.region === region}
                  onChange={() => navigate({ region })}
                />
                <span>{region ? REGION_LABELS[region][locale] : ru ? 'Все' : 'All'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {owner ? (
          <fieldset className="passport-filter-group">
            <legend>{ru ? 'Источники' : 'Sources'}</legend>
            <div className="passport-sources-pick">
              {PASSPORT_SOURCES.map((source) => (
                <Checkbox
                  key={source}
                  label={SOURCE_LABELS[source][locale]}
                  checked={state.sources.includes(source)}
                  onChange={(event) => toggleSource(source, event.target.checked)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}
      </PopoverContent>
    </PopoverRoot>
  )
}
