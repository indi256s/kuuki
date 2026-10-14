'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { GROUND_LIMITS, placeLabel } from '@kuuki/shared/groundTravel'
import type { RailCandidateField } from '../../../../../../../functions/api/_services/railTicketOcr'
import { formatCount, formatDateOnly, type Locale } from '../../../../lib/format'
import { FileDropzone } from '../../../import/file-dropzone'
import { Button } from '../../../ui/button'
import { Calendar } from '../../../ui/calendar'
import { Checkbox } from '../../../ui/checkbox'
import { DestructiveConfirm } from '../../../ui/destructive-confirm'
import { Field } from '../../../ui/field'
import { blockImplicitSubmit } from '../fields'
import { RowFields } from '../ordered-rows'
import type { RailOcrSlotApi } from '../rail-editor'
import { T, files as fileForms, statusText, trains, unclear } from './copy'
import {
  allPreviews,
  canRetry,
  dateNeedsYear,
  findRepeats,
  hasUnclear,
  isRefused,
  isUncertain,
  legFromPreview,
  OCR_ACCEPT,
  unaddedRows,
  type OcrRow,
  type Preview,
  type PreviewDate,
} from './model'
import { useRailOcr } from './use-rail-ocr'
import './rail-ocr.css'

const sizeText = (locale: Locale, bytes: number) =>
  new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: bytes < 1024 * 1024 ? 'kilobyte' : 'megabyte',
    maximumFractionDigits: 1,
  }).format(bytes / (bytes < 1024 * 1024 ? 1024 : 1024 * 1024))

/**
 * The OCR panel mounted in the rail form's slot. Files are read one request each; every answer lands as editable
 * previews. Nothing reaches the route except through "Add to route", "Replace route" or "Replace this leg".
 */
