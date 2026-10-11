'use client'
// The Journal's composition root: reads the store and hands plain props to the presentational pieces
// (header, Next up, toolbar, ledger, states). Callbacks passed to the ledger stay stable so memoised rows do not re-render.
// It mounts the page's one deferred delete (`journal-delete.tsx`) around everything that removes flights.
//
// Review mode (ticket 12) opens from the header pill, `queue=awaiting` and `#arrival-<id>` (the store reads the last two from
// the URL). The spec's "Status → To confirm" route: ticking that filter only filters; a row opened while the Status filter is
// exactly To confirm opens in review mode, as does an awaiting row opened while review mode is already on.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Bin2 as Trash2 } from '@keyline-icons/react'
import type { Locale } from '../../server/locale'
import { HistoricalReview } from '../reads/historical-review'
import { useAwaiting } from '../awaiting'
import { useMobile } from '../ui/use-mobile'
import { JournalBulkActions } from './bulk-actions'
import { Crossfade } from './crossfade'
import { JournalDetail, useDockedDetail } from './detail-sheet'
import { downloadCsv, exportFileName, openFlightsCsv } from './export-csv'
import type { EditableField } from './flight-edits'
import { JournalHeader } from './header'
import { JournalDeleteProvider, useJournalDelete } from './journal-delete'
import { JournalLedger } from './ledger'
import { NextUp } from './next-up'
import { useJournalReview } from './review-mode'
import { EmptyJournal, NoMatches, OfflineNote, PublicationPending, RefreshFailed } from './states'
import { useJournalStore } from './store'
import { JournalToolbar } from './toolbar'
import { ShortcutsButton, ShortcutsPopover } from './shortcuts-popover'
import { useMobileConfirmation } from './mobile-confirmation'
import { useJournalKeys } from './use-journal-keys'
import type { JournalFlight } from './model'
import './journal-page.css'

const NEXT_UP = 3
const OFFLINE_NOTE_ID = 'journal-offline-note'

