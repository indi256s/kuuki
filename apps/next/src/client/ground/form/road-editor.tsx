'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUTurnLeft, Plus } from '@keyline-icons/react'
import { GROUND_LIMITS, placeLabel } from '@kuuki/shared/groundTravel'
import { formatDateOnly, type Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { Disclosure } from '../../ui/disclosure'
import { Field } from '../../ui/field'
import { DateField, errorText, TextAreaField } from './fields'
import { emptyPoint, samePlace, type FormErrors, type PointDraft } from './model'
import { moved, OrderedRows, RowFields } from './ordered-rows'
import { PlacePicker } from './place-picker'

export function RoadEditor({
  ownerId,
  points,
  onChange,
  locale,
  errors,
  disabled,
}: {
  ownerId: string
  points: PointDraft[]
  onChange: (points: PointDraft[]) => void
  locale: Locale
  errors: FormErrors
  disabled: boolean
}) {
  const ru = locale === 'ru'
  const root = useRef<HTMLDivElement>(null)
  const added = useRef<string | null>(null)
  // Stops added in this session start open even when their city is already filled (Return to start).
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const name = (point: PointDraft) => (point.place ? placeLabel(point.place, locale) : '?')
  const update = (id: string, patch: Partial<PointDraft>) =>
    onChange(points.map((point) => (point.id === id ? { ...point, ...patch } : point)))

  useEffect(() => {
    const id = added.current
    if (!id) return
    added.current = null
    const inputs = root.current?.querySelectorAll<HTMLInputElement>(
      `[data-row-id="${id}"] input[role="combobox"]`,
    )
    inputs?.[0]?.focus()
  })

  const full = points.length >= GROUND_LIMITS.children
  const first = points[0]?.place ?? null
  const last = points.at(-1)?.place ?? null
  const returnBlocked = !first
    ? ru
      ? 'Сначала выберите стартовый город.'
      : 'Choose the start city first.'
    : points.length < 2 || samePlace(first, last)
      ? ru
        ? 'Маршрут уже заканчивается в стартовом городе.'
        : 'The route already ends at the start.'
      : full
        ? ru
          ? 'Достигнут предел в 100 пунктов.'
          : 'The limit of 100 stops is reached.'
        : undefined

  return (
    <div ref={root} className="gt-editor">
      <OrderedRows
        items={points}
        ownerId={ownerId}
        locale={locale}
        label={ru ? 'Пункты маршрута' : 'Route stops'}
        title={(point, index) =>
          `${index === 0 ? (ru ? 'Старт' : 'Start') : `${ru ? 'Пункт' : 'Stop'} ${index + 1}`}${point.place ? `: ${name(point)}` : ''}`
        }
        name={(point, index) =>
          ru
            ? `Пункт ${index + 1}, ${name(point)}`
            : `${name(point)}, stop ${index + 1} of ${points.length}`
        }
        onMove={(from, to) => onChange(moved(points, from, to))}
        onRemove={(id) => onChange(points.filter((point) => point.id !== id))}
        onRestore={onChange}
        removeDisabledReason={
          points.length <= 2
            ? ru
              ? 'Нужны минимум два пункта.'
              : 'A road trip needs at least two stops.'
            : undefined
        }
        disabled={disabled}
      >
        {(point) => {
          const error = (field: string) => errorText(errors[`point:${point.id}:${field}`], locale)
          const detailsFilled = [
            point.arrivalDate,
            point.departureDate,
            point.nights,
            point.note,
          ].some((value) => value.trim() !== '')
          const when = [
            point.arrivalDate && formatDateOnly(locale, point.arrivalDate, 'medium'),
            point.departureDate && formatDateOnly(locale, point.departureDate, 'medium'),
          ]
            .filter(Boolean)
            .join(' – ')
          const summary = [point.place ? name(point) : '', when].filter(Boolean).join(' · ')
          return (
            <RowFields
              locale={locale}
              summary={summary}
              complete={!!point.place}
              hasError={Object.keys(errors).some((key) => key.startsWith(`point:${point.id}:`))}
              fresh={fresh.has(point.id)}
            >
              <div className="gt-fields">
                <PlacePicker
                  label={ru ? 'Город' : 'City'}
                  locale={locale}
                  value={point.place}
                  onChange={(place) => update(point.id, { place })}
                  error={error('place')}
                  disabled={disabled}
                />
                <Disclosure
                  layout="row"
                  defaultOpen={detailsFilled}
                  summary={ru ? 'Даты, ночёвки и заметка' : 'Dates, nights and a note'}
                >
                  <div className="gt-fields">
                    <div className="gt-pair">
                      <DateField
                        label={ru ? 'Дата прибытия' : 'Arrival date'}
                        value={point.arrivalDate}
                        locale={locale}
                        onChange={(arrivalDate) => update(point.id, { arrivalDate })}
                        error={error('arrivalDate')}
                        disabled={disabled}
                      />
                      <DateField
                        label={ru ? 'Дата отъезда' : 'Departure date'}
                        value={point.departureDate}
                        locale={locale}
                        onChange={(departureDate) => update(point.id, { departureDate })}
                        error={error('departureDate')}
                        disabled={disabled}
                      />
                    </div>
                    <Field
                      label={ru ? 'Ночёвок' : 'Nights'}
                      optionalLabel={ru ? 'необязательно' : 'optional'}
                      inputMode="numeric"
                      value={point.nights}
                      disabled={disabled}
                      onChange={(event) => update(point.id, { nights: event.target.value })}
                      error={error('nights')}
                    />
                    <TextAreaField
                      label={ru ? 'Заметка' : 'Note'}
                      optionalLabel={ru ? 'необязательно' : 'optional'}
                      value={point.note}
                      maxLength={GROUND_LIMITS.note}
                      disabled={disabled}
                      onChange={(event) => update(point.id, { note: event.target.value })}
                      error={error('note')}
                    />
                  </div>
                </Disclosure>
              </div>
            </RowFields>
          )
        }}
      </OrderedRows>
      <div className="gt-actions">
        <Button
          icon={<Plus size={18} />}
          disabled={disabled || full}
          onClick={() => {
            const point = emptyPoint()
            added.current = point.id
            setFresh((ids) => new Set(ids).add(point.id))
            onChange([...points, point])
          }}
        >
          {ru ? 'Добавить пункт' : 'Add a stop'}
        </Button>
        <Button
          icon={<ArrowUTurnLeft size={18} />}
          disabled={disabled}
          disabledReason={returnBlocked}
          onClick={() => {
            // A new stop with its own identity at the start city; the first stop is not reused or merged.
            const point = emptyPoint(first)
            added.current = point.id
            setFresh((ids) => new Set(ids).add(point.id))
            onChange([...points, point])
          }}
        >
          {ru ? 'Вернуться в начало' : 'Return to start'}
        </Button>
      </div>
    </div>
  )
}
