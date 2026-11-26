'use client'

import clsx from 'clsx'
import { TriangleAlert, CircleAlert } from '@keyline-icons/react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { formatDateOnly, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Disclosure } from '../ui/disclosure'
import { Sheet } from '../ui/sheet'
import { Ticket } from '../signature/ticket'
import { airlineName, cityOf } from './reference'
import { BLOCK, FIELD_LABEL, issueText, S, tx } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Draft } from './import-types'
import { RowForm } from './row-form'
import { RouteEndpoint, routeText } from './route-endpoint'
import { formatMonthDay } from './day-format'
import { monthDayOf, ordinalOf } from './questions'
import {
  isChosenOn,
  isDuplicate,
  localToday,
  lowFields,
  percent,
  readiness,
  rowConfidence,
} from './review-model'
import { useDraftEdit } from './use-draft-edit'

export interface ReviewRowProps {
  locale: Locale
  draft: Draft
  stored: Draft
  state?: SaveState
  mobile: boolean
  today?: string
  frozen?: boolean
  compact?: boolean
  quiet?: boolean
  singleton?: boolean
  implicitSelection?: boolean
  onChange: (change: DraftChange) => void
  onDirty: (id: string, dirty: boolean) => void
  onRetry: () => void
  onDiscard: () => void
  children?: ReactNode
}

const timeRange = (draft: Draft) =>
  [draft.fields.departure_time, draft.fields.arrival_time].filter(Boolean).join('–')