export function RailOcrPanel({ api, locale }: { api: RailOcrSlotApi; locale: Locale }) {
  const ru = locale === 'ru'
  const l = ru ? 'ru' : 'en'
  const ocr = useRailOcr(api.restoredRows)
  const [confirming, setConfirming] = useState(false)
  const [refused, setRefused] = useState(false)
  const headingId = useId()
  const root = useRef<HTMLElement>(null)
  // After Remove, focus goes to a surviving row's Remove (the one that took its place, else the one before),
  // else back to the file picker, so the keyboard position never falls to the page.
  const focusAfterRemove = useRef<string | 'picker' | null>(null)
  const { onUnaddedChange } = api
  const unadded = useMemo(() => unaddedRows(ocr.rows), [ocr.rows])
  useEffect(() => onUnaddedChange(unadded), [unadded, onUnaddedChange])
  useEffect(() => {
    const target = focusAfterRemove.current
    if (target === null) return
    focusAfterRemove.current = null
    const node =
      target === 'picker'
        ? root.current?.querySelector<HTMLElement>('button')
        : root.current?.querySelector<HTMLElement>(`[data-remove-row="${target}"]`)
    node?.focus()
  }, [ocr.rows])
  const removeRow = (id: string) => {
    const index = ocr.rows.findIndex((row) => row.id === id)
    focusAfterRemove.current = (ocr.rows[index + 1] ?? ocr.rows[index - 1])?.id ?? 'picker'
    ocr.remove(id)
  }
  const previews = useMemo(() => allPreviews(ocr.rows), [ocr.rows])
  const repeats = useMemo(() => findRepeats(previews, api.legs), [previews, api.legs])
  const selected = previews.filter((preview) => preview.include)
  const legLabel = (index: number, leg: RailOcrSlotApi['legs'][number]) =>
    `${T.legName[l]} ${index + 1}${leg.from || leg.to ? `: ${leg.from ? placeLabel(leg.from, locale) : '?'} → ${leg.to ? placeLabel(leg.to, locale) : '?'}` : ''}`

  const give = (list: Preview[], mode: 'append' | 'replace', legId?: string) => {
    // Replace this leg starts from the old leg, so its places, id and typed duration stay.
    const base = legId === undefined ? undefined : api.legs.find((leg) => leg.id === legId)
    const taken = api.onCandidates(
      list.map((preview) => legFromPreview(preview, base)),
      mode,
      legId,
    )
    setRefused(!taken)
    if (taken) ocr.added(new Set(list.map((preview) => preview.id)))
    return taken
  }
  const room = GROUND_LIMITS.children
  const addReason = api.disabled
    ? T.routeLocked[l]
    : selected.length === 0
      ? T.nothingSelected[l]
      : api.legs.length + selected.length > room
        ? T.routeFull[l]
        : undefined
  const replaceReason = api.disabled
    ? T.routeLocked[l]
    : selected.length === 0
      ? T.nothingSelected[l]
      : selected.length > room
        ? T.routeFull[l]
        : undefined
  const done = ocr.rows.filter((row) => row.status !== 'waiting' && row.status !== 'reading').length

  return (
    <section ref={root} className="gt-ocr" aria-labelledby={headingId}>
      <h3 id={headingId} className="gt-ocr-heading">
        {T.heading[l]}
      </h3>
      <FileDropzone
        multiple
        paste={false}
        accept={OCR_ACCEPT}
        disabled={api.disabled}
        locale={locale}
        title={T.title[l]}
        hint={T.hint[l]}
        note={null}
        onFilesChange={ocr.add}
      />
      {ocr.rows.length > 0 && (
        <>
          <div className="gt-ocr-bar">
            {/* The one polite region of the panel: progress and the cut-off note. Rows below are plain text. */}
            <p className="gt-muted" role="status">
              {ocr.busy
                ? `${T.summaryReading[l]} ${done}/${ocr.rows.length}`
                : `${formatCount(locale, ocr.rows.length, fileForms)}`}
              {ocr.cutOff ? ` ${T.cutOff[l]}` : ''}
            </p>
            {ocr.busy && (
              <Button dense onClick={ocr.stop}>
                {T.stop[l]}
              </Button>
            )}
          </div>
          <ul className="gt-ocr-rows" aria-label={T.rows[l]}>
            {ocr.rows.map((row) => (
              <OcrFileRow
                key={row.id}
                row={row}
                locale={locale}
                busyForm={api.disabled}
                repeats={repeats}
                legs={api.legs}
                legName={legLabel}
                onRetry={() => ocr.retry(row.id)}
                onRemove={() => removeRow(row.id)}
                onEdit={ocr.edit}
                onReplaceLeg={(preview, legId) => give([preview], 'replace', legId)}
              />
            ))}
          </ul>
        </>
      )}
      {refused && (
        <p className="gt-error-text" role="alert">
          {T.routeFull[l]}
        </p>
      )}
      {previews.length > 0 && (
        <div className="gt-actions">
          <Button
            variant="primary"
            disabled={api.disabled || !!addReason}
            disabledReason={addReason}
            onClick={() => give(selected, 'append')}
          >
            {`${T.addToRoute[l]} (${selected.length})`}
          </Button>
          <Button
            disabled={api.disabled || !!replaceReason}
            disabledReason={replaceReason}
            onClick={() => setConfirming(true)}
          >
            {T.replaceRoute[l]}
          </Button>
        </div>
      )}
      <DestructiveConfirm
        open={confirming}
        onOpenChange={setConfirming}
        title={T.confirmTitle[l]}
        consequence={T.confirmBody[l]}
        confirmLabel={T.confirm[l]}
        cancelLabel={T.cancel[l]}
        onConfirm={() => {
          give(selected, 'replace')
          setConfirming(false)
        }}
      />
    </section>
  )
}

