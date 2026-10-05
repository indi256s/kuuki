'use client'

import { Trash2 } from 'lucide-react'
import { useId } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { MANUAL_FAILED, S } from './copy'
import { RowForm } from './row-form'
import { validateValues, type FieldValues } from './review-model'

export interface ManualRowState { key: string; values: FieldValues; failed?: boolean }

/** An inline row for a flight the document did not contain. It uses the same form and validation as a draft edit. */
export function ManualRow({ locale, row, showErrors, onChange, onRemove, disabled }: {
  locale: Locale; row: ManualRowState; showErrors: boolean; onChange: (values: FieldValues) => void; onRemove: () => void; disabled?: boolean
}) {
  const id = useId()
  const errors = showErrors ? validateValues(row.values) : {}
  return <li className="import-row import-manual" data-failed={row.failed ? 'true' : undefined}>
    <div className="import-manual-head">
      <h3>{S.manualTitle[locale]}</h3>
      <Button dense variant="ghost" disabled={disabled} onClick={onRemove} aria-label={S.manualRemove[locale]}><Trash2 size={16} strokeWidth={2} aria-hidden="true" /></Button>
    </div>
    {row.failed ? <p className="import-note" role="alert">{MANUAL_FAILED[locale]}</p> : null}
    <RowForm locale={locale} idPrefix={id} values={row.values} onChange={onChange} errors={errors} disabled={disabled} />
  </li>
}
