'use client'

import { CircleAlert } from '@keyline-icons/react'
import { useId } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { S } from './copy'
import { R } from './route-copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Draft, DraftFields } from './import-types'
import { RowForm } from './row-form'
import { lowFields } from './review-model'
import { airlineOf } from './route-model'
import { useDraftEdit } from './use-draft-edit'

const legFields = (draft: Draft): DraftFields => ({
  ...draft.fields,
  airline_iata: airlineOf(draft) ?? '',
})

export function useLegEdit({
  locale,
  draft,
  stored,
  state,
  onChange,
  onDirty,
  onDiscard,
}: {
  locale: Locale
  draft: Draft
  stored: Draft
  state?: SaveState
  onChange: (change: DraftChange) => void
  onDirty: (id: string, dirty: boolean) => void
  onDiscard: () => void
}) {
  const edit = useDraftEdit({
    locale,
    draft,
    stored,
    state,
    shown: legFields,
    confirmYear: true,
    onChange,
    onDirty,
    onDiscard,
  })
  const statusText = state ? edit.stateText : edit.dirty ? R.unsavedLeg[locale] : ''
  return { ...edit, statusText }
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
              if (edit.submit()) onOpenChange(false)
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
