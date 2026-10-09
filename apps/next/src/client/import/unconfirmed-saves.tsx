'use client'

import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { FIELD_LABEL, MANUAL_FAILURE, S } from './copy'
import { rowLabel } from './done-step'
import type { ManualFailure, UnconfirmedSave } from './manual-save'

/** The element a held-back row points at: a listed unresolved save, or the manual row that owns it. */
export const saveAnchor = (operationId: string) => `unconfirmed-save-${operationId}`

/** Move to the unresolved save that holds a row back. */
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

/**
 * Every unresolved create of this member found in this browser, on whichever import step is shown. Each entry shows the
 * flight its receipt pinned, offers the original save again (same key) while that is still safe, and can always be
 * settled by the member's journal check.
 */
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
  /** The answer to the last retry of an entry, when it was not a 2xx. */
  failures: Readonly<Record<string, ManualFailure>>
  /** The entry whose original save is being sent. */
  retrying: string | null
  /** Another save is running: the entries wait for it. */
  paused: boolean
  notice: string | null
  onRetry: (operationId: string) => void
  onSettle: (operationId: string) => void
}) {
  if (saves.length === 0 && !notice) return null
  // While any save runs (an import save or one of these retries), the entries wait for it and say so.
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
                <p className="import-note" role={failure ? 'alert' : undefined}>
                  {message}
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
