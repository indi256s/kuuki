'use client'

import clsx from 'clsx'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { formatDateOnly, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Disclosure } from '../ui/disclosure'
import { Sheet } from '../ui/sheet'
import { Ticket } from '../signature/ticket'
import { airlineName, cityOf } from './reference'
import { BLOCK, FIELD_LABEL, S, tx } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Draft } from './import-types'
import { RowForm } from './row-form'
import { formatMonthDay } from './question-deck'
import { monthDayOf } from './questions'
import {
  changedFields,
  FIELDS,
  isChosen,
  isDuplicate,
  lowFields,
  percent,
  readiness,
  rowConfidence,
  toValues,
  validateValues,
  type FieldError,
  type FieldName,
  type FieldValues,
} from './review-model'

export interface ReviewRowProps {
  locale: Locale
  /** The row as shown: the stored draft with the member's unsent change laid over it. */
  draft: Draft
  /** The stored draft, without the unsent overlay. Discarding an edit goes back to this. */
  stored: Draft
  state?: SaveState
  mobile: boolean
  /** The import is being saved: corrections and selection are paused so nothing typed now is lost when the review closes. */
  frozen?: boolean
  onChange: (change: DraftChange) => void
  /** Reports whether the form holds a correction the member has typed but not saved. */
  onDirty: (id: string, dirty: boolean) => void
  onRetry: () => void
  onDiscard: () => void
}

const timeRange = (draft: Draft) =>
  [draft.fields.departure_time, draft.fields.arrival_time].filter(Boolean).join('–')

