'use client'

import { Fragment, useEffect, useId, useMemo, useState } from 'react'
import { formatCount, type Locale } from '../../lib/format'
import { useOnline } from '../awaiting'
import { announceShellNotice } from '../shell-notices'
import { JournalHeading, JournalSections } from '../journal-sections'
import { Button } from '../ui/button'
import { ChipGroup, FacetChip } from '../ui/chip-group'
import { FilterToolbar } from '../ui/filter-toolbar'
import { Menu, MenuRadioGroup, MenuRadioItem } from '../ui/menu'
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
  const data = useGroundList(ownerId, view.cancelled)
  const online = useOnline()
  const offlineNoteId = useId()
  const updating = useLate(data.refreshing, 150)
  const { list, today } = data

  const visible = useMemo(
    () => (list && today ? visibleJourneys(list.journeys, view.mode, today) : []),
    [list, today, view.mode],
  )
  const sections = useMemo(() => (today ? sectionsOf(visible, today) : []), [visible, today])

  const modeLabel = view.mode === 'rail' ? t.rail : view.mode === 'road' ? t.road : null
  const heading = (id: 'plans' | 'history' | 'cancelled') =>
    id === 'plans' ? t.plans : id === 'history' ? t.history : t.cancelledSection
  const filterName = view.cancelled
    ? t.cancelledFilter
    : view.mode === 'rail'
      ? t.rail
      : view.mode === 'road'
        ? t.road
        : t.all
  const empty = !view.cancelled && list?.journeys.length === 0
  const totals = (level: 2 | 3) =>
    list && !view.cancelled && list.journeys.length > 0 ? (
      <GroundTotals locale={locale} totals={list.totals} mode={view.mode} level={level} />
    ) : null
  const seed = list?.journeys.find((journey) => journey.id === view.journey) ?? null

  return (
    <div className="gt-page" data-testid="ground-travel-data">
      <header className="gt-header">
        <JournalHeading locale={locale} section="ground" />
        <JournalSections locale={locale} section="ground" />
      </header>
      {!online && <OfflineNote locale={locale} id={offlineNoteId} />}
      <FilterToolbar label={t.filtersLabel} className="gt-toolbar">
        <ChipGroup label={t.transport}>
          <span className="gt-chip" data-empty={modeLabel ? undefined : true}>
            <FacetChip
              facet={t.transport}
              values={modeLabel ? [modeLabel] : []}
              onRemove={() => setMode(null)}
              removeLabel={t.removeTransport}
              locale={locale}
            >
              {(body) => (
                <Menu trigger={body}>
                  <MenuRadioGroup
                    value={view.mode ?? ''}
                    onValueChange={(mode) => setMode(mode as GroundMode)}
                  >
                    <MenuRadioItem value="rail">{t.rail}</MenuRadioItem>
                    <MenuRadioItem value="road">{t.road}</MenuRadioItem>
                  </MenuRadioGroup>
                </Menu>
              )}
            </FacetChip>
          </span>
        </ChipGroup>
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
              <EmptyGround locale={locale} action={<AddChooser locale={locale} view={view} />} />
            ) : (
              <>
                {totals(2)}
                <NoneUnderFilter locale={locale} view={view} onShowAll={showAll} />
              </>
            )
          ) : (
            <>
              {sections.map((section) => (
                <Fragment key={section.id}>
                  <section className="gt-list-section" aria-labelledby={`gt-${section.id}`}>
                    <h2 id={`gt-${section.id}`}>{heading(section.id)}</h2>
                    {section.id === 'history' && totals(3)}
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
              {!sections.some((section) => section.id === 'history') && totals(2)}
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
