'use client'
// Presentational ground-travel states. Props in, markup out: the page decides which one shows. A failed read is an
// Alert with Retry, never an empty state; "nothing here" and "nothing under this filter" are different screens.

import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import type { Locale } from '../../lib/format'
import type { GroundView } from './url'
import { copy } from './copy'

/** The member has no ground journeys at all. `action` is the Add chooser. */
export function EmptyGround({ locale, action }: { locale: Locale; action: React.ReactNode }) {
  const t = copy[locale]
  return <EmptyState title={t.emptyTitle} description={t.emptyDescription} action={action} />
}

/** Journeys exist, but the current filter hides them all. Names the filter and offers to drop it. */
export function NoneUnderFilter({
  locale,
  view,
  onShowAll,
}: {
  locale: Locale
  view: Pick<GroundView, 'mode' | 'cancelled'>
  onShowAll: () => void
}) {
  const t = copy[locale]
  const title = view.cancelled
    ? t.noCancelledTitle
    : view.mode === 'rail'
      ? t.noRailTitle
      : t.noRoadTitle
  return (
    <EmptyState
      title={title}
      action={
        <Button variant="secondary" onClick={onShowAll}>
          {t.showAll}
        </Button>
      }
    />
  )
}

/** The first read failed: no rows to keep, so the alert stands where the list would be. */
export function ReadError({ locale, onRetry }: { locale: Locale; onRetry: () => void }) {
  const t = copy[locale]
  return (
    <Alert
      variant="danger"
      urgent
      title={t.errorTitle}
      action={
        <Button dense onClick={onRetry}>
          {t.retry}
        </Button>
      }
    >
      {t.errorDescription}
    </Alert>
  )
}

/** A later refresh failed. Sits above the rows; the rows stay. */
export function RefreshFailed({ locale, onRetry }: { locale: Locale; onRetry: () => void }) {
  const t = copy[locale]
  return (
    <Alert
      variant="warning"
      urgent
      title={t.refreshFailedTitle}
      action={
        <Button dense onClick={onRetry}>
          {t.retry}
        </Button>
      }
    >
      {t.refreshFailedDescription}
    </Alert>
  )
}

export function PublicationPending({ locale }: { locale: Locale }) {
  return (
    <p role="status" className="gt-note">
      {copy[locale].pending}
    </p>
  )
}

/** Controls that are blocked offline point `aria-describedby` at `id`. */
export function OfflineNote({ locale, id }: { locale: Locale; id: string }) {
  return (
    <p id={id} className="gt-note">
      {copy[locale].offline}
    </p>
  )
}