function OcrFileRow({
  row,
  locale,
  busyForm,
  repeats,
  legs,
  legName,
  onRetry,
  onRemove,
  onEdit,
  onReplaceLeg,
}: {
  row: OcrRow
  locale: Locale
  busyForm: boolean
  repeats: ReadonlySet<string>
  legs: RailOcrSlotApi['legs']
  legName: (index: number, leg: RailOcrSlotApi['legs'][number]) => string
  onRetry: () => void
  onRemove: () => void
  onEdit: (previewId: string, patch: Partial<Preview>) => void
  onReplaceLeg: (preview: Preview, legId: string) => void
}) {
  const l = locale === 'ru' ? 'ru' : 'en'
  const text =
    row.status === 'found'
      ? `${formatCount(locale, row.previews.length, trains)}${hasUnclear(row) ? `. ${unclear[l]}` : ''}`
      : statusText(l, row.status)
  return (
    <li className="gt-ocr-row" data-status={row.status}>
      <div className="gt-ocr-file">
        <span className="gt-ocr-name">{row.fileName}</span>
        {row.fileSize !== null && (
          <span className="gt-muted">{sizeText(locale, row.fileSize)}</span>
        )}
        <p className="gt-ocr-status">{text}</p>
        <div className="gt-ocr-file-actions">
          {canRetry(row.status) && !isRefused(row.status) && (
            <Button disabled={busyForm} onClick={onRetry}>
              {T.retry[l]}
            </Button>
          )}
          <Button
            data-remove-row={row.id}
            aria-label={`${T.remove[l]} ${row.fileName}`}
            onClick={onRemove}
          >
            {T.remove[l]}
          </Button>
        </div>
      </div>
      {row.previews.map((preview, index) => (
        <PreviewCard
          key={preview.id}
          preview={preview}
          index={index}
          fileName={row.fileName}
          locale={locale}
          repeat={repeats.has(preview.id)}
          disabled={busyForm}
          legs={legs}
          legName={legName}
          onEdit={(patch) => onEdit(preview.id, patch)}
          onReplaceLeg={(legId) => onReplaceLeg(preview, legId)}
        />
      ))}
    </li>
  )
}

