'use client'

import { Check, Download, Ellipsis, Search, SlidersHorizontal } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react'
import { dayToEpoch } from '@kuuki/shared/overview/range'
import { formatCount, formatDateOnly, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { ChipGroup, FacetChip } from '../ui/chip-group'
import { DateRangePicker, type DateRangeValue } from '../ui/date-range-picker'
import { FilterToolbar } from '../ui/filter-toolbar'
import { Kbd } from '../ui/kbd'
import { Menu, MenuItem } from '../ui/menu'
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../ui/popover'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import type { JournalFacetValues } from './filter'
import { emptyFilters, type JournalFilters, type JournalRefs, type JournalStatus } from './model'
import { MoreFiltersDrawer, activeDrawerFacets } from './more-filters'
import './toolbar.css'

// Props only: the composition root owns the store, the URL and the data. Search, chips and the menu all write whole `JournalFilters` values.
// A chip is always a `FacetChip`. An empty facet is drawn as a ghost (toolbar.css) so the picker keeps one stable tree when its first value is chosen and stays open.

const copy = {
  en: {
    toolbar: 'Journal filters', chips: 'Filters',
    search: 'Search flights', placeholder: 'Search places, flights, airlines, dates', clearAll: 'Clear all',
    period: 'Period', place: 'Place', airline: 'Airline', aircraft: 'Aircraft',
    country: 'Country', family: 'Family', year: 'Year', years: 'Years',
    range: (from: string, to: string) => `${from} to ${to}`,
    remove: (facet: string) => `Remove ${facet} filter`,
    rangeError: 'Enter both dates, the start first.',
    more: 'More', moreFilters: 'More filters', nothingToExport: 'No flights match the filters.', close: 'Close',
  },
  ru: {
    toolbar: 'Фильтры журнала', chips: 'Фильтры',
    search: 'Поиск по перелётам', placeholder: 'Города, рейсы, авиакомпании, даты', clearAll: 'Сбросить всё',
    period: 'Период', place: 'Место', airline: 'Авиакомпания', aircraft: 'Самолёт',
    country: 'Страна', family: 'Семейство', year: 'Год', years: 'Годы',
    range: (from: string, to: string) => `с ${from} по ${to}`,
    remove: (facet: string) => `Убрать фильтр «${facet}»`,
    rangeError: 'Укажите обе даты, сначала начало.',
    more: 'Ещё', moreFilters: 'Другие фильтры', nothingToExport: 'Нет перелётов под эти фильтры.', close: 'Закрыть',
  },
}
const exportForms = {
  en: { one: 'Export {count} flight', other: 'Export {count} flights' },
  ru: { one: 'Экспортировать {count} перелёт', few: 'Экспортировать {count} перелёта', many: 'Экспортировать {count} перелётов', other: 'Экспортировать {count} перелёта' },
}

/** The model's list contract: sorted and de-duplicated. */
const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'))
const byLabel = (locale: Locale) => (a: MultiSelectOption, b: MultiSelectOption) => a.label.localeCompare(b.label, locale)
const withPrefix = (prefix: string, values: readonly string[]) => values.map(value => `${prefix}:${value}`)
const pickPrefixed = (prefix: string, values: readonly string[]) => sortedUnique(values.filter(value => value.startsWith(`${prefix}:`)).map(value => value.slice(prefix.length + 1)))

function regionName(names: Intl.DisplayNames | null, code: string): string {
  try { return names?.of(code) ?? code } catch { return code }
}

function isFiltered(filters: JournalFilters): boolean {
  const empty = emptyFilters()
  return filters.q !== empty.q || filters.from !== empty.from || filters.to !== empty.to
    || filters.years.length > 0 || filters.airports.length > 0 || filters.countries.length > 0 || filters.airlines.length > 0
    || filters.aircraft.length > 0 || filters.families.length > 0 || filters.status.length > 0 || filters.missing.length > 0 || filters.alliances.length > 0
}

/** One facet chip. `children` receives the chip body to wrap in the picker as its trigger. */
function PickerChip({ facet, labels, onRemove, locale, children }: {
  facet: string; labels: readonly string[]; onRemove: () => void; locale: Locale; children: (body: ReactElement) => ReactNode
}) {
  return <span className="journal-chip" data-empty={labels.length === 0 || undefined}>
    <FacetChip facet={facet} values={labels} onRemove={onRemove} removeLabel={copy[locale].remove(facet)} locale={locale}>{children}</FacetChip>
  </span>
}

type FacetProps = { filters: JournalFilters; onFiltersChange: (next: JournalFilters) => void; facetValues: JournalFacetValues; locale: Locale }

function PeriodChip({ filters, onFiltersChange, facetValues, locale }: FacetProps) {
  const t = copy[locale]
  const mobile = useMobile() === true
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRangeValue>({ from: '', to: '' })
  const [error, setError] = useState('')
  const change = (next: boolean) => {
    if (next) { setDraft({ from: filters.from, to: filters.to }); setError('') }
    setOpen(next)
  }
  const labelId = useId()
  const years = [...new Set([...facetValues.years, ...filters.years])].sort((a, b) => b - a)
  const hasRange = filters.from !== '' && filters.to !== ''
  const labels = hasRange ? [t.range(formatDateOnly(locale, filters.from), formatDateOnly(locale, filters.to))] : [...filters.years].sort((a, b) => b - a).map(String)
  const toggleYear = (year: number) => {
    const next = filters.years.includes(year) ? filters.years.filter(item => item !== year) : [...filters.years, year]
    setDraft({ from: '', to: '' })
    setError('')
    onFiltersChange({ ...filters, years: [...new Set(next)].sort((a, b) => a - b), from: '', to: '' })
  }
  const apply = () => {
    const from = dayToEpoch(draft.from), to = dayToEpoch(draft.to)
    if (from === null || to === null || from > to) { setError(t.rangeError); return }
    setError('')
    onFiltersChange({ ...filters, from: draft.from, to: draft.to, years: [] })
    setOpen(false)
  }
  const clear = () => {
    setDraft({ from: '', to: '' })
    setError('')
    onFiltersChange({ ...filters, from: '', to: '' })
  }
  const panel = <div className="journal-period">
    <div>
      <p id={labelId} className="journal-period-label">{t.years}</p>
      <div className="journal-period-years" role="group" aria-labelledby={labelId}>
        {years.map(year => {
          const on = !hasRange && filters.years.includes(year)
          return <Button key={year} dense variant={on ? 'primary' : 'secondary'} aria-pressed={on} onClick={() => toggleYear(year)}>
            {on ? <Check size={14} strokeWidth={2} aria-hidden="true" style={{ marginInlineEnd: 4, display: 'inline', verticalAlign: '-2px' }} /> : null}{year}
          </Button>
        })}
      </div>
    </div>
    <DateRangePicker from={draft.from} to={draft.to} onChange={value => { setDraft(value); setError('') }} onApply={apply} onClear={clear} locale={locale} error={error || undefined} />
  </div>
  return <PickerChip facet={t.period} labels={labels} locale={locale} onRemove={() => onFiltersChange({ ...filters, years: [], from: '', to: '' })}>
    {body => mobile
      ? <Sheet open={open} onOpenChange={change} title={t.period} trigger={body} closeLabel={t.close}>{panel}</Sheet>
      : <PopoverRoot open={open} onOpenChange={change}>
        <PopoverTrigger asChild>{body}</PopoverTrigger>
        <PopoverContent aria-label={t.period} className="journal-period-popover">{panel}</PopoverContent>
      </PopoverRoot>}
  </PickerChip>
}

function PlaceChip({ filters, onFiltersChange, facetValues, refs, locale }: FacetProps & { refs: JournalRefs }) {
  const t = copy[locale]
  const options = useMemo(() => {
    let names: Intl.DisplayNames | null = null
    try { names = new Intl.DisplayNames([locale], { type: 'region' }) } catch { /* fall back to the codes */ }
    const countries = facetValues.countries.map((code): MultiSelectOption => ({ value: `country:${code}`, label: regionName(names, code), detail: t.country }))
    const airports = facetValues.airports.map((code): MultiSelectOption => {
      const airport = refs.airports[code]
      return { value: `airport:${code}`, label: airport?.city || airport?.name || code, detail: code }
    })
    return [...countries.sort(byLabel(locale)), ...airports.sort(byLabel(locale))]
  }, [facetValues.countries, facetValues.airports, refs.airports, locale, t.country])
  const value = [...withPrefix('country', filters.countries), ...withPrefix('airport', filters.airports)]
  const labels = value.map(item => options.find(option => option.value === item)?.label ?? item.slice(item.indexOf(':') + 1))
  const onValueChange = (next: string[]) => onFiltersChange({ ...filters, countries: pickPrefixed('country', next), airports: pickPrefixed('airport', next) })
  return <PickerChip facet={t.place} labels={labels} locale={locale} onRemove={() => onFiltersChange({ ...filters, countries: [], airports: [] })}>
    {body => <MultiSelect label={t.place} options={options} value={value} onValueChange={onValueChange} locale={locale} trigger={body} />}
  </PickerChip>
}

function AirlineChip({ filters, onFiltersChange, facetValues, refs, locale }: FacetProps & { refs: JournalRefs }) {
  const t = copy[locale]
  const options = useMemo(
    () => facetValues.airlines.map((code): MultiSelectOption => ({ value: code, label: refs.airlines[code]?.name ?? code, detail: code })).sort(byLabel(locale)),
    [facetValues.airlines, refs.airlines, locale],
  )
  const labels = filters.airlines.map(code => options.find(option => option.value === code)?.label ?? code)
  return <PickerChip facet={t.airline} labels={labels} locale={locale} onRemove={() => onFiltersChange({ ...filters, airlines: [] })}>
    {body => <MultiSelect label={t.airline} options={options} value={filters.airlines} onValueChange={next => onFiltersChange({ ...filters, airlines: sortedUnique(next) })} locale={locale} trigger={body} />}
  </PickerChip>
}

function AircraftChip({ filters, onFiltersChange, facetValues, refs, locale }: FacetProps & { refs: JournalRefs }) {
  const t = copy[locale]
  const options = useMemo(() => {
    const families = facetValues.families.map((name): MultiSelectOption => ({ value: `family:${name}`, label: name, detail: t.family }))
    const types = facetValues.aircraft.map((icao): MultiSelectOption => {
      const name = refs.aircraft[icao]?.name
      return { value: `type:${icao}`, label: name ?? icao, detail: name ? icao : undefined }
    })
    return [...families.sort(byLabel(locale)), ...types.sort(byLabel(locale))]
  }, [facetValues.families, facetValues.aircraft, refs.aircraft, locale, t.family])
  const value = [...withPrefix('family', filters.families), ...withPrefix('type', filters.aircraft)]
  const labels = value.map(item => options.find(option => option.value === item)?.label ?? item.slice(item.indexOf(':') + 1))
  const onValueChange = (next: string[]) => onFiltersChange({ ...filters, families: pickPrefixed('family', next), aircraft: pickPrefixed('type', next) })
  return <PickerChip facet={t.aircraft} labels={labels} locale={locale} onRemove={() => onFiltersChange({ ...filters, families: [], aircraft: [] })}>
    {body => <MultiSelect label={t.aircraft} options={options} value={value} onValueChange={onValueChange} locale={locale} trigger={body} />}
  </PickerChip>
}

export type JournalToolbarProps = {
  filters: JournalFilters
  onFiltersChange: (next: JournalFilters) => void
  facetValues: JournalFacetValues
  statusCounts: Record<JournalStatus, number>
  refs: JournalRefs
  locale: Locale
  /** Flights matching the current filters, for "Export N flights". */
  matchingCount: number
  onExport: () => void
  /** The search input, so the keyboard layer can focus it on `/`. */
  searchRef?: Ref<HTMLInputElement>
}

export function JournalToolbar({ filters, onFiltersChange, facetValues, statusCounts, refs, locale, matchingCount, onExport, searchRef }: JournalToolbarProps) {
  const t = copy[locale]
  const [drawerOpen, setDrawerOpen] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)
  const drawerFacets = activeDrawerFacets(filters)
  const facet = { filters, onFiltersChange, facetValues, locale }
  const search = <div className="journal-search" data-hint={filters.q === '' || undefined}>
    <Search size={16} strokeWidth={1.5} className="journal-search-icon" aria-hidden="true" />
    <input ref={searchRef} className="ui-field-input" type="search" aria-label={t.search} aria-keyshortcuts="/" placeholder={t.placeholder} autoComplete="off" spellCheck={false}
      value={filters.q} onChange={event => onFiltersChange({ ...filters, q: event.target.value })}
      onKeyDown={event => {
        // Escape clears a typed query and is consumed; in an empty field it passes through (the keyboard layer may close the sheet).
        if (event.key === 'Escape' && filters.q !== '') { event.preventDefault(); event.stopPropagation(); onFiltersChange({ ...filters, q: '' }) }
      }} />
    {filters.q === '' ? <Kbd className="journal-search-kbd" aria-hidden="true">/</Kbd> : null}
  </div>
  const actions = <>
    {isFiltered(filters) ? <Button dense variant="ghost" onClick={() => onFiltersChange(emptyFilters())}>{t.clearAll}</Button> : null}
    <Menu align="end" trigger={<Button ref={moreRef} dense variant="ghost" className="journal-more" aria-label={t.more}><Ellipsis size={20} strokeWidth={2} aria-hidden="true" /></Button>}>
      <MenuItem onSelect={() => setDrawerOpen(true)}>
        <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        <span>{t.moreFilters}</span>
        {drawerFacets > 0 ? <><span className="sr-only">{`, ${drawerFacets}`}</span><span className="journal-menu-count" aria-hidden="true">{drawerFacets}</span></> : null}
      </MenuItem>
      <MenuItem disabled={matchingCount === 0} onSelect={onExport}>
        <Download size={16} strokeWidth={1.5} aria-hidden="true" />
        <span className="journal-menu-text">
          <span>{formatCount(locale, matchingCount, exportForms)}</span>
          {matchingCount === 0 ? <span className="journal-menu-hint">{t.nothingToExport}</span> : null}
        </span>
      </MenuItem>
    </Menu>
  </>
  return <>
    <FilterToolbar label={t.toolbar} className="journal-toolbar" search={search} actions={actions}>
      <ChipGroup label={t.chips} className="journal-chips">
        <PeriodChip {...facet} />
        <PlaceChip {...facet} refs={refs} />
        <AirlineChip {...facet} refs={refs} />
        <AircraftChip {...facet} refs={refs} />
      </ChipGroup>
    </FilterToolbar>
    <MoreFiltersDrawer open={drawerOpen} onOpenChange={setDrawerOpen} filters={filters} onFiltersChange={onFiltersChange} statusCounts={statusCounts} locale={locale} returnFocusRef={moreRef} />
  </>
}
