'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Plus } from '@keyline-icons/react'
import { GROUND_LIMITS, placeLabel, railLegDuration } from '@kuuki/shared/groundTravel'
import { formatDateOnly, type Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { Field } from '../../ui/field'
import { knownDuration } from '../format'
import { DateField, errorText, TimeField } from './fields'
import { emptyLeg, legPreview, parseWholeNumber, type FormErrors, type LegDraft } from './model'
import type { Preview } from './ocr/model'
import { moved, OrderedRows, RowDetails, RowFields } from './ordered-rows'
import { countryNamer } from '../../passport/model'
import { PlacePicker, placeDetail } from './place-picker'

/**
 * How the OCR panel (a later change) hands recognized legs to the form.
 * - `append`: the candidates are added after the last leg.
 * - `replace` with `replaceLegId`: that leg is swapped for the candidates, in place.
 * - `replace` without an id: the whole route is replaced.
 * Nothing else in the form changes: journey dates, status and countries stay as the owner left them.
 */
export type RailCandidateMode = 'append' | 'replace'

/** Previews received and not yet added, as the draft keeps them (see draft.ts). */
export interface StoredOcrRow {
  id: string
  fileName: string
  fileSize: number | null
  previews: Preview[]
}

export interface RailOcrSlotApi {
  legs: readonly LegDraft[]
  /** Returns false, changing nothing, when the result would pass the leg limit. */
  onCandidates: (candidates: LegDraft[], mode: RailCandidateMode, replaceLegId?: string) => boolean
  disabled: boolean
  /** Rows restored from the draft when the form opened; read once, at mount. */
  restoredRows: readonly StoredOcrRow[]
  /** Reports the rows still holding unadded previews, so the draft can keep them across a reload. */
  onUnaddedChange: (rows: StoredOcrRow[]) => void
}

/** The route after the hand-off, or null when it would pass the leg limit (nothing is cut off silently). */
export function applyLegCandidates(
  legs: readonly LegDraft[],
  candidates: readonly LegDraft[],
  mode: RailCandidateMode,
  replaceLegId?: string,
): LegDraft[] | null {
  if (candidates.length === 0) return [...legs]
  const room = (list: LegDraft[]) => (list.length <= GROUND_LIMITS.children ? list : null)
  if (mode === 'append') return room([...legs, ...candidates])
  if (replaceLegId === undefined) return room([...candidates])
  const index = legs.findIndex((leg) => leg.id === replaceLegId)
  if (index < 0) return room([...legs, ...candidates])
  return room([...legs.slice(0, index), ...candidates, ...legs.slice(index + 1)])
}

const ignoreUnadded = () => {}

export function RailEditor({
  ownerId,
  legs,
  onChange,
  locale,
  errors,
  disabled,
  ocrSlot,
  ocrDraft,
}: {
  ownerId: string
  legs: LegDraft[]
  onChange: (legs: LegDraft[]) => void
  locale: Locale
  errors: FormErrors
  disabled: boolean
  /** Where the OCR panel mounts: rendered above the legs with the candidate entry point. */
  ocrSlot?: (api: RailOcrSlotApi) => ReactNode
  /** The unadded OCR previews the draft keeps: restored into the slot, reported back on change. */
  ocrDraft?: Pick<RailOcrSlotApi, 'restoredRows' | 'onUnaddedChange'>
}) {
  const ru = locale === 'ru'
  const root = useRef<HTMLDivElement>(null)
  const added = useRef<string | null>(null)
  // Legs added in this session start open even when their start is already known.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const name = (place: LegDraft['from']) => (place ? placeLabel(place, locale) : '?')
  const update = (id: string, patch: Partial<LegDraft>) =>
    onChange(legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)))

  useEffect(() => {
    const id = added.current
    if (!id) return
    added.current = null
    const inputs = root.current?.querySelectorAll<HTMLInputElement>(
      `[data-row-id="${id}"] input[role="combobox"]`,
    )
    const empty = inputs && [...inputs].find((input) => input.value === '')
    ;(empty ?? inputs?.[0])?.focus()
  })

  const addLeg = () => {
    // A transfer starts where the last leg ended, so the known city is not typed again.
    const leg = emptyLeg(legs.at(-1)?.to ?? null)
    added.current = leg.id
    setFresh((ids) => new Set(ids).add(leg.id))
    onChange([...legs, leg])
  }
  const full = legs.length >= GROUND_LIMITS.children

  return (
    <div ref={root} className="gt-editor">
      {ocrSlot?.({
        legs,
        disabled,
        restoredRows: ocrDraft?.restoredRows ?? [],
        onUnaddedChange: ocrDraft?.onUnaddedChange ?? ignoreUnadded,
        onCandidates: (candidates, mode, replaceLegId) => {
          const next = applyLegCandidates(legs, candidates, mode, replaceLegId)
          if (next) onChange(next)
          return next !== null
        },
      })}
      <OrderedRows
        items={legs}
        ownerId={ownerId}
        locale={locale}
        label={ru ? 'Участки маршрута' : 'Route legs'}
        title={(leg, index) => `${ru ? 'Участок' : 'Leg'} ${index + 1}`}
        name={(leg, index) =>
          ru
            ? `Участок ${index + 1}, ${name(leg.from)} — ${name(leg.to)}`
            : `leg ${index + 1}, ${name(leg.from)} to ${name(leg.to)}`
        }
        onMove={(from, to) => onChange(moved(legs, from, to))}
        onRemove={(id) => onChange(legs.filter((leg) => leg.id !== id))}
        onRestore={onChange}
        removeDisabledReason={
          legs.length <= 1
            ? ru
              ? 'Нужен хотя бы один участок.'
              : 'A train journey needs at least one leg.'
            : undefined
        }
        disabled={disabled}
      >
        {(leg) => (
          <LegFields
            leg={leg}
            locale={locale}
            errors={errors}
            disabled={disabled}
            fresh={fresh.has(leg.id)}
            onChange={(patch) => update(leg.id, patch)}
          />
        )}
      </OrderedRows>
      <Button
        icon={<Plus size={18} />}
        disabled={disabled || full}
        disabledReason={
          full
            ? ru
              ? 'Достигнут предел в 100 участков.'
              : 'The limit of 100 legs is reached.'
            : undefined
        }
        onClick={addLeg}
      >
        {ru ? 'Добавить участок' : 'Add a leg'}
      </Button>
    </div>
  )
}