export function JournalShell({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const { hide, unhide, refresh } = useJournalStore()
  return (
    <JournalDeleteProvider locale={locale} hide={hide} unhide={unhide} refresh={refresh}>
      <JournalContent ownerId={ownerId} locale={locale} />
    </JournalDeleteProvider>
  )
}

function JournalContent({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const {
    payload,
    view,
    selection,
    setFilters,
    setSort,
    openFlight,
    resetFilters,
    refresh,
    isError,
    online,
    hidden,
    selectedVisible,
    toggle,
    selectAll,
    clear,
    closeSheet,
  } = useJournalStore()
  const { data: queue } = useAwaiting()

  // D6: Next up and the review pill ignore filters.
  const nextUp = useMemo(
    () =>
      payload.flights
        .filter((flight) => flight.lifecycle_state === 'upcoming' && !hidden.has(flight.id))
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            (a.departure_utc ?? '').localeCompare(b.departure_utc ?? '') ||
            a.id - b.id,
        )
        .slice(0, NEXT_UP),
    [payload.flights, hidden],
  )
  const awaitingCount =
    queue?.awaitingFlightCount ??
    payload.flights.filter((flight) => flight.lifecycle_state === 'awaiting').length
  const importBatches = (queue?.drafts ?? []).filter((draft) => draft.reviewRowCount > 0)
  const importHref =
    importBatches.length === 1 ? `/import?batch=${importBatches[0]!.batchId}` : '/import'

  // The sheet: docked beside the ledger at 1280px and up (the ledger then drops Duration and Distance), an overlay below.
  const docked = useDockedDetail()
  const review = useJournalReview({ locale, docked, queue, offlineNoteId: OFFLINE_NOTE_ID })
  const split = docked && (view.flight !== null || review?.placeholder != null)
  const [initialField, setInitialField] = useState<{
    flightId: number
    field: EditableField
  } | null>(null)
  // Read at click time, so `onOpen` stays stable for the memoised rows.
  const opening = useRef({ flights: payload.flights, view })
  useEffect(() => {
    opening.current = { flights: payload.flights, view }
  })
  const onOpen = useCallback(
    (id: number, opts?: { field?: 'aircraft' }) => {
      setInitialField(opts?.field === 'aircraft' ? { flightId: id, field: 'aircraft_icao' } : null)
      const { flights, view: now } = opening.current
      const awaiting = flights.some(
        (flight) => flight.id === id && flight.lifecycle_state === 'awaiting',
      )
      const toConfirm = now.filters.status.length === 1 && now.filters.status[0] === 'awaiting'
      openFlight(id, awaiting && (now.review || toConfirm) ? { review: true } : undefined)
    },
    [openFlight],
  )
  const onOpenNextUp = useCallback((id: number) => onOpen(id), [onOpen])
  const onReview = useCallback(() => openFlight(null, { review: true }), [openFlight])
  // Desktop selection: the row checkbox shows on hover or focus. Phones start selection from the row menu (ticket 14).
  const mobile = useMobile() === true
  const selectable = !mobile
  const searchRef = useRef<HTMLInputElement>(null)
  const ledgerRef = useRef<HTMLDivElement>(null)
  const shortcutsRef = useRef<HTMLButtonElement>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const onMove = useCallback(
    (id: number) => {
      if (docked && view.flight !== null) onOpen(id)
    },
    [docked, view.flight, onOpen],
  )
  useJournalKeys({
    enabled: !mobile,
    searchRef,
    ledgerRef,
    sheetOpen: view.flight !== null || review?.placeholder != null,
    onCloseSheet: closeSheet,
    onToggleSelect: toggle,
    hasSearch: view.filters.q !== '',
    onClearSearch: () => setFilters({ ...view.filters, q: '' }),
    onShowShortcuts: () => setShortcutsOpen(true),
    onMove,
  })
  const { scheduleDelete } = useJournalDelete()
  const actionCopy =
    locale === 'ru'
      ? {
          flew: 'Подтвердить',
          remove: 'Удалить перелёт',
          select: 'Выбрать',
          deselect: 'Снять выбор',
          offline: 'Нет сети. Подключитесь, чтобы изменить перелёты.',
        }
      : {
          flew: 'I flew',
          remove: 'Delete flight',
          select: 'Select',
          deselect: 'Deselect',
          offline: 'Offline. Connect to change flights.',
        }
  const onRemove = useCallback(
    (id: number) => {
      if (online) scheduleDelete([id])
    },
    [online, scheduleDelete],
  )
  const onToggleSelect = useCallback((id: number) => toggle(id), [toggle])
  // Act on ticked flights the filters show; ticks hidden by a filter stay in the store but are not shown or acted on.
  const visibleSelected = useMemo<ReadonlySet<number>>(
    () => new Set(selectedVisible),
    [selectedVisible],
  )
  const selectedFlights = useMemo(
    () =>
      selectedVisible.length
        ? selection.matching.filter((flight) => visibleSelected.has(flight.id))
        : NO_FLIGHTS,
    [selection.matching, selectedVisible, visibleSelected],
  )
  const onRetry = useCallback(() => {
    void refresh()
  }, [refresh])
  const onExport = useCallback(
    () => downloadCsv(exportFileName(new Date()), openFlightsCsv(selection.matching, payload.refs)),
    [selection.matching, payload.refs],
  )
  // Facet and sort changes crossfade the rows; search narrows live without a fade.
  const signature = useMemo(
    () => JSON.stringify({ ...view.filters, q: undefined, sort: view.sort }),
    [view.filters, view.sort],
  )

  const confirmation = useMobileConfirmation({ locale, queue, online, refresh })
  const onConfirm = (id: number) => {
    const flight = payload.flights.find((item) => item.id === id)
    if (flight) void confirmation.confirm(flight)
  }
  const rowMenu = (flight: JournalFlight) => [
    ...(flight.lifecycle_state === 'awaiting'
      ? [
          {
            id: 'confirm',
            label: actionCopy.flew,
            disabled: !online || confirmation.busy,
            onSelect: () => onConfirm(flight.id),
          },
        ]
      : []),
    {
      id: 'delete',
      label: actionCopy.remove,
      danger: true,
      disabled: !online,
      onSelect: () => onRemove(flight.id),
    },
    {
      id: 'select',
      label: visibleSelected.has(flight.id) ? actionCopy.deselect : actionCopy.select,
      onSelect: () => toggle(flight.id),
    },
  ]
  const swipeActions = (flight: JournalFlight) =>
    online && !confirmation.busy
      ? {
          leading:
            flight.lifecycle_state === 'awaiting'
              ? [
                  {
                    label: actionCopy.flew,
                    icon: <Check size={20} />,
                    tone: 'accent' as const,
                    onSelect: () => onConfirm(flight.id),
                  },
                ]
              : [],
          trailing: [
            {
              label: actionCopy.remove,
              icon: <Trash2 size={20} />,
              tone: 'danger' as const,
              onSelect: () => onRemove(flight.id),
            },
          ],
        }
      : {}
  const empty = payload.flights.length === 0
  return (
    <section data-testid="journal-data" className="journal-data journal-page">
      <JournalHeader
        locale={locale}
        summary={selection.summary}
        awaitingCount={awaitingCount}
        importReviewCount={importBatches.length}
        onReview={onReview}
        importHref={importHref}
      />
      <HistoricalReview locale={locale} />
      {!online && <OfflineNote locale={locale} id={OFFLINE_NOTE_ID} />}
      {isError && <RefreshFailed locale={locale} onRetry={onRetry} />}
      {payload.derivedState === 'pending' && <PublicationPending locale={locale} />}
      {confirmation.note && (
        <p role={confirmation.note.alert ? 'alert' : 'status'}>{confirmation.note.text}</p>
      )}
      <NextUp flights={nextUp} refs={payload.refs} locale={locale} onOpen={onOpenNextUp} />
      {!empty && (
        <JournalToolbar
          filters={view.filters}
          onFiltersChange={setFilters}
          facetValues={selection.facetValues}
          statusCounts={selection.statusCounts}
          refs={payload.refs}
          locale={locale}
          matchingCount={selection.matching.length}
          onExport={onExport}
          searchRef={searchRef}
        />
      )}
      <div className="journal-split" data-split={split || undefined}>
        <div className="journal-main" ref={ledgerRef}>
          {empty ? (
            <EmptyJournal locale={locale} />
          ) : selection.items.length === 0 ? (
            <NoMatches locale={locale} onClearFilters={resetFilters} />
          ) : (
            <Crossfade signature={signature}>
              <JournalLedger
                items={selection.items}
                refs={payload.refs}
                locale={locale}
                sort={view.sort}
                onSortChange={setSort}
                activeId={view.flight}
                compact={split}
                selected={visibleSelected}
                selectable={selectable}
                onToggleSelect={onToggleSelect}
                onOpen={onOpen}
                hidden={hidden}
                mobile={mobile}
                rowMenu={mobile ? rowMenu : undefined}
                rowMenuReason={!online ? actionCopy.offline : undefined}
                swipeActions={mobile ? swipeActions : undefined}
              />
            </Crossfade>
          )}
        </div>
        <JournalDetail
          ownerId={ownerId}
          locale={locale}
          docked={docked}
          initialField={initialField}
          top={review?.top}
          status={review?.status}
          footer={review?.footer}
          placeholder={review?.placeholder}
        />
      </div>
      {!mobile && (
        <>
          <ShortcutsButton
            ref={shortcutsRef}
            locale={locale}
            onClick={() => setShortcutsOpen(true)}
          />
          <ShortcutsPopover
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
            locale={locale}
            anchor={shortcutsRef}
          />
        </>
      )}
      <JournalBulkActions
        locale={locale}
        selected={selectedFlights}
        matching={selection.matching}
        refs={payload.refs}
        queue={queue}
        online={online}
        offlineNoteId={OFFLINE_NOTE_ID}
        onSelectAll={selectAll}
        onClear={clear}
        refresh={refresh}
      />
    </section>
  )
}

const NO_FLIGHTS: never[] = []
