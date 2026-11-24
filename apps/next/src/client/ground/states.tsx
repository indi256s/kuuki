'use client'

import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import type { Locale } from '../../lib/format'
import type { GroundView } from './url'
import { copy } from './copy'

export function EmptyGround({ locale, action }: { locale: Locale; action: React.ReactNode }) {
  const t = copy[locale]
  return (
    <EmptyState
      headingLevel={2}
      title={t.emptyTitle}
      description={t.emptyDescription}
      action={action}
    />
  )
}

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
      headingLevel={2}
      title={title}
      action={
        <Button variant="secondary" onClick={onShowAll}>
          {t.showAll}
        </Button>
      }
    />
  )
}

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

export function OfflineNote({ locale, id }: { locale: Locale; id: string }) {
  return (
    <p id={id} className="gt-note">
      {copy[locale].offline}
    </p>
  )
}
