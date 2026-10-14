'use client'
// The ground-travel page's composition root: view state (URL), list read, and plain props for the presentational
// pieces (cards, totals, states, detail sheet). The transport filter is local; "Cancelled" is a different list.

import { Fragment, useEffect, useId, useMemo, useState } from 'react'
import { formatCount, type Locale } from '../../lib/format'
import { useOnline } from '../awaiting'
import { announceShellNotice } from '../shell-notices'
import { Button } from '../ui/button'
import { FilterToolbar } from '../ui/filter-toolbar'
import { SegmentedControl, type SegmentOption } from '../ui/segmented-control'
import { AddChooser } from './add-chooser'
import { copy, journeys as journeyForms } from './copy'
import { GroundDetail } from './detail-sheet'
import { GroundListSkeleton } from './ground-skeleton'
import { JourneyCard } from './journey-card'
import { sectionsOf, visibleJourneys } from './list-model'
import {
  EmptyGround,
  NoneUnderFilter,
  OfflineNote,
  PublicationPending,
  ReadError,
  RefreshFailed,
} from './states'
import { GroundTotals } from './totals'
import { useGroundList } from './use-ground-data'
import { useGroundView } from './use-ground-view'
import type { GroundMode } from '@kuuki/shared/groundTravel'
import './ground.css'

type Choice = 'all' | GroundMode

/** True once `active` has lasted `delayMs`, so a fast reload never flashes a status. */
function useLate(active: boolean, delayMs: number) {
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setLate(true), delayMs)
    return () => {
      clearTimeout(timer)
      setLate(false)
    }
  }, [active, delayMs])
  return late
}

export function GroundTravelPage({
  ownerId,
  locale,
  initialQuery,
}: {
  ownerId: string
  locale: Locale
  initialQuery: string
}) {
  const t = copy[locale]
  const { view, setMode, setCancelled, showAll, openJourney, closeJourney } =
    useGroundView(initialQuery)
  const data = useGroundList(view.cancelled)
  const online = useOnline()
  const offlineNoteId = useId()
  const updating = useLate(data.refreshing, 150)
  const { list, today } = data

  const visible = useMemo(
    () => (list && today ? visibleJourneys(list.journeys, view.mode, today) : []),
    [list, today, view.mode],
  )
  const sections = useMemo(() => (today ? sectionsOf(visible, today) : []), [visible, today])

  const options: SegmentOption<Choice>[] = [
    { value: 'all', label: t.all },
    { value: 'rail', label: t.rail },
    { value: 'road', label: t.road },
  ]
  const heading = (id: 'plans' | 'history' | 'cancelled') =>
    id === 'plans' ? t.plans : id === 'history' ? t.history : t.cancelledSection
  const filterName = view.cancelled
    ? t.cancelledFilter
    : view.mode === 'rail'
      ? t.rail
      : view.mode === 'road'
        ? t.road
        : t.all
  const add = <AddChooser locale={locale} view={view} />
  // The empty state carries the page's one Add; the header's appears with the first journey.
  const empty = !view.cancelled && list?.journeys.length === 0
  // Totals sit after the plans and before the history; with no history on screen they close the list.
  const totals =
    list && !view.cancelled && list.journeys.length > 0 ? (
      <GroundTotals locale={locale} totals={list.totals} mode={view.mode} />
    ) : null
  const seed = list?.journeys.find((journey) => journey.id === view.journey) ?? null

  return (
    <div className="gt-page" data-testid="ground-travel-data">
      <header className="gt-header">
        <div className="gt-header-row">
          <h1 tabIndex={-1}>{t.title}</h1>
          {!empty && add}
        </div>
      </header>
      {!online && <OfflineNote locale={locale} id={offlineNoteId} />}
      <FilterToolbar label={t.filtersLabel} className="gt-toolbar">
        <SegmentedControl<Choice>
          dense
          label={t.transport}
          value={view.mode ?? 'all'}
          options={options}
          onChange={(choice) => setMode(choice === 'all' ? null : choice)}
        />
        <Button
          dense
          variant="secondary"
          className="gt-cancelled-toggle"
          aria-pressed={view.cancelled}
          onClick={() => setCancelled(!view.cancelled)}
        >
          {t.cancelledFilter}
        </Button>
      </FilterToolbar>
      {data.loading ? (
        <GroundListSkeleton locale={locale} />
      ) : !list ? (
        <ReadError locale={locale} onRetry={data.reload} />
      ) : (
        <div className="gt-results" aria-busy={data.refreshing || undefined}>
          {data.failed && <RefreshFailed locale={locale} onRetry={data.reload} />}
          <p role="status" className="gt-count">
            {t.resultCount(formatCount(locale, visible.length, journeyForms), filterName)}
            {updating ? ` · ${t.updating}` : ''}
          </p>
          {list.derivedState === 'pending' && <PublicationPending locale={locale} />}
          {visible.length === 0 ? (
            empty ? (
              <EmptyGround locale={locale} action={add} />
            ) : (
              <>
                {totals}
                <NoneUnderFilter locale={locale} view={view} onShowAll={showAll} />
              </>
            )
          ) : (
            <>
              {sections.map((section) => (
                <Fragment key={section.id}>
                  {section.id === 'history' && totals}
                  <section className="gt-list-section" aria-labelledby={`gt-${section.id}`}>
                    <h2 id={`gt-${section.id}`}>{heading(section.id)}</h2>
                    <ul className="gt-list">
                      {section.journeys.map((journey) => (
                        <JourneyCard
                          key={journey.id}
                          journey={journey}
                          locale={locale}
                          view={view}
                          today={today!}
                          onOpen={openJourney}
                        />
                      ))}
                    </ul>
                  </section>
                </Fragment>
              ))}
              {!sections.some((section) => section.id === 'history') && totals}
            </>
          )}
        </div>
      )}
      <GroundDetail
        locale={locale}
        view={view}
        seed={seed}
        online={online}
        onClose={closeJourney}
        onChanged={data.reload}
        onDeleted={() => {
          announceShellNotice(ownerId, { kind: 'success', message: t.deletedNotice })
          closeJourney()
          data.reload()
        }}
      />
    </div>
  )
}
