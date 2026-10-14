'use client'

import Link from 'next/link'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import type { Locale } from '../../lib/format'
import './states.css'

// Presentational Journal states. Props in, markup out: the store decides which one shows.
// Copy rules: sentence case, no em dashes, no claim that edits work offline.

const copy = {
  en: {
    emptyTitle: 'Your journal is empty',
    import: 'Import flights',
    addByHand: 'Add manually',
    noMatchesTitle: 'Nothing matches these filters',
    clearFilters: 'Clear filters',
    refreshFailedTitle: 'Could not refresh the list',
    refreshFailedDescription: 'Showing the last loaded flights.',
    retry: 'Try again',
    pending: 'Recent changes are still being prepared.',
    offline: 'Offline. Connect to change flights.',
  },
  ru: {
    emptyTitle: 'Журнал пока пуст',
    import: 'Импортировать перелёты',
    addByHand: 'Добавить вручную',
    noMatchesTitle: 'По этим фильтрам ничего не найдено',
    clearFilters: 'Сбросить фильтры',
    refreshFailedTitle: 'Не удалось обновить список',
    refreshFailedDescription: 'Показаны последние загруженные перелёты.',
    retry: 'Повторить',
    pending: 'Последние изменения ещё обрабатываются.',
    offline: 'Нет сети. Подключитесь, чтобы изменить перелёты.',
  },
} as const

/** The member has no flights at all. One primary action, one inline alternative. */
export function EmptyJournal({ locale }: { locale: Locale }) {
  const t = copy[locale]
  return (
    <EmptyState
      title={t.emptyTitle}
      action={
        <div className="journal-empty-actions">
          <Link className="ui-button" data-variant="primary" href="/import">
            <span>{t.import}</span>
          </Link>
          <Link className="journal-text-link" href="/add">
            {t.addByHand}
          </Link>
        </div>
      }
    />
  )
}

/** Flights exist but the filters or search hide all of them. */
export function NoMatches({
  locale,
  onClearFilters,
}: {
  locale: Locale
  onClearFilters: () => void
}) {
  const t = copy[locale]
  return (
    <EmptyState
      title={t.noMatchesTitle}
      action={
        <Button variant="secondary" onClick={onClearFilters}>
          {t.clearFilters}
        </Button>
      }
    />
  )
}

/** A background refresh failed. Sits above the rows; the rows stay. */
export function RefreshFailed({ locale, onRetry }: { locale: Locale; onRetry: () => void }) {
  const t = copy[locale]
  return (
    <Alert
      className="journal-refresh-failed"
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
    <p role="status" className="journal-note">
      {copy[locale].pending}
    </p>
  )
}

/** Controls that are blocked offline point `aria-describedby` at `id`. */
export function OfflineNote({ locale, id }: { locale: Locale; id: string }) {
  return (
    <p id={id} className="journal-note">
      {copy[locale].offline}
    </p>
  )
}
