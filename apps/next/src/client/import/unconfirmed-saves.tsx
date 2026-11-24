'use client'

import { CircleAlert } from '@keyline-icons/react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { FIELD_LABEL, MANUAL_FAILURE, S } from './copy'
import { rowLabel } from './done-step'
import type { ManualFailure, UnconfirmedSave } from './manual-save'

export const saveAnchor = (operationId: string) => `unconfirmed-save-${operationId}`

export function showSave(operationId: string): void {
  const target = document.getElementById(saveAnchor(operationId))
  target?.scrollIntoView?.({ block: 'center' })
  target?.focus()
}

const DETAILS = [
  'airline_iata',
  'flight_number',
  'departure_time',
  'arrival_time',
  'aircraft_icao',
] as const

export function UnconfirmedSaves({
  locale,
  saves,
  failures,
  retrying,
  paused,
  notice,
  onRetry,
  onSettle,
}: {
  locale: Locale
  saves: UnconfirmedSave[]
  failures: Readonly<Record<string, ManualFailure>>
  retrying: string | null
  paused: boolean
  notice: string | null
  onRetry: (operationId: string) => void
  onSettle: (operationId: string) => void
}) {
  if (saves.length === 0 && !notice) return null
  const waiting = paused || retrying !== null ? S.pausedWhileSaving[locale] : undefined
  return (
    <section className="import-unconfirmed" aria-labelledby="import-unconfirmed-title">
      <h2 id="import-unconfirmed-title">{S.unconfirmedTitle[locale]}</h2>
      {saves.length > 0 ? <p className="import-hint">{S.unconfirmedLead[locale]}</p> : null}
      {notice ? (
        <p className="import-note" role="status">
          {notice}
        </p>
      ) : null}
      {saves.length > 0 ? (
        <ul className="import-rows">
          {saves.map((save) => {
            const failure = failures[save.operationId]
            const message =
              save.values === null
                ? S.unconfirmedUnreadable[locale]
                : save.expired
                  ? MANUAL_FAILURE.expired[locale]
                  : MANUAL_FAILURE[failure?.kind ?? 'uncertain'][locale]
            const retryReason =
              save.values === null
                ? S.retryUnreadableReason[locale]
                : save.expired
                  ? S.retryExpiredReason[locale]
                  : retrying === save.operationId
                    ? undefined
                    : waiting
            return (
              <li
                key={save.operationId}
                id={saveAnchor(save.operationId)}
                tabIndex={-1}
                className="import-row"
                data-failed="true"
              >
                <p className="import-row-route">
                  {save.values ? rowLabel(locale, save.values) : S.unreadableSave[locale]}
                </p>
                {save.values ? (
                  <p className="import-row-meta">
                    {DETAILS.filter((name) => save.values![name]).map((name) => (
                      <span key={name}>
                        {FIELD_LABEL[name][locale]}:{' '}
                        <span className="import-code">{save.values![name]}</span>
                      </span>
                    ))}
                  </p>
                ) : null}
                <p
                  className={failure ? 'import-note import-status-line' : 'import-note'}
                  role={failure ? 'alert' : undefined}
                >
                  {failure ? <CircleAlert size={16} strokeWidth={2} aria-hidden="true" /> : null}
                  {failure ? <span>{message}</span> : message}
                </p>
                <div className="import-actions">
                  <Button
                    dense
                    loading={retrying === save.operationId}
                    loadingLabel={S.importing[locale]}
                    disabledReason={retryReason}
                    onClick={() => onRetry(save.operationId)}
                  >
                    {S.retryOriginal[locale]}
                  </Button>
                  <Button
                    dense
                    variant="ghost"
                    disabledReason={waiting}
                    onClick={() => onSettle(save.operationId)}
                  >
                    {S.journalChecked[locale]}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
