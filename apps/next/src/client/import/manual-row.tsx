'use client'

import { Bin2 as Trash2, CircleAlert } from '@keyline-icons/react'
import { useId, type ReactNode } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { MANUAL_FAILURE, S } from './copy'
import type { ManualRowState } from './manual-save'
import { RowForm } from './row-form'
import { saveAnchor } from './unconfirmed-saves'
import { validateValues, type FieldValues } from './review-model'

/** An inline row for a flight the document did not contain. It uses the same form and validation as a draft edit. */
export function ManualRow({
  locale,
  row,
  showErrors,
  onChange,
  onRemove,
  onRetryOriginal,
  retryBlocked,
  onNewOperation,
  onShowHeld,
  disabled,
}: {
  locale: Locale
  row: ManualRowState
  showErrors: boolean
  onChange: (values: FieldValues) => void
  onRemove: () => void
  /** Resend the stored original payload (uncertain or unconfirmed saves). */
  onRetryOriginal: () => void
  /** Why the resend is held back (typed corrections elsewhere are not saved yet); shown beside the button. */
  retryBlocked?: ReactNode
  /** The member checked the journal: forget the old attempt and treat the row as a new save. */
  onNewOperation: () => void
  /** A held-back row: move to the unresolved save of the same flight (absent when that save is not on the page). */
  onShowHeld?: () => void
  disabled?: boolean
}) {
  const id = useId()
  const errors = showErrors ? validateValues(row.values) : {}
  const unresolved =
    row.failure?.kind === 'uncertain' ||
    row.failure?.kind === 'unconfirmed' ||
    row.failure?.kind === 'expired' ||
    row.failure?.kind === 'settled'
  // The anchor lets a held-back identical row lead here while this row's own save is unresolved.
  return (
    <li
      id={saveAnchor(row.operationId)}
      tabIndex={unresolved ? -1 : undefined}
      className="import-row import-manual"
      data-failed={row.failure ? 'true' : undefined}
    >
      <div className="import-manual-head">
        <h3>{S.manualTitle[locale]}</h3>
        <Button
          dense
          variant="ghost"
          disabled={disabled}
          onClick={onRemove}
          aria-label={S.manualRemove[locale]}
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
      {row.failure ? (
        <div className="import-note" role="alert">
          <p className="import-status-line">
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            <span>{MANUAL_FAILURE[row.failure.kind][locale]}</span>
          </p>
          {unresolved ? (
            <div className="import-actions">
              {row.failure.kind !== 'expired' && row.failure.kind !== 'settled' ? (
                <Button
                  dense
                  disabled={disabled}
                  disabledReason={retryBlocked}
                  onClick={onRetryOriginal}
                >
                  {S.retryOriginal[locale]}
                </Button>
              ) : null}
              <Button dense variant="ghost" disabled={disabled} onClick={onNewOperation}>
                {S.checkedJournal[locale]}
              </Button>
            </div>
          ) : null}
          {row.failure.kind === 'duplicate' && onShowHeld ? (
            <div className="import-actions">
              <Button dense onClick={onShowHeld}>
                {S.showHeldSave[locale]}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <RowForm
        locale={locale}
        idPrefix={id}
        values={row.values}
        onChange={onChange}
        errors={errors}
        disabled={disabled}
      />
    </li>
  )
}
