import type { Rhythm } from '@kuuki/shared/overview/rhythm'
import { calendar } from '../../iso/calendar'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import { useOverview } from '../../store/overview-context'
import '../cookie.css'

/** Flights per calendar month, January first, summed over every year shown. */
export function monthTotals(data: Rhythm | null): number[] {
  const totals = Array.from({ length: 12 }, () => 0)
  for (const cell of data?.cells ?? []) totals[cell.month - 1] += cell.flights
  return totals
}

/** The Rhythm desk calendar for a tile or the sheet head. */
export function useCalendarFigure(size: FigureSize, data: Rhythm | null, locale: string) {
  const months = monthTotals(data)
  const busiest = data?.busiestMonthOfYear?.month ?? null
  const label = busiest
    ? new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
        Date.UTC(2000, busiest - 1, 1),
      )
    : ''
  return useFigure(size, `${months.join()}|${busiest}|${label}`, (k) =>
    calendar(months, busiest, label, k),
  )
}

/** The figure at the head of the Calendar view. */
export function CalendarSheetFigure() {
  const { scope, locale } = useOverview()
  const figure = useCalendarFigure(
    'sheet',
    scope?.rhythm.status === 'ready' ? scope.rhythm.value : null,
    locale,
  )
  return (
    <div className="ov3-sheet-figure">
      <IsoFigure figure={figure} className="iso-calendar" />
    </div>
  )
}