export function ReviewRow({
  locale,
  draft,
  stored,
  state,
  mobile,
  today,
  frozen = false,
  compact = false,
  quiet = false,
  singleton = false,
  implicitSelection = false,
  onChange,
  onDirty,
  onRetry,
  onDiscard,
  children,
}: ReviewRowProps) {
  const id = useId()
  const duplicate = isDuplicate(draft)
  const day = today ?? localToday()
  const blocked = readiness(draft, day)
  const chosen = isChosenOn(draft, day)
  const notVerified =
    !quiet && draft.fields.verification && draft.fields.verification !== 'verified'
  const confidence = rowConfidence(draft)
  const low = lowFields(draft)
  const edit = useDraftEdit({
    locale,
    draft,
    stored,
    state,
    year: true,
    confirmYear: compact,
    onChange,
    onDirty,
    onDiscard,
  })
  const { values, errors, yearChecked, dirty } = edit
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const editRef = useRef<HTMLButtonElement>(null)
  const city = cityOf
  const airline = draft.fields.airline_iata
    ? (airlineName(draft.fields.airline_iata) ?? draft.fields.airline_iata)
    : undefined
  const routeLabel = routeText(draft)
  const yearToConfirm = !draft.fields.date && ordinalOf(draft) !== null
  const monthDay = compact && !draft.fields.date ? monthDayOf(draft) : null
  const dateText = draft.fields.date
    ? formatDateOnly(locale, draft.fields.date, 'medium')
    : yearToConfirm
      ? S.yearToConfirm[locale]
      : monthDay
        ? formatMonthDay(locale, monthDay, 'short')
        : S.noDate[locale]
  const unscored = draft.fields.flown_required
    ? S.readFromBarcode[locale]
    : S.confidenceUnknown[locale]
  const flightNumber = draft.fields.flight_number
    ? `${draft.fields.airline_iata}${draft.fields.flight_number}`.trim()
    : undefined
  const needsYear = !draft.yearExplicit && !draft.yearConfirmed

  const toggle = (checked: boolean) =>
    onChange(
      duplicate ? { selected: checked, duplicateAcknowledged: checked } : { selected: checked },
    )

  const blockText = blocked.length ? tx(locale, BLOCK[blocked[0]]) : null
  const issue = issueText(draft, locale)
  const { stateText, failed: failedState } = edit

  const checkLabel = duplicate ? S.saveAnyway[locale] : S.selectRow[locale]
  const checkbox =
    compact && implicitSelection && !duplicate ? null : compact && singleton && !duplicate ? (
      <Button
        dense
        variant="ghost"
        disabled={blocked.length > 0 || frozen}
        onClick={() => toggle(!draft.selected)}
      >
        {draft.selected
          ? locale === 'ru'
            ? 'Исключить'
            : 'Exclude'
          : locale === 'ru'
            ? 'Добавить'
            : 'Include'}
      </Button>
    ) : (
      <label className="import-check">
        <input
          type="checkbox"
          checked={duplicate ? draft.selected && draft.duplicateAcknowledged : chosen}
          disabled={blocked.length > 0 || frozen}
          aria-describedby={
            [blockText && !compact && `${id}-block`, notVerified && `${id}-verification`]
              .filter(Boolean)
              .join(' ') || undefined
          }
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
      {quiet ? null : confidence === 'check' ? (
        <span className="import-chip" data-tone="warning">
          <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
          {S.check[locale]} · {percent(draft.confidence!)}%
        </span>
      ) : confidence === 'high' ? (
        <span className="import-chip">
          {S.confidence[locale]} {percent(draft.confidence!)}%
        </span>
      ) : (
        <span className="import-chip">{unscored}</span>
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
      {notVerified ? (
        <p className="import-note" id={`${id}-verification`}>
          {compact ? S.notVerifiedSave[locale] : S.notVerified[locale]}
        </p>
      ) : null}
      {blockText && !compact ? (
        <p className="import-note" id={`${id}-block`}>
          {blockText}
        </p>
      ) : null}
      {!compact && !draft.fields.date && monthDayOf(draft) ? (
        <p className="import-note">
          {S.monthDayNote[locale].replace('{date}', formatMonthDay(locale, monthDayOf(draft)!))}
        </p>
      ) : null}
      {!compact && yearToConfirm ? <p className="import-note">{S.ordinalNote[locale]}</p> : null}
      {issue ? <p className="import-note">{issue}</p> : null}
      <p
        className="import-note"
        role="status"
        data-state={state?.status ?? (dirty ? 'unsaved' : undefined)}
      >
        {failedState ? <CircleAlert size={16} strokeWidth={2} aria-hidden="true" /> : null}
        {failedState ? <span>{stateText}</span> : stateText || (dirty ? S.unsavedRow[locale] : '')}
      </p>
      {failedState ? (
        <div className="import-actions">
          <Button dense disabled={frozen} onClick={onRetry}>
            {S.retrySave[locale]}
          </Button>
          <Button dense variant="ghost" disabled={frozen} onClick={edit.discard}>
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
        onChange={edit.setValues}
        errors={errors}
        low={low}
        disabled={state?.status === 'saving' || frozen}
        year={
          needsYear && !compact
            ? {
                missing: !draft.fields.date && !values.date,
                checked: yearChecked,
                onChange: edit.setYearChecked,
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

  if (mobile && !compact) {
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
            (!draft.fields.date && (yearToConfirm || monthDayOf(draft))
              ? `${S.yearToConfirm[locale]}${quiet ? '' : ' · '}`
              : '') +
            (quiet
              ? ''
              : confidence === 'check'
                ? S.check[locale]
                : draft.confidence !== null
                  ? `${S.confidence[locale]} ${percent(draft.confidence)}%`
                  : unscored)
          }
          origin={{
            iata: draft.fields.origin || '—',
            city: draft.fields.origin ? city(draft.fields.origin) : draft.fields.origin_hint || '',
          }}
          destination={{
            iata: draft.fields.destination || '—',
            city: draft.fields.destination
              ? city(draft.fields.destination)
              : draft.fields.destination_hint || '',
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
        {compact ? null : flags}
        {notes}
        <Sheet
          initialDetent={1}
          open={sheet}
          onOpenChange={(next) => {
            setSheet(next)
            if (!next) edit.setErrors({})
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
                  if (edit.submit()) setSheet(false)
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
      data-low={!compact && (confidence === 'check' || low.length > 0) ? 'true' : undefined}
    >
      <div className="import-row-main">
        {checkbox}
        <div className="import-row-body">
          <p className="import-row-route">
            <RouteEndpoint draft={draft} endpoint="origin" />
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> {locale === 'ru' ? 'в' : 'to'} </span>
            <RouteEndpoint draft={draft} endpoint="destination" />
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
          {compact ? null : flags}
        </div>
      </div>
      {notes}
      {children}
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
            onClick={() => void edit.submit()}
          >
            {S.saveRow[locale]}
          </Button>
        </div>
      </Disclosure>
    </li>
  )
}
