'use client'

import { useId, type RefObject } from 'react'
import { formatNumber, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import type { JournalAlliance, JournalFilters, JournalMissing, JournalStatus } from './model'
import './toolbar.css'

// The drawer behind the toolbar's "More filters": Status, Missing details and Alliance. Changes apply immediately; there is no Apply step.
// Right-hand drawer on desktop, bottom sheet up to 700px (Sheet itself does not switch sides).

const copy = {
  en: {
    title: 'More filters', close: 'Close', reset: 'Reset', done: 'Done',
    status: 'Status', missing: 'Missing details', alliance: 'Alliance',
    flown: 'Flown', awaiting: 'To confirm', upcoming: 'Upcoming',
    aircraft: 'Aircraft', airline: 'Airline', times: 'Times', flight_number: 'Flight number',
  },
  ru: {
    title: 'Другие фильтры', close: 'Закрыть', reset: 'Сбросить', done: 'Готово',
    status: 'Статус', missing: 'Нет данных', alliance: 'Альянс',
    flown: 'Выполнены', awaiting: 'Нужно подтвердить', upcoming: 'Предстоят',
    aircraft: 'Самолёт', airline: 'Авиакомпания', times: 'Время', flight_number: 'Номер рейса',
  },
}

const STATUS_ROWS: { value: JournalStatus; label: 'flown' | 'awaiting' | 'upcoming' }[] = [
  { value: 'logged', label: 'flown' }, { value: 'awaiting', label: 'awaiting' }, { value: 'upcoming', label: 'upcoming' },
]
const MISSING_ROWS: JournalMissing[] = ['aircraft', 'airline', 'times', 'flight_number']
// Proper names, not translated.
const ALLIANCE_ROWS: { value: JournalAlliance; label: string }[] = [
  { value: 'star', label: 'Star Alliance' }, { value: 'oneworld', label: 'oneworld' }, { value: 'skyteam', label: 'SkyTeam' },
]
/** What an empty `status` means: the default contents of the Journal. */
const DEFAULT_STATUS: readonly JournalStatus[] = ['awaiting', 'logged']

/** The model's list contract: sorted and de-duplicated. */
const sortedUnique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'))
const toggled = <T extends string>(values: readonly T[], value: T): T[] => sortedUnique(values.includes(value) ? values.filter(item => item !== value) : [...values, value])

/** How many drawer facets are narrowing the list (for the badge on "More filters"). */
export function activeDrawerFacets(filters: JournalFilters): number {
  return Number(filters.status.length > 0) + Number(filters.missing.length > 0) + Number(filters.alliances.length > 0)
}

export type MoreFiltersDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: JournalFilters
  onFiltersChange: (next: JournalFilters) => void
  statusCounts: Record<JournalStatus, number>
  locale: Locale
  /** Where focus goes when the drawer closes (the control that opened it). */
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function MoreFiltersDrawer({ open, onOpenChange, filters, onFiltersChange, statusCounts, locale, returnFocusRef }: MoreFiltersDrawerProps) {
  const t = copy[locale]
  const base = useId()
  const mobile = useMobile() === true
  // [] means the default contents, so render it as Flown and To confirm checked.
  const shownStatus = filters.status.length ? filters.status : DEFAULT_STATUS
  const toggleStatus = (value: JournalStatus) => {
    const next = toggled(shownStatus, value)
    const isDefault = next.length === DEFAULT_STATUS.length && next.every((item, index) => item === DEFAULT_STATUS[index])
    onFiltersChange({ ...filters, status: next.length === 0 || isDefault ? [] : next })
  }
  return <Sheet open={open} onOpenChange={onOpenChange} side={mobile ? 'bottom' : 'right'} title={t.title} closeLabel={t.close}
    className="journal-drawer"
    onCloseAutoFocus={event => { if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus() } }}
    footer={<>
      <Button onClick={() => onFiltersChange({ ...filters, status: [], missing: [], alliances: [] })}>{t.reset}</Button>
      <Button variant="primary" onClick={() => onOpenChange(false)}>{t.done}</Button>
    </>}>
    <div className="journal-facets">
      <fieldset className="journal-facet-group">
        <legend>{t.status}</legend>
        {STATUS_ROWS.map(row => {
          const countId = `${base}-count-${row.value}`
          return <div className="journal-facet-row" key={row.value}>
            <Checkbox label={t[row.label]} checked={shownStatus.includes(row.value)} aria-describedby={countId} onChange={() => toggleStatus(row.value)} />
            <span id={countId} className="journal-facet-count">{formatNumber(locale, statusCounts[row.value])}</span>
          </div>
        })}
      </fieldset>
      <fieldset className="journal-facet-group">
        <legend>{t.missing}</legend>
        {MISSING_ROWS.map(value => <div className="journal-facet-row" key={value}>
          <Checkbox label={t[value]} checked={filters.missing.includes(value)} onChange={() => onFiltersChange({ ...filters, missing: toggled(filters.missing, value) })} />
        </div>)}
      </fieldset>
      <fieldset className="journal-facet-group">
        <legend>{t.alliance}</legend>
        {ALLIANCE_ROWS.map(row => <div className="journal-facet-row" key={row.value}>
          <Checkbox label={row.label} checked={filters.alliances.includes(row.value)} onChange={() => onFiltersChange({ ...filters, alliances: toggled(filters.alliances, row.value) })} />
        </div>)}
      </fieldset>
    </div>
  </Sheet>
}
