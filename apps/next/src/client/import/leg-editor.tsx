'use client'

import { CircleAlert } from '@keyline-icons/react'
import { useEffect, useId, useState } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { S } from './copy'
import { R } from './route-copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Draft, DraftFields } from './import-types'
import { RowForm } from './row-form'
import {
  changedFields,
  FIELDS,
  lowFields,
  toValues,
  validateValues,
  type FieldError,
  type FieldName,
  type FieldValues,
} from './review-model'

const shownFields = (fields: DraftFields): DraftFields =>
  fields.airline_iata === 'ZZ' ? { ...fields, airline_iata: '' } : fields

export function useLegEdit({
  locale,
  draft,
  stored,
  state,
  onDirty,
  onDiscard,
}: {
  locale: Locale
  draft: Draft
  stored: Draft
  state?: SaveState
  onDirty: (id: string, dirty: boolean) => void
  onDiscard: () => void
}) {
  const fields = shownFields(draft.fields)
  const [values, setValues] = useState(() => toValues(fields))
  const [seen, setSeen] = useState(draft.version)
  const [base, setBase] = useState(() => toValues(fields))
  const [errors, setErrors] = useState<Partial<Record<FieldName, FieldError>>>({})
  if (draft.version !== seen && !state) {
    const next = toValues(fields)
    setSeen(draft.version)
    setValues(
      (current) =>
        Object.fromEntries(
          FIELDS.map((name) => [name, current[name] !== base[name] ? current[name] : next[name]]),
        ) as FieldValues,
    )
    setBase(next)
  }
  const dirty = Object.keys(changedFields(fields, values)).length > 0
  useEffect(() => {
    onDirty(draft.id, dirty)
  }, [draft.id, dirty, onDirty])
  useEffect(() => () => onDirty(draft.id, false), [draft.id, onDirty])

  const change = (): DraftChange | null | false => {
    const found = validateValues(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return false
    const changed = changedFields(fields, values)
    if (Object.keys(changed).length === 0) return null
    const result: DraftChange = { fields: changed }
    if (changed.date && !draft.yearExplicit) result.yearConfirmed = true
    return result
  }
  const failed = Boolean(state && state.status !== 'saving')
  const statusText = !state
    ? dirty
      ? R.unsavedLeg[locale]
      : ''
    : state.status === 'saving'
      ? S.saving[locale]
      : state.status === 'conflict'
        ? S.editConflict[locale]
        : state.rejected
          ? S.editRejected[locale]
          : S.editFailed[locale]
  const discard = () => {
    onDiscard()
    setValues(toValues(shownFields(stored.fields)))
    setErrors({})
  }
  return { values, setValues, errors, setErrors, dirty, failed, statusText, change, discard }
}

export function LegEditor({
  locale,
  draft,
  edit,
  state,
  open,
  mobile,
  frozen,
  title,
  onOpenChange,
  onChange,
  onCloseAutoFocus,
}: {
  locale: Locale
  draft: Draft
  edit: ReturnType<typeof useLegEdit>
  state?: SaveState
  open: boolean
  mobile: boolean
  frozen: boolean
  title: string
  onOpenChange: (open: boolean) => void
  onChange: (change: DraftChange) => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const id = useId()
  return (
    <Sheet
      initialDetent={1}
      side={mobile ? 'bottom' : 'right'}
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) edit.setErrors({})
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={S.editTitle[locale]}
      description={title}
      closeLabel={S.close[locale]}
      className="leg-editor"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{S.close[locale]}</Button>
          <Button
            variant="primary"
            loading={state?.status === 'saving'}
            loadingLabel={S.saving[locale]}
            disabledReason={frozen ? S.pausedWhileSaving[locale] : undefined}
            onClick={() => {
              const change = edit.change()
              if (change === false) return
              if (change) onChange(change)
              onOpenChange(false)
            }}
          >
            {S.saveRow[locale]}
          </Button>
        </>
      }
    >
      <RowForm
        locale={locale}
        idPrefix={`${id}-leg`}
        values={edit.values}
        onChange={edit.setValues}
        errors={edit.errors}
        low={lowFields(draft)}
        disabled={state?.status === 'saving' || frozen}
      />
      {edit.failed ? (
        <p className="import-problem" role="status">
          <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          <span>{edit.statusText}</span>
        </p>
      ) : null}
      {typeof draft.snippet === 'string' && draft.snippet ? (
        <blockquote className="import-snippet">
          <strong>{S.snippetTitle[locale]}</strong>
          <span>{draft.snippet}</span>
        </blockquote>
      ) : null}
    </Sheet>
  )
}
