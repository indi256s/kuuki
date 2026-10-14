'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Plus } from '@keyline-icons/react'
import { GROUND_LIMITS, placeLabel, railLegDuration } from '@kuuki/shared/groundTravel'
import type { Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { Disclosure } from '../../ui/disclosure'
import { Field } from '../../ui/field'
import { knownDuration } from '../format'
import { DateField, errorText, TimeField } from './fields'
import { emptyLeg, legPreview, parseWholeNumber, type FormErrors, type LegDraft } from './model'
import { moved, OrderedRows } from './ordered-rows'
import { PlacePicker } from './place-picker'

/**
 * How the OCR panel (a later change) hands recognized legs to the form.
 * - `append`: the candidates are added after the last leg.
 * - `replace` with `replaceLegId`: that leg is swapped for the candidates, in place.
 * - `replace` without an id: the whole route is replaced.
 * Nothing else in the form changes: journey dates, status and countries stay as the owner left them.
 */
export type RailCandidateMode = 'append' | 'replace'

export interface RailOcrSlotApi {
  legs: readonly LegDraft[]
  onCandidates: (candidates: LegDraft[], mode: RailCandidateMode, replaceLegId?: string) => void
  disabled: boolean
}

export function applyLegCandidates(
  legs: readonly LegDraft[],
  candidates: readonly LegDraft[],
  mode: RailCandidateMode,
  replaceLegId?: string,
): LegDraft[] {
  if (candidates.length === 0) return [...legs]
  const room = (list: LegDraft[]) => list.slice(0, GROUND_LIMITS.children)
  if (mode === 'append') return room([...legs, ...candidates])
  if (replaceLegId === undefined) return room([...candidates])
  const index = legs.findIndex((leg) => leg.id === replaceLegId)
  if (index < 0) return room([...legs, ...candidates])
  return room([...legs.slice(0, index), ...candidates, ...legs.slice(index + 1)])
}

export function RailEditor({
  legs,
  onChange,
  locale,
  errors,
  disabled,
  ocrSlot,
}: {
  legs: LegDraft[]
  onChange: (legs: LegDraft[]) => void
  locale: Locale
  errors: FormErrors
  disabled: boolean
  /** Where the OCR panel mounts: rendered above the legs with the candidate entry point. */
  ocrSlot?: (api: RailOcrSlotApi) => ReactNode
}) {
  const ru = locale === 'ru'
  const root = useRef<HTMLDivElement>(null)
  const added = useRef<string | null>(null)
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
    onChange([...legs, leg])
  }
  const full = legs.length >= GROUND_LIMITS.children

  return (
    <div ref={root} className="gt-editor">
      {ocrSlot?.({
        legs,
        disabled,
        onCandidates: (candidates, mode, replaceLegId) =>
          onChange(applyLegCandidates(legs, candidates, mode, replaceLegId)),
      })}
      <OrderedRows
        items={legs}
        locale={locale}
        label={ru ? 'Участки маршрута' : 'Route legs'}
        title={(leg, index) =>
          `${ru ? 'Участок' : 'Leg'} ${index + 1}${leg.from || leg.to ? `: ${name(leg.from)} → ${name(leg.to)}` : ''}`
        }
        name={(leg, index) =>
          ru
            ? `Участок ${index + 1}, ${name(leg.from)} — ${name(leg.to)}`
            : `leg ${index + 1}, ${name(leg.from)} to ${name(leg.to)}`
        }
        onMove={(from, to) => onChange(moved(legs, from, to))}
        onRemove={(id) => onChange(legs.filter((leg) => leg.id !== id))}
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
  onChange,
}: {
  leg: LegDraft
  locale: Locale
  errors: FormErrors
  disabled: boolean
  onChange: (patch: Partial<LegDraft>) => void
}) {
  const ru = locale === 'ru'
  const error = (field: string) => errorText(errors[`leg:${leg.id}:${field}`], locale)
  const detailsFilled = [
    leg.fromStation,
    leg.toStation,
    leg.trainNumber,
    leg.operator,
    leg.durationManual,
  ].some((value) => value.trim() !== '')
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
  return (
    <div className="gt-fields">
      <div className="gt-pair">
        <PlacePicker
          label={ru ? 'Откуда' : 'From'}
          locale={locale}
          value={leg.from}
          onChange={(from) => onChange({ from })}
          error={error('from')}
          disabled={disabled}
        />
        <PlacePicker
          label={ru ? 'Куда' : 'To'}
          locale={locale}
          value={leg.to}
          onChange={(to) => onChange({ to })}
          error={error('to')}
          disabled={disabled}
        />
      </div>
      <div className="gt-pair">
        <DateField
          label={ru ? 'Дата отправления' : 'Departure date'}
          value={leg.departureDate}
          locale={locale}
          onChange={(departureDate) => onChange({ departureDate })}
          error={error('departureDate')}
          disabled={disabled}
        />
        <TimeField
          label={ru ? 'Время отправления (местное)' : 'Departure time (local)'}
          value={leg.departureTime}
          locale={locale}
          onChange={(departureTime) => onChange({ departureTime })}
          error={error('departureTime')}
          disabled={disabled}
        />
      </div>
      <div className="gt-pair">
        <DateField
          label={ru ? 'Дата прибытия' : 'Arrival date'}
          value={leg.arrivalDate}
          locale={locale}
          onChange={(arrivalDate) => onChange({ arrivalDate })}
          error={error('arrivalDate')}
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
      <Disclosure
        layout="row"
        defaultOpen={detailsFilled}
        summary={ru ? 'Станции, поезд и время в пути' : 'Stations, train and time on the train'}
      >
        <div className="gt-fields">
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
            inputMode="numeric"
            value={leg.durationManual}
            disabled={disabled}
            onChange={(event) => onChange({ durationManual: event.target.value })}
            error={error('durationManual')}
          />
        </div>
      </Disclosure>
    </div>
  )
}