function PreviewCard({
  preview,
  index,
  fileName,
  locale,
  repeat,
  disabled,
  legs,
  legName,
  onEdit,
  onReplaceLeg,
}: {
  preview: Preview
  index: number
  fileName: string
  locale: Locale
  repeat: boolean
  disabled: boolean
  legs: RailOcrSlotApi['legs']
  legName: (index: number, leg: RailOcrSlotApi['legs'][number]) => string
  onEdit: (patch: Partial<Preview>) => void
  onReplaceLeg: (legId: string) => void
}) {
  const l = locale === 'ru' ? 'ru' : 'en'
  const selectId = useId()
  const [target, setTarget] = useState('')
  const check = (field: RailCandidateField) =>
    isUncertain(preview, field) ? T.checkThis[l] : undefined
  const flags = [
    repeat && T.repeat[l],
    preview.cancelled && T.cancelled[l],
    preview.otherPassenger && T.otherPassenger[l],
    preview.added && T.added[l],
  ].filter(Boolean)
  const legend = `${fileName} · ${T.train[l]} ${index + 1}`
  const targetId = legs.some((leg) => leg.id === target) ? target : ''
  // Cards the reader is sure of read as one line; a "Check this" card opens so the doubtful field is in view.
  const unclear =
    preview.uncertain.length > 0 ||
    dateNeedsYear(preview.departureDate) ||
    dateNeedsYear(preview.arrivalDate)
  const printedDate = (date: PreviewDate) =>
    date.partial ? '' : date.value && formatDateOnly(locale, date.value, 'medium')
  const summary = [
    [preview.fromStation || preview.fromCity, preview.toStation || preview.toCity]
      .filter(Boolean)
      .join(' → '),
    [printedDate(preview.departureDate), preview.departureTime].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <fieldset className="gt-ocr-preview" disabled={disabled} onKeyDown={blockImplicitSubmit}>
      <legend>{legend}</legend>
      <Checkbox
        label={T.include[l]}
        checked={preview.include}
        onChange={(event) => onEdit({ include: event.target.checked })}
      />
      {flags.length > 0 && <p className="gt-ocr-flags">{flags.join(' · ')}</p>}
      <RowFields
        locale={locale}
        summary={summary}
        complete={!unclear}
        hasError={false}
        fresh={false}
      >
        <div className="gt-pair">
          <Field
            label={T.departureStation[l]}
            hint={check('fromStation') ?? check('fromCity')}
            hintPosition="below"
            value={preview.fromStation}
            maxLength={GROUND_LIMITS.station}
            onChange={(event) => onEdit({ fromStation: event.target.value })}
          />
          <Field
            label={T.arrivalStation[l]}
            hint={check('toStation') ?? check('toCity')}
            hintPosition="below"
            value={preview.toStation}
            maxLength={GROUND_LIMITS.station}
            onChange={(event) => onEdit({ toStation: event.target.value })}
          />
        </div>
        {(preview.fromCity || preview.toCity) && (
          <p className="gt-muted">
            {`${T.ticketCity[l]}: ${[preview.fromCity, preview.toCity].filter(Boolean).join(' → ')}. ${T.ticketCityNote[l]}`}
          </p>
        )}
        <div className="gt-pair">
          <DateInput
            label={T.departureDate[l]}
            date={preview.departureDate}
            uncertain={isUncertain(preview, 'departureDate')}
            locale={locale}
            onChange={(departureDate) => onEdit({ departureDate })}
          />
          <Field
            type="time"
            label={T.departureTime[l]}
            hint={check('departureTime')}
            hintPosition="below"
            value={preview.departureTime}
            onChange={(event) => onEdit({ departureTime: event.target.value })}
          />
        </div>
        <div className="gt-pair">
          <DateInput
            label={T.arrivalDate[l]}
            date={preview.arrivalDate}
            uncertain={isUncertain(preview, 'arrivalDate')}
            locale={locale}
            onChange={(arrivalDate) => onEdit({ arrivalDate })}
          />
          <Field
            type="time"
            label={T.arrivalTime[l]}
            hint={check('arrivalTime')}
            hintPosition="below"
            value={preview.arrivalTime}
            onChange={(event) => onEdit({ arrivalTime: event.target.value })}
          />
        </div>
        <div className="gt-pair">
          <Field
            label={T.trainNumber[l]}
            hint={check('trainNumber')}
            hintPosition="below"
            value={preview.trainNumber}
            maxLength={GROUND_LIMITS.trainNumber}
            onChange={(event) => onEdit({ trainNumber: event.target.value })}
          />
          <Field
            label={T.operator[l]}
            hint={check('operator')}
            hintPosition="below"
            value={preview.operator}
            maxLength={GROUND_LIMITS.operator}
            onChange={(event) => onEdit({ operator: event.target.value })}
          />
        </div>
        <div className="gt-ocr-replace">
          <div className="ui-field">
            <label className="ui-field-label" htmlFor={selectId}>
              {T.replaceWhich[l]}
            </label>
            <select
              id={selectId}
              className="ui-field-input gt-select"
              value={targetId}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">{T.replaceLeg[l]}</option>
              {legs.map((leg, legIndex) => (
                <option key={leg.id} value={leg.id}>
                  {legName(legIndex, leg)}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={disabled || !targetId}
            disabledReason={targetId ? undefined : T.replaceLeg[l]}
            onClick={() => onReplaceLeg(targetId)}
          >
            {T.replaceThis[l]}
          </Button>
        </div>
      </RowFields>
    </fieldset>
  )
}

/** A whole date is a date input; a partial one shows what the ticket printed and asks for the year it did not. */
function DateInput({
  label,
  date,
  uncertain,
  locale,
  onChange,
}: {
  label: string
  date: PreviewDate
  uncertain: boolean
  locale: Locale
  onChange: (date: PreviewDate) => void
}) {
  const l = locale === 'ru' ? 'ru' : 'en'
  if (!date.partial)
    return (
      <div>
        <Calendar
          label={label}
          value={date.value}
          locale={locale}
          onChange={(value) => onChange({ ...date, value })}
        />
        {uncertain && <p className="gt-ocr-check">{T.checkThis[l]}</p>}
      </div>
    )
  const printed = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
    // 2000 is a leap year, so 29 February prints; the year is never shown or used.
    new Date(2000, date.partial.month - 1, date.partial.day),
  )
  const typed = date.year.trim() !== ''
  return (
    <Field
      inputMode="numeric"
      maxLength={4}
      autoComplete="off"
      label={`${label}: ${printed}`}
      hint={`${T.yearMissing[l]}${uncertain ? ` ${T.checkThis[l]}` : ''}`}
      hintPosition="below"
      placeholder={T.year[l]}
      value={date.year}
      error={typed && dateNeedsYear(date) ? T.yearProblem[l] : undefined}
      onChange={(event) => onChange({ ...date, year: event.target.value })}
    />
  )
}
