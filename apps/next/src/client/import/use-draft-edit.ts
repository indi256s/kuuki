'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '../../lib/format'
import { S } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Draft, DraftFields } from './import-types'
import {
  changedFields,
  FIELDS,
  toValues,
  validateValues,
  type FieldError,
  type FieldName,
  type FieldValues,
} from './review-model'

const asStored = (draft: Draft): DraftFields => draft.fields

export function useDraftEdit({
  locale,
  draft,
  stored,
  state,
  shown = asStored,
  year = false,
  confirmYear = false,
  onChange,
  onDirty,
  onDiscard,
}: {
  locale: Locale
  draft: Draft
  stored: Draft
  state?: SaveState
  shown?: (draft: Draft) => DraftFields
  year?: boolean
  confirmYear?: boolean
  onChange: (change: DraftChange) => void
  onDirty: (id: string, dirty: boolean) => void
  onDiscard: () => void
}) {
  const fields = shown(draft)
  const [values, setValues] = useState(() => toValues(fields))
  const [seen, setSeen] = useState(draft.version)
  const [base, setBase] = useState<{ values: FieldValues; year: boolean }>(() => ({
    values: toValues(fields),
    year: draft.yearConfirmed,
  }))
  const [yearChecked, setYearChecked] = useState(draft.yearConfirmed)
  const [errors, setErrors] = useState<Partial<Record<FieldName, FieldError>>>({})
  if (draft.version !== seen && !state) {
    const next = toValues(fields)
    setSeen(draft.version)
    setValues(
      (current) =>
        Object.fromEntries(
          FIELDS.map((name) => [
            name,
            current[name] !== base.values[name] ? current[name] : next[name],
          ]),
        ) as FieldValues,
    )
    setYearChecked((current) => (current !== base.year ? current : draft.yearConfirmed))
    setBase({ values: next, year: draft.yearConfirmed })
  }

  const yearOpen = year && !draft.yearExplicit && !draft.yearConfirmed
  const dirty =
    Object.keys(changedFields(fields, values)).length > 0 ||
    (yearOpen && yearChecked !== draft.yearConfirmed)
  useEffect(() => {
    onDirty(draft.id, dirty)
  }, [draft.id, dirty, onDirty])
  useEffect(() => () => onDirty(draft.id, false), [draft.id, onDirty])

  const submit = () => {
    const found = validateValues(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return false
    const changed = changedFields(fields, values)
    const change: DraftChange = {}
    if (Object.keys(changed).length > 0) change.fields = changed
    if (yearOpen && yearChecked !== draft.yearConfirmed) change.yearConfirmed = yearChecked
    if (confirmYear && change.fields?.date && !draft.yearExplicit) change.yearConfirmed = true
    if (change.fields || change.yearConfirmed !== undefined) onChange(change)
    return true
  }
  const discard = () => {
    onDiscard()
    setValues(toValues(shown(stored)))
    setYearChecked(stored.yearConfirmed)
    setErrors({})
  }
  const failed = Boolean(state && state.status !== 'saving')
  const stateText = !state
    ? ''
    : state.status === 'saving'
      ? S.saving[locale]
      : state.status === 'conflict'
        ? S.editConflict[locale]
        : state.rejected
          ? S.editRejected[locale]
          : S.editFailed[locale]
  return {
    values,
    setValues,
    errors,
    setErrors,
    yearChecked,
    setYearChecked,
    dirty,
    failed,
    stateText,
    submit,
    discard,
  }
}

export type DraftEdit = ReturnType<typeof useDraftEdit>