function LegFields({
  leg,
  locale,
  errors,
  disabled,
  fresh,
  onChange,
}: {
  leg: LegDraft
  locale: Locale
  errors: FormErrors
  disabled: boolean
  fresh: boolean
  onChange: (patch: Partial<LegDraft>) => void
}) {
  const ru = locale === 'ru'
  const error = (field: string) => errorText(errors[`leg:${leg.id}:${field}`], locale)
  // A printed city asks for a search, never a choice: the owner still picks the place from the list.
  const [find, setFind] = useState<{ side: 'from' | 'to'; nonce: number } | null>(null)
  const pending = {
    from: !leg.from && leg.fromCity ? leg.fromCity : null,
    to: !leg.to && leg.toCity ? leg.toCity : null,
  }
  const prefill = (side: 'from' | 'to') =>
    find?.side === side && pending[side] ? { text: pending[side], nonce: find.nonce } : undefined
  const detailsError = [
    'departureTime',
    'arrivalTime',
    'fromStation',
    'toStation',
    'trainNumber',
    'operator',
    'durationManual',
  ].some((field) => !!error(field))
  const country = countryNamer(locale)
  // With no typed duration the server derives one from the schedule; show that figure as a fact, never as a field value.
  const schedule = useMemo(() => {
    const input = legPreview(leg)
    return input && leg.durationManual.trim() === '' ? railLegDuration(input) : null
  }, [leg])
  const durationHint =
    leg.durationManual.trim() !== '' && parseWholeNumber(leg.durationManual, 1, 20_160) === null
      ? undefined
      : schedule?.minutes != null
        ? ru
          ? `По расписанию ≈ ${knownDuration(locale, schedule.minutes)}. Введите своё значение, чтобы заменить.`
          : `From the schedule ≈ ${knownDuration(locale, schedule.minutes)}. Enter your own to replace it.`
        : ru
          ? 'Если оставить пустым, время возьмётся из расписания, когда его хватает.'
          : 'Left empty, the time comes from the schedule when it has enough to go on.'
  const when = [
    leg.departureDate && formatDateOnly(locale, leg.departureDate, 'medium'),
    leg.departureTime,
  ]
    .filter(Boolean)
    .join(' ')
  const summary =
    leg.from && leg.to ? `${placeLabel(leg.from, locale)} → ${placeLabel(leg.to, locale)}` : ''
  const detail = [
    leg.from && leg.to
      ? `${placeDetail(leg.from, locale, country)} → ${placeDetail(leg.to, locale, country)}`
      : '',
    when,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <RowFields
      locale={locale}
      summary={summary}
      detail={detail}
      disabled={disabled}
      complete={!!leg.from && !!leg.to}
      hasError={Object.keys(errors).some((key) => key.startsWith(`leg:${leg.id}:`))}
      fresh={fresh}
    >
      <div className="gt-fields">
        <div className="gt-pair">
          <PlacePicker
            label={ru ? 'Откуда' : 'From'}
            locale={locale}
            value={leg.from}
            onChange={(from) => onChange({ from, fromCity: undefined })}
            error={error('from')}
            disabled={disabled}
            prefill={prefill('from')}
          />
          <PlacePicker
            label={ru ? 'Куда' : 'To'}
            locale={locale}
            value={leg.to}
            onChange={(to) => onChange({ to, toCity: undefined })}
            error={error('to')}
            disabled={disabled}
            prefill={prefill('to')}
          />
        </div>
        {(pending.from || pending.to) && (
          <div className="gt-actions">
            {(['from', 'to'] as const).map((side) => {
              const city = pending[side]
              if (!city) return null
              const sideLabel = side === 'from' ? (ru ? 'Откуда' : 'From') : ru ? 'Куда' : 'To'
              const text = ru ? `Найти «${city}»` : `Find “${city}”`
              return (
                <Button
                  key={side}
                  disabled={disabled}
                  aria-label={`${text}: ${sideLabel}`}
                  onClick={() => setFind({ side, nonce: (find?.nonce ?? 0) + 1 })}
                >
                  {text}
                </Button>
              )
            })}
          </div>
        )}
        <div className="gt-pair">
          <DateField
            label={ru ? 'Дата отправления' : 'Departure date'}
            value={leg.departureDate}
            locale={locale}
            onChange={(departureDate) => onChange({ departureDate })}
            error={error('departureDate')}
            disabled={disabled}
          />
          <DateField
            label={ru ? 'Дата прибытия' : 'Arrival date'}
            value={leg.arrivalDate}
            locale={locale}
            onChange={(arrivalDate) => onChange({ arrivalDate })}
            error={error('arrivalDate')}
            disabled={disabled}
          />
        </div>
        <RowDetails locale={locale} hasError={detailsError}>
          <div className="gt-fields">
            <div className="gt-pair">
              <TimeField
                label={ru ? 'Время отправления (местное)' : 'Departure time (local)'}
                value={leg.departureTime}
                locale={locale}
                onChange={(departureTime) => onChange({ departureTime })}
                error={error('departureTime')}
                disabled={disabled}
              />
              <TimeField
                label={ru ? 'Время прибытия (местное)' : 'Arrival time (local)'}
                value={leg.arrivalTime}
                locale={locale}
                onChange={(arrivalTime) => onChange({ arrivalTime })}
                error={error('arrivalTime')}
                disabled={disabled}
              />
            </div>
            <div className="gt-pair">
              <Field
                label={ru ? 'Станция отправления' : 'Departure station'}
                optionalLabel={ru ? 'необязательно' : 'optional'}
                value={leg.fromStation}
                maxLength={GROUND_LIMITS.station}
                disabled={disabled}
                onChange={(event) => onChange({ fromStation: event.target.value })}
                error={error('fromStation')}
              />
              <Field
                label={ru ? 'Станция прибытия' : 'Arrival station'}
                optionalLabel={ru ? 'необязательно' : 'optional'}
                value={leg.toStation}
                maxLength={GROUND_LIMITS.station}
                disabled={disabled}
                onChange={(event) => onChange({ toStation: event.target.value })}
                error={error('toStation')}
              />
            </div>
            <div className="gt-pair">
              <Field
                label={ru ? 'Номер поезда' : 'Train number'}
                optionalLabel={ru ? 'необязательно' : 'optional'}
                value={leg.trainNumber}
                maxLength={GROUND_LIMITS.trainNumber}
                disabled={disabled}
                onChange={(event) => onChange({ trainNumber: event.target.value })}
                error={error('trainNumber')}
              />
              <Field
                label={ru ? 'Перевозчик' : 'Operator'}
                optionalLabel={ru ? 'необязательно' : 'optional'}
                value={leg.operator}
                maxLength={GROUND_LIMITS.operator}
                disabled={disabled}
                onChange={(event) => onChange({ operator: event.target.value })}
                error={error('operator')}
              />
            </div>
            <Field
              label={ru ? 'Время в пути, минут' : 'Time on the train, minutes'}
              optionalLabel={ru ? 'необязательно' : 'optional'}
              hint={durationHint}
              hintPosition="below"
              inputMode="numeric"
              value={leg.durationManual}
              disabled={disabled}
              onChange={(event) => onChange({ durationManual: event.target.value })}
              error={error('durationManual')}
            />
          </div>
        </RowDetails>
      </div>
    </RowFields>
  )
}
