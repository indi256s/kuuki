'use client'
// The Journal's composition root: reads the store and hands plain props to the presentational pieces
// (header, Next up, toolbar, ledger, states). Callbacks passed to the ledger stay stable so memoised rows do not re-render.
import { useCallback, useMemo } from 'react'
import type { Locale } from '../../server/locale'
import { useAwaiting } from '../awaiting'
import { useMobile } from '../ui/use-mobile'
import { JournalBulkActions } from './bulk-actions'
import { Crossfade } from './crossfade'
import { downloadCsv, exportFileName, openFlightsCsv } from './export-csv'
import { JournalHeader } from './header'
import { JournalLedger } from './ledger'
import { NextUp } from './next-up'
import { EmptyJournal, NoMatches, OfflineNote, PublicationPending, RefreshFailed } from './states'
import { useJournalStore } from './store'
import { JournalToolbar } from './toolbar'
import './journal-page.css'

const NEXT_UP = 3
const OFFLINE_NOTE_ID = 'journal-offline-note'

export function JournalShell({ locale }: { locale: Locale }) {
  const { payload, view, selection, setFilters, setSort, openFlight, resetFilters, refresh, isError, online, hidden,
    selectedVisible, toggle, selectAll, clear, hide, unhide } = useJournalStore()
  const { data: queue } = useAwaiting()

  // D6: Next up and the review pill ignore filters.
  const nextUp = useMemo(() => payload.flights
    .filter(flight => flight.lifecycle_state === 'upcoming' && !hidden.has(flight.id))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.departure_utc ?? '').localeCompare(b.departure_utc ?? '') || a.id - b.id)
    .slice(0, NEXT_UP), [payload.flights, hidden])
  const awaitingCount = queue?.awaitingFlightCount ?? payload.flights.filter(flight => flight.lifecycle_state === 'awaiting').length
  const importBatches = (queue?.drafts ?? []).filter(draft => draft.reviewRowCount > 0)
  const importHref = importBatches.length === 1 ? `/import?batch=${importBatches[0]!.batchId}` : '/import'

  const onOpen = useCallback((id: number) => openFlight(id), [openFlight])
  const onReview = useCallback(() => openFlight(null, { review: true }), [openFlight])
  // Desktop selection: the row checkbox shows on hover or focus. Phones start selection from the row menu (ticket 14).
  const selectable = useMobile() !== true
  const onToggleSelect = useCallback((id: number) => toggle(id), [toggle])
  // Act on ticked flights the filters show; ticks hidden by a filter stay in the store but are not shown or acted on.
  const visibleSelected = useMemo<ReadonlySet<number>>(() => new Set(selectedVisible), [selectedVisible])
  const selectedFlights = useMemo(() => selectedVisible.length ? selection.matching.filter(flight => visibleSelected.has(flight.id)) : NO_FLIGHTS, [selection.matching, selectedVisible, visibleSelected])
  const onRetry = useCallback(() => { void refresh() }, [refresh])
  const onExport = useCallback(() => downloadCsv(exportFileName(new Date()), openFlightsCsv(selection.matching, payload.refs)), [selection.matching, payload.refs])
  // Facet and sort changes crossfade the rows; search narrows live without a fade.
  const signature = useMemo(() => JSON.stringify({ ...view.filters, q: undefined, sort: view.sort }), [view.filters, view.sort])

  const empty = payload.flights.length === 0
  return <section data-testid="journal-data" className="journal-data journal-page">
    <JournalHeader locale={locale} summary={selection.summary} awaitingCount={awaitingCount} importReviewCount={importBatches.length} onReview={onReview} importHref={importHref} />
    {!online && <OfflineNote locale={locale} id={OFFLINE_NOTE_ID} />}
    {isError && <RefreshFailed locale={locale} onRetry={onRetry} />}
    {payload.derivedState === 'pending' && <PublicationPending locale={locale} />}
    <NextUp flights={nextUp} refs={payload.refs} locale={locale} onOpen={onOpen} />
    {!empty && <JournalToolbar filters={view.filters} onFiltersChange={setFilters} facetValues={selection.facetValues} statusCounts={selection.statusCounts}
      refs={payload.refs} locale={locale} matchingCount={selection.matching.length} onExport={onExport} />}
    {empty
      ? <EmptyJournal locale={locale} />
      : selection.items.length === 0
        ? <NoMatches locale={locale} onClearFilters={resetFilters} />
        : <Crossfade signature={signature}>
          <JournalLedger items={selection.items} refs={payload.refs} locale={locale} sort={view.sort} onSortChange={setSort}
            activeId={view.flight} compact={false} selected={visibleSelected} selectable={selectable} onToggleSelect={onToggleSelect} onOpen={onOpen} hidden={hidden} />
        </Crossfade>}
    <JournalBulkActions locale={locale} selected={selectedFlights} matching={selection.matching} refs={payload.refs} queue={queue} online={online} offlineNoteId={OFFLINE_NOTE_ID}
      onSelectAll={selectAll} onClear={clear} hide={hide} unhide={unhide} refresh={refresh} />
  </section>
}

const NO_FLIGHTS: never[] = []