export function ReviewRow({
  locale,
  draft,
  stored,
  state,
  mobile,
  frozen = false,
  onChange,
  onDirty,
  onRetry,
  onDiscard,
}: ReviewRowProps) {
  const id = useId()
  const duplicate = isDuplicate(draft)
  const blocked = readiness(draft)
  const chosen = isChosen(draft)
  const confidence = rowConfidence(draft)
  const low = lowFields(draft)
  const [values, setValues] = useState(() => toValues(draft.fields))
  const [seen, setSeen] = useState(draft.version)
  // What the form started from: a typed value that differs from it is the member's own and survives a newer version.
  const [base, setBase] = useState<{ values: FieldValues; year: boolean }>(() => ({
    values: toValues(draft.fields),
    year: draft.yearConfirmed,
  }))
  const [yearChecked, setYearChecked] = useState(draft.yearConfirmed)
  const [errors, setErrors] = useState<Partial<Record<FieldName, FieldError>>>({})
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const editRef = useRef<HTMLButtonElement>(null)
  if (draft.version !== seen && !state) {
    const next = toValues(draft.fields)
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

  const city = cityOf
  const airline = draft.fields.airline_iata
    ? (airlineName(draft.fields.airline_iata) ?? draft.fields.airline_iata)
    : undefined
  const routeLabel = `${draft.fields.origin || '—'} → ${draft.fields.destination || '—'}`
  const dateText = draft.fields.date
    ? formatDateOnly(locale, draft.fields.date, 'medium')
    : S.noDate[locale]
  const flightNumber = draft.fields.flight_number
    ? `${draft.fields.airline_iata}${draft.fields.flight_number}`.trim()
    : undefined
  const needsYear = !draft.yearExplicit
  // Typed but not yet sent: the parent blocks the import and the unload warning is armed until it is saved or discarded.
  const dirty =
    Object.keys(changedFields(draft.fields, values)).length > 0 ||
    (needsYear && yearChecked !== draft.yearConfirmed)
  useEffect(() => {
    onDirty(draft.id, dirty)
  }, [draft.id, dirty, onDirty])
  useEffect(() => () => onDirty(draft.id, false), [draft.id, onDirty])

  const save = () => {
    const found = validateValues(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return false
    const fields = changedFields(draft.fields, values)
    const change: DraftChange = {}
    if (Object.keys(fields).length > 0) change.fields = fields
    if (needsYear && yearChecked !== draft.yearConfirmed) change.yearConfirmed = yearChecked
    if (!change.fields && change.yearConfirmed === undefined) return true
    onChange(change)
    return true
  }

  const toggle = (checked: boolean) =>
    onChange(
      duplicate ? { selected: checked, duplicateAcknowledged: checked } : { selected: checked },
    )

  const blockText = blocked.length ? tx(locale, BLOCK[blocked[0]]) : null
  const issueText = draft.issue
    ? draft.issue.code === 'UNKNOWN_AIRPORT'
      ? S.issueUnknownAirport[locale]
      : draft.issue.code === 'UNKNOWN_AIRCRAFT'
        ? S.issueUnknownAircraft[locale]
        : S.issueGeneric[locale]
    : null
  const stateText = !state
    ? ''
    : state.status === 'saving'
      ? S.saving[locale]
      : state.status === 'conflict'
        ? S.editConflict[locale]
        : state.rejected
          ? S.editRejected[locale]
          : S.editFailed[locale]
  const failedState = state && state.status !== 'saving'

  const checkLabel = duplicate ? S.saveAnyway[locale] : S.selectRow[locale]
  const checkbox = (
    <label className="import-check">
      <input
        type="checkbox"
        checked={duplicate ? draft.selected && draft.duplicateAcknowledged : chosen}
        disabled={blocked.length > 0 || frozen}
        aria-describedby={blockText ? `${id}-block` : undefined}
        onChange={(event) => toggle(event.target.checked)}
      />
      <span>
        <span className={duplicate ? undefined : 'sr-only'}>{checkLabel}</span>
        <span className="sr-only">{`: ${routeLabel}, ${dateText}`}</span>
      </span>
    </label>
  )

  const flags = (
    <div className="import-flags">
      {confidence === 'check' ? (
        <span className="import-chip" data-tone="warning">
          <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
          {S.check[locale]} · {percent(draft.confidence!)}%
        </span>
      ) : confidence === 'high' ? (
        <span className="import-chip">
          {S.confidence[locale]} {percent(draft.confidence!)}%
        </span>
      ) : (
        <span className="import-chip">{S.confidenceUnknown[locale]}</span>
      )}
      {low.length > 0 ? (
        <span className="import-chip" data-tone="warning">
          {S.fieldUnsure[locale]}:{' '}
          {low.map((name) => FIELD_LABEL[name][locale].replace(/ \(.*\)$/, '')).join(', ')}
        </span>
      ) : null}
    </div>
  )

  const notes = (
    <>
      {blockText ? (
        <p className="import-note" id={`${id}-block`}>
          {blockText}
        </p>
      ) : null}
      {!draft.fields.date && monthDayOf(draft) ? (
        <p className="import-note">
          {S.monthDayNote[locale].replace('{date}', formatMonthDay(locale, monthDayOf(draft)!))}
        </p>
      ) : null}
      {issueText ? <p className="import-note">{issueText}</p> : null}
      <p
        className="import-note"
        role="status"
        data-state={state?.status ?? (dirty ? 'unsaved' : undefined)}
      >
        {stateText || (dirty ? S.unsavedRow[locale] : '')}
      </p>
      {failedState ? (
        <div className="import-actions">
          <Button dense disabled={frozen} onClick={onRetry}>
            {S.retrySave[locale]}
          </Button>
          <Button
            dense
            variant="ghost"
            disabled={frozen}
            onClick={() => {
              onDiscard()
              setValues(toValues(stored.fields))
              setYearChecked(stored.yearConfirmed)
              setErrors({})
            }}
          >
            {S.discardEdit[locale]}
          </Button>
        </div>
      ) : null}
    </>
  )

  const form = (prefix: string) => (
    <>
      <RowForm
        locale={locale}
        idPrefix={prefix}
        values={values}
        onChange={setValues}
        errors={errors}
        low={low}
        disabled={state?.status === 'saving' || frozen}
        year={
          needsYear
            ? {
                missing: !draft.fields.date && !values.date,
                checked: yearChecked,
                onChange: setYearChecked,
              }
            : undefined
        }
      />
      {typeof draft.snippet === 'string' && draft.snippet ? (
        <blockquote className="import-snippet">
          <strong>{S.snippetTitle[locale]}</strong>
          <span>{draft.snippet}</span>
        </blockquote>
      ) : null}
    </>
  )

  if (mobile) {
    return (
      <li
        className="import-row import-row-ticket"
        data-selected={chosen ? 'true' : undefined}
        data-low={confidence === 'check' || low.length > 0 ? 'true' : undefined}
      >
        <Ticket
          state="upcoming"
          locale={locale}
          statusLabel={
            confidence === 'check'
              ? S.check[locale]
              : draft.confidence !== null
                ? `${S.confidence[locale]} ${percent(draft.confidence)}%`
                : S.confidenceUnknown[locale]
          }
          origin={{
            iata: draft.fields.origin || '—',
            city: draft.fields.origin ? city(draft.fields.origin) : '',
          }}
          destination={{
            iata: draft.fields.destination || '—',
            city: draft.fields.destination ? city(draft.fields.destination) : '',
          }}
          date={draft.fields.date || ''}
          flightNumber={flightNumber}
          airline={airline}
          actions={
            <div className="import-ticket-actions">
              {checkbox}
              <Button ref={editRef} dense disabled={frozen} onClick={() => setSheet(true)}>
                {S.edit[locale]}
              </Button>
            </div>
          }
        />
        {flags}
        {notes}
        <Sheet
          initialDetent={1}
          open={sheet}
          onOpenChange={(next) => {
            setSheet(next)
            if (!next) setErrors({})
          }}
          title={S.editTitle[locale]}
          description={`${routeLabel} · ${dateText}`}
          closeLabel={S.close[locale]}
          footer={
            <>
              <Button onClick={() => setSheet(false)}>{S.close[locale]}</Button>
              <Button
                variant="primary"
                loading={state?.status === 'saving'}
                loadingLabel={S.saving[locale]}
                disabledReason={frozen ? S.pausedWhileSaving[locale] : undefined}
                onClick={() => {
                  if (save()) setSheet(false)
                }}
              >
                {S.saveRow[locale]}
              </Button>
            </>
          }
        >
          {form(`${id}-sheet`)}
        </Sheet>
      </li>
    )
  }

  return (
    <li
      className="import-row"
      data-selected={chosen ? 'true' : undefined}
      data-low={confidence === 'check' || low.length > 0 ? 'true' : undefined}
    >
      <div className="import-row-main">
        {checkbox}
        <div className="import-row-body">
          <p className="import-row-route">
            <span className="import-code">{draft.fields.origin || '—'}</span>
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> {locale === 'ru' ? 'в' : 'to'} </span>
            <span className="import-code">{draft.fields.destination || '—'}</span>
          </p>
          <p className="import-row-meta">
            <span>{dateText}</span>
            {airline ? (
              <span>
                {airline}
                {draft.fields.flight_number ? ` ${draft.fields.flight_number}` : ''}
              </span>
            ) : draft.fields.flight_number ? (
              <span className="import-code">{draft.fields.flight_number}</span>
            ) : null}
            {draft.fields.aircraft_icao ? (
              <span className="import-code">{draft.fields.aircraft_icao}</span>
            ) : null}
            {timeRange(draft) ? <span className="import-code">{timeRange(draft)}</span> : null}
          </p>
          {flags}
        </div>
      </div>
      {notes}
      <Disclosure
        open={open}
        onOpenChange={setOpen}
        summary={<span className={clsx('import-edit-summary')}>{S.edit[locale]}</span>}
      >
        {form(`${id}-inline`)}
        <div className="import-actions">
          <Button
            variant="primary"
            dense
            loading={state?.status === 'saving'}
            loadingLabel={S.saving[locale]}
            disabledReason={frozen ? S.pausedWhileSaving[locale] : undefined}
            onClick={() => void save()}
          >
            {S.saveRow[locale]}
          </Button>
        </div>
      </Disclosure>
    </li>
  )
}
