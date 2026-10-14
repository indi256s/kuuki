'use client'

import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react'
import {
  GROUND_LIMITS,
  placeKey,
  placeLabel,
  type GroundPlaceOption,
  type GroundPlaceSnapshot,
} from '@kuuki/shared/groundTravel'
import type { Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { Field } from '../../ui/field'
import { AsyncCombobox } from '../../ui/combobox'
import { countryNamer, searchCountries } from '../../passport/model'
import { trackPrivateOperation } from '../../activity'
import { createManualPlace, searchPlaces } from '../api'
import { newId } from './model'

/** Region and country (and a manual marker), so two places with one name are never alike on screen. */
export function placeDetail(
  place: GroundPlaceSnapshot | GroundPlaceOption,
  locale: Locale,
  country: (code: string) => string,
): string {
  const option = place as GroundPlaceOption
  const region = locale === 'ru' ? (option.regionRu ?? place.region) : place.region
  return [
    region,
    country(place.countryCode),
    place.source === 'manual' ? (locale === 'ru' ? 'своё место' : 'manual place') : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const CATALOG_MIN_CHARS = 3

export function PlacePicker({
  label,
  locale,
  value,
  onChange,
  error,
  hint,
  disabled,
  inputRef,
}: {
  label: string
  locale: Locale
  value: GroundPlaceSnapshot | null
  onChange: (place: GroundPlaceSnapshot) => void
  error?: string
  hint?: string
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
}) {
  const ru = locale === 'ru'
  const country = useMemo(() => countryNamer(locale), [locale])
  const [manual, setManual] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const search = (query: string, signal: AbortSignal) => searchPlaces(query, locale, { signal })
  return (
    <div className="gt-place">
      <AsyncCombobox<GroundPlaceOption>
        label={label}
        locale={locale}
        selected={
          value
            ? { label: placeLabel(value, locale), detail: placeDetail(value, locale, country) }
            : null
        }
        search={search}
        toOption={(place) => ({
          key: placeKey(place),
          label: placeLabel(place, locale),
          detail: placeDetail(place, locale, country),
        })}
        onSelect={onChange}
        error={error}
        hint={hint}
        disabled={disabled}
        inputRef={inputRef}
        shortQueryText={(query) =>
          query.length < CATALOG_MIN_CHARS
            ? ru
              ? 'Продолжайте: каталог ищет от 3 букв.'
              : 'Keep typing: the catalog searches from 3 letters.'
            : null
        }
        footer={(close, query) => (
          <button
            type="button"
            className="flight-combobox-action"
            onClick={() => {
              setManual(query)
              close()
            }}
          >
            {ru ? 'Добавить место вручную' : 'Add a place manually'}
          </button>
        )}
      />
      {manual !== null && (
        <ManualPlaceForm
          locale={locale}
          initialName={manual}
          onCancel={() => setManual(null)}
          onCreated={(place) => {
            onChange(place)
            setManual(null)
            setAnnounce(
              ru
                ? `Место «${placeLabel(place, locale)}» добавлено`
                : `Place “${placeLabel(place, locale)}” added`,
            )
          }}
        />
      )}
      <p className="gt-sr" role="status">
        {announce}
      </p>
    </div>
  )
}

function parseCoordinate(value: string, limit: number): number | null | 'invalid' {
  const text = value.trim().replace(',', '.')
  if (text === '') return null
  if (!/^-?\d{1,3}(\.\d+)?$/.test(text)) return 'invalid'
  const n = Number(text)
  return Math.abs(n) <= limit ? n : 'invalid'
}

/** Name and country are required; coordinates are optional but come as a pair. The id makes a retry idempotent. */
export function ManualPlaceForm({
  locale,
  initialName,
  onCancel,
  onCreated,
}: {
  locale: Locale
  initialName: string
  onCancel: () => void
  onCreated: (place: GroundPlaceSnapshot) => void
}) {
  const ru = locale === 'ru'
  const nameFor = useMemo(() => countryNamer(locale), [locale])
  const countries = useMemo(() => searchCountries('', nameFor), [nameFor])
  const [name, setName] = useState(initialName)
  const [countryCode, setCountryCode] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const fieldId = useId()
  const operationId = useRef(newId())
  const nameRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    nameRef.current?.focus()
    return () => {
      alive.current = false
    }
  }, [])

  const latValue = parseCoordinate(lat, 90)
  const lonValue = parseCoordinate(lon, 180)
  const problems = {
    name: name.trim() === '' || name.trim().length > GROUND_LIMITS.placeName,
    country: countryCode === '',
    coordinates:
      latValue === 'invalid' ||
      lonValue === 'invalid' ||
      (latValue === null) !== (lonValue === null),
  }
  const submit = async () => {
    setSubmitted(true)
    if (problems.name || problems.country || problems.coordinates) return
    setBusy(true)
    setFailure('')
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    try {
      const place = await createManualPlace(
        {
          id: operationId.current,
          name: name.trim(),
          countryCode,
          lat: latValue as number | null,
          lon: lonValue as number | null,
          timezone: null,
        },
        { signal: controller.signal },
      )
      if (alive.current) onCreated(place)
    } catch (error) {
      if (alive.current && !controller.signal.aborted)
        setFailure(
          error instanceof Error && error.message
            ? error.message
            : ru
              ? 'Не удалось добавить место. Повторите попытку.'
              : 'Could not add the place. Try again.',
        )
    } finally {
      release()
      if (alive.current) setBusy(false)
    }
  }
  return (
    <div
      className="gt-manual"
      role="group"
      aria-label={ru ? 'Новое место' : 'New place'}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault()
          void submit()
        }
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <Field
        ref={nameRef}
        label={ru ? 'Название места' : 'Place name'}
        value={name}
        maxLength={GROUND_LIMITS.placeName}
        autoComplete="off"
        onChange={(event) => setName(event.target.value)}
        error={
          submitted && problems.name ? (ru ? 'Укажите название.' : 'Enter a name.') : undefined
        }
      />
      <div className="ui-field">
        <label className="ui-field-label" htmlFor={`${fieldId}-country`}>
          {ru ? 'Страна' : 'Country'}
        </label>
        <select
          id={`${fieldId}-country`}
          className="ui-field-input gt-select"
          value={countryCode}
          aria-invalid={submitted && problems.country ? true : undefined}
          onChange={(event) => setCountryCode(event.target.value)}
        >
          <option value="">{ru ? 'Выберите страну' : 'Choose a country'}</option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {nameFor(code)}
            </option>
          ))}
        </select>
        <p className="ui-field-error" role={submitted && problems.country ? 'alert' : undefined}>
          {submitted && problems.country ? (ru ? 'Выберите страну.' : 'Choose a country.') : null}
        </p>
      </div>
      <div className="gt-pair">
        <Field
          label={ru ? 'Широта' : 'Latitude'}
          optionalLabel={ru ? 'необязательно' : 'optional'}
          inputMode="decimal"
          value={lat}
          autoComplete="off"
          onChange={(event) => setLat(event.target.value)}
        />
        <Field
          label={ru ? 'Долгота' : 'Longitude'}
          optionalLabel={ru ? 'необязательно' : 'optional'}
          inputMode="decimal"
          value={lon}
          autoComplete="off"
          onChange={(event) => setLon(event.target.value)}
          error={
            submitted && problems.coordinates
              ? ru
                ? 'Укажите обе координаты в градусах (широта до 90, долгота до 180) или ни одной.'
                : 'Enter both coordinates in degrees (latitude up to 90, longitude up to 180), or neither.'
              : undefined
          }
        />
      </div>
      {failure && (
        <p className="gt-error-text" role="alert">
          {failure}
        </p>
      )}
      <div className="gt-actions">
        <Button
          variant="primary"
          loading={busy}
          loadingLabel={ru ? 'Добавляем…' : 'Adding…'}
          onClick={() => void submit()}
        >
          {ru ? 'Добавить место' : 'Add place'}
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          {ru ? 'Отмена' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}
