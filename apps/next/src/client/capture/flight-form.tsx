'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useOnline } from '../awaiting'
import { useRouter } from 'next/navigation'
import { useForm, useController, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { validateFlightInput } from '@kuuki/shared'
import { Button } from '../ui/button'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { CircleAlert, TriangleAlert, Undo, ArrowRight } from '@keyline-icons/react'
import { Combobox } from '../ui/combobox'
import { Disclosure } from '../ui/disclosure'
import { RouteCard, type RouteControl } from './route-card'
import { DateTiles, dayParts, localDay } from './date-tiles'
import { legSummary } from './flight-leg'
import { Ticket } from '../signature/ticket'
import { formatDateOnly, formatDuration } from '../../lib/format'
import { airportChoices, airlineChoices, aircraftChoices } from './reference-choices'
import {
  readCapturePreference,
  removeCapturePreference,
  writeCapturePreference,
} from './capture-preferences'
import { findAirport } from '@kuuki/data/airport-lookup'
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import {
  calculateFlightDistance,
  calculateFlightDuration,
  estimateFlightDuration,
} from '@kuuki/client/geo'
import {
  checkDuplicateFlight,
  deleteFlight,
  getFlight,
  getRecentFlights,
  type Flight,
} from '@kuuki/client/flights'
import { createFlight, updateFlight } from './flight-writes'
import {
  abandonFlightCreateOperation,
  currentFlightOperationId,
  pendingFlightCreateOperation,
  rotateFlightOperationId,
} from '@kuuki/client/flightCreateOperations'
import { ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import { flightErrorMessage, validateFlightValues } from './flight-messages'
import type { Locale } from '../../server/locale'
import type { DerivedAck } from '@kuuki/client/derivedState'
import './capture.css'

const empty = {
  date: '',
  origin: '',
  destination: '',
  airline: '',
  aircraft: '',
  number: '',
  departure: '',
  arrival: '',
}
type Values = typeof empty
/** Unfinished manual entry, kept per account until saved, discarded or cleared on sign-out. */
const UNFINISHED = 'unfinished'
function readUnfinished(ownerId: string): Values | null {
  const stored = readCapturePreference<Partial<Values> | null>(ownerId, UNFINISHED, null)
  if (!stored || typeof stored !== 'object') return null
  const values = { ...empty }
  for (const key of Object.keys(empty) as (keyof Values)[])
    if (typeof stored[key] === 'string') values[key] = stored[key]
  return Object.values(values).some(Boolean) ? values : null
}
const optionalKeys = ['airline', 'number', 'aircraft', 'departure', 'arrival'] as const
function input(values: Values) {
  return {
    date: values.date,
    origin: values.origin,
    destination: values.destination,
    airline_iata: values.airline || null,
    aircraft_icao: values.aircraft || null,
    flight_number: values.number || null,
    departure_time: values.departure || null,
    arrival_time: values.arrival || null,
  }
}
export type FlightSurface = (content: ReactNode, footer?: ReactNode) => ReactNode

export function FlightForm({
  ownerId,
  locale,
  editId,
  initialEditing = true,
  focusField,
  surface,
  onCancel,
  onOpenJournal,
  onDelete,
  onSaved,
  onCreated,
}: {
  ownerId: string
  locale: Locale
  editId?: number
  initialEditing?: boolean
  /** Opens Optional details and focuses this field once the flight has loaded. */ focusField?: 'aircraft'
  surface?: FlightSurface
  onCancel?: () => void
  onOpenJournal?: () => void
  onDelete?: (id: number) => void
  onSaved?: (
    flight: Flight & DerivedAck,
    publication: 'idle' | 'ready' | 'pending' | 'delayed',
  ) => void
  /**
   * A confirmed new flight. The owner closes the form and reports the save, so the form does not show its saved state or
   * track totals publication; it calls this once per canonical acknowledgement.
   */
  onCreated?: (
    flight: Flight & DerivedAck,
    route: Pick<Values, 'date' | 'origin' | 'destination'>,
  ) => void
}) {
  const router = useRouter()
  const online = useOnline()
  const feedback = useWriteFeedback(ownerId)
  const ru = locale === 'ru'
  const choices = airportChoices(locale)
  const formId = `flight-form-${editId ?? 'new'}`
  const [editing, setEditing] = useState(initialEditing)
  const [recents, setRecents] = useState<Record<'airports' | 'airline' | 'aircraft', string[]>>(
    () => ({
      airports: readCapturePreference(ownerId, 'airports', []),
      airline: readCapturePreference(ownerId, 'airline', []),
      aircraft: readCapturePreference(ownerId, 'aircraft', []),
    }),
  )
  const remember = (kind: keyof typeof recents, code: string) => {
    const next = [code, ...recents[kind].filter((item) => item !== code)].slice(0, 8)
    setRecents((previous) => ({ ...previous, [kind]: next }))
    writeCapturePreference(ownerId, kind, next)
  }
  // Offline never disables typing: only save and delete are blocked, each with its own visible reason.
  const saveReason = !online
    ? ru
      ? 'Нет сети. Подключитесь, чтобы сохранить.'
      : 'Offline. Connect to save.'
    : undefined
  const deleteReason = !online
    ? ru
      ? 'Нет сети. Подключитесь, чтобы удалить.'
      : 'Offline. Connect to delete.'
    : undefined
  const wrap = (content: ReactNode, footer?: ReactNode) =>
    surface ? (
      surface(content, footer)
    ) : (
      <>
        {content}
        {footer}
      </>
    )
  const [operationId, setOperationId] = useState(() =>
    currentFlightOperationId(`next-manual:${ownerId}`),
  )
  const [flight, setFlight] = useState<Flight | null>(null)
  const [loading, setLoading] = useState(!!editId)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [errorCause, setErrorCause] = useState<{ cause: unknown; kind: 'load' | 'save' } | null>(
    null,
  )
  const error = errorCause ? flightErrorMessage(errorCause.cause, locale, errorCause.kind) : ''
  const [duplicate, setDuplicate] = useState<Flight | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const duplicateRef = useRef<HTMLDivElement>(null)
  const [focusBlockedSave, setFocusBlockedSave] = useState(false)
  useEffect(() => {
    if (!busy && focusBlockedSave) {
      setFocusBlockedSave(false)
      const notice = error ? errorRef.current : duplicateRef.current
      notice?.focus()
    }
  }, [busy, error, duplicate, focusBlockedSave])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteCause, setDeleteCause] = useState<unknown>(null)
  const deleteError = deleteCause ? flightErrorMessage(deleteCause, locale, 'delete') : ''
  const [saved, setSaved] = useState(false)
  const [savedFlight, setSavedFlight] = useState<(Flight & DerivedAck) | null>(null)
  useEffect(() => {
    if (savedFlight) onSaved?.(savedFlight, feedback.status)
  }, [savedFlight, feedback.status, onSaved])
  const savedHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (saved) savedHeading.current?.focus()
  }, [saved])
  // A new entry restores unfinished input; the previous flight's layout never decides a fresh entry's layout.
  const [restored, setRestored] = useState(() => (editId ? null : readUnfinished(ownerId)))
  const [showDetails, setShowDetails] = useState(() =>
    editId
      ? readCapturePreference(ownerId, 'details', false)
      : optionalKeys.some((key) => restored?.[key]),
  )
  const schema = z
    .object({
      date: z.string(),
      origin: z.string(),
      destination: z.string(),
      airline: z.string(),
      aircraft: z.string(),
      number: z.string(),
      departure: z.string(),
      arrival: z.string(),
    })
    .superRefine((raw, ctx) => {
      for (const [field, message] of Object.entries(validateFlightValues(raw as Values, locale)))
        ctx.addIssue({ code: 'custom', path: [field], message })
    })
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: restored ?? empty,
    mode: 'onTouched',
  })
  const { control, register, handleSubmit, watch, setValue, reset, formState, setFocus } = form
  const values = watch()
  const { date, origin, destination } = values
  const { field: from } = useController({ name: 'origin', control })
  const { field: to } = useController({ name: 'destination', control })
  // Keep unfinished input across dismissal and reload. A failed write is said out loud; the input stays usable here.
  const [storageFailed, setStorageFailed] = useState(false)
  const savedOnce = useRef(false)
  useEffect(() => {
    if (editId) return
    const subscription = watch((current) => {
      if (savedOnce.current) return
      if (!Object.values(current).some(Boolean)) {
        removeCapturePreference(ownerId, UNFINISHED)
        setStorageFailed(false)
      } else setStorageFailed(!writeCapturePreference(ownerId, UNFINISHED, current))
    })
    return () => subscription.unsubscribe()
  }, [watch, editId, ownerId])
  const discard = () => {
    removeCapturePreference(ownerId, UNFINISHED)
    reset(empty)
    setRestored(null)
    setShowDetails(false)
    setApplied(null)
    setErrorCause(null)
    requestAnimationFrame(() => setFocus('origin'))
  }
  // Route shortcuts from the latest flight dated today or earlier; nothing is applied until the member picks one.
  const [last, setLast] = useState<{
    flight: Flight
    returnLogged: boolean
  } | null>(null)
  const [applied, setApplied] = useState<'return' | 'onward' | null>(null)
  const routeControl = useRef<RouteControl>(null)
  useEffect(() => {
    if (editId) return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    void getRecentFlights(ownerId, 20, { signal: controller.signal })
      .then((rows) => {
        if (!current(generation, controller)) return
        const today = localDay(0)
        const latest = rows.find((row) => row.date <= today)
        setLast(
          latest
            ? {
                flight: latest,
                returnLogged: rows.some(
                  (row) =>
                    row.date >= latest.date &&
                    row.origin === latest.destination &&
                    row.destination === latest.origin,
                ),
              }
            : null,
        )
      })
      .catch(() => {
        /* Shortcuts are optional; the route card still works. */
      })
    return () => {
      controller.abort()
      release()
    }
  }, [editId, ownerId])
  const receipt = !editId && !busy && pendingFlightCreateOperation(ownerId, operationId)
  const current = (generation: number, controller: AbortController) =>
    !controller.signal.aborted && generation === getAuthGeneration()
  useEffect(() => {
    if (!editId) return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    void getFlight(editId, { signal: controller.signal })
      .then((row) => {
        if (!current(generation, controller)) return
        setFlight(row)
        if (row) {
          reset({
            date: row.date,
            origin: row.origin,
            destination: row.destination,
            airline: row.airline_iata ?? '',
            aircraft: row.aircraft_icao ?? '',
            number: row.flight_number ?? '',
            departure: row.departure_time?.slice(0, 5) ?? '',
            arrival: row.arrival_time?.slice(0, 5) ?? '',
          })
          setShowDetails(
            readCapturePreference(ownerId, 'details', false) ||
              !!(
                row.airline_iata ||
                row.aircraft_icao ||
                row.flight_number ||
                row.departure_time ||
                row.arrival_time
              ) ||
              !!focusField,
          )
        }
      })
      .catch((cause) => {
        if (current(generation, controller)) setErrorCause({ cause, kind: 'load' })
      })
      .finally(() => {
        if (current(generation, controller)) setLoading(false)
      })
    return () => {
      controller.abort()
      release()
    }
  }, [editId, reset, ownerId, focusField])
  useEffect(() => {
    setDuplicate(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || origin?.length !== 3 || destination?.length !== 3)
      return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    const timer = setTimeout(
      () =>
        void checkDuplicateFlight(ownerId, date, origin, destination, editId, {
          signal: controller.signal,
        })
          .then((row) => {
            if (current(generation, controller)) setDuplicate(row)
          })
          .catch(() => {
            if (current(generation, controller)) setDuplicate(null)
          }),
      300,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
      release()
    }
  }, [ownerId, date, origin, destination, editId])
  async function save(values: Values, original?: object, bypassDuplicate = false) {
    if (!online || saving.current || (receipt && !original)) return
    saving.current = true
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    setBusy(true)
    setErrorCause(null)
    try {
      try {
        validateFlightInput(original ?? input(values), 'create')
      } catch {
        throw new ApiError(400, 'Invalid flight', 'INVALID_FLIGHT')
      }
      if (!original && !bypassDuplicate) {
        const existing = await checkDuplicateFlight(
          ownerId,
          values.date,
          values.origin,
          values.destination,
          editId,
          { signal: controller.signal },
        )
        if (!current(generation, controller)) return
        setDuplicate(existing)
        if (existing) {
          setFocusBlockedSave(true)
          return
        }
      }
      const from = findAirport(values.origin),
        to = findAirport(values.destination),
        plane = values.aircraft ? findAircraft(values.aircraft) : undefined
      const distance =
        from && to
          ? calculateFlightDistance(from.latitude, from.longitude, to.latitude, to.longitude)
          : null
      const duration =
        values.departure && values.arrival
          ? calculateFlightDuration(
              values.departure,
              values.arrival,
              values.date,
              from?.timezone,
              to?.timezone,
            )
          : distance == null
            ? null
            : estimateFlightDuration(distance, plane?.type)
      const body = original ?? {
        date: values.date,
        origin: values.origin,
        destination: values.destination,
        airline_iata: values.airline || null,
        aircraft_icao: values.aircraft || null,
        flight_number: values.number || null,
        departure_time: values.departure || null,
        arrival_time: values.arrival || null,
        distance_km: distance,
        duration_minutes: duration,
        origin_tz: from?.timezone || null,
        dest_tz: to?.timezone || null,
      }
      const ack = flight
        ? await updateFlight(flight.id, body)
        : await createFlight(
            { ...body, source: 'manual', user_id: ownerId } as Parameters<typeof createFlight>[0],
            operationId,
            original ? (receipt ? receipt.key : '') : undefined,
          )
      if (!current(generation, controller)) return
      if (!flight) setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`))
      const nextRecents = [...new Set([values.origin, values.destination, ...recents.airports])]
        .filter(Boolean)
        .slice(0, 8)
      setRecents((previous) => ({ ...previous, airports: nextRecents }))
      writeCapturePreference(ownerId, 'airports', nextRecents)
      if (!flight) {
        // Confirmed: the unfinished entry is done. An uncertain save never reaches here, so its input stays.
        savedOnce.current = true
        removeCapturePreference(ownerId, UNFINISHED)
        if (onCreated) {
          const route = (original ?? values) as Pick<Values, 'date' | 'origin' | 'destination'>
          onCreated(ack, {
            date: route.date,
            origin: route.origin,
            destination: route.destination,
          })
          return
        }
      }
      feedback.acknowledge(ack)
      setSavedFlight(ack)
      setSaved(true)
      router.refresh()
    } catch (cause) {
      if (current(generation, controller)) {
        setFocusBlockedSave(true)
        setErrorCause({ cause, kind: 'save' })
      }
    } finally {
      saving.current = false
      if (current(generation, controller)) setBusy(false)
      release()
    }
  }
  async function remove() {
    if (!online || !flight || saving.current) return false
    if (onDelete) {
      onDelete(flight.id)
      onOpenJournal?.()
      return true
    }
    saving.current = true
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    setBusy(true)
    setDeleteCause(null)
    try {
      const ack = await deleteFlight(flight.id)
      if (current(generation, controller)) {
        feedback.acknowledge(ack)
        if (onOpenJournal) onOpenJournal()
        else router.push('/journal')
        router.refresh()
      }
      return true
    } catch (cause) {
      if (current(generation, controller)) {
        setDeleteCause(cause)
        throw cause
      }
    } finally {
      saving.current = false
      if (current(generation, controller)) setBusy(false)
      release()
    }
  }
  const validationMessages = validateFlightValues(values, locale)
  const fieldError = (name: keyof Values) =>
    formState.errors[name] ? validationMessages[name] : undefined
  const invalid = (issues: typeof formState.errors) => {
    // Focus the first invalid field in the order it appears on screen.
    const field =
      (
        [
          'origin',
          'destination',
          'date',
          'airline',
          'aircraft',
          'number',
          'departure',
          'arrival',
        ] as const
      ).find((name) => name in issues) ?? (Object.keys(issues)[0] as keyof Values)
    if (['airline', 'aircraft', 'number', 'departure', 'arrival'].includes(field))
      setShowDetails(true)
    requestAnimationFrame(() => setFocus(field))
  }
  const submit = (bypass = false) =>
    handleSubmit((values) => void save(values, undefined, bypass), invalid)
  const [keyboardText, setKeyboardText] = useState(false)
  const keyboardSave = useRef<() => void>(() => {})
  keyboardSave.current = () => {
    if (!loading && !saved && editing && !confirmDelete) {
      setKeyboardText(true)
      void submit()()
    }
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        keyboardSave.current()
      }
    }
    const resetPreferences = () => {
      setRecents({ airports: [], airline: [], aircraft: [] })
      setShowDetails(false)
    }
    window.addEventListener('keydown', listener)
    window.addEventListener('kuuki:identity-reset', resetPreferences)
    return () => {
      window.removeEventListener('keydown', listener)
      window.removeEventListener('kuuki:identity-reset', resetPreferences)
    }
  }, [])
  const pendingFocus = useRef<'aircraft' | null>(focusField ?? null)
  useEffect(() => {
    if (!pendingFocus.current || loading || !flight || !editing) return
    if (!showDetails) {
      setShowDetails(true)
      return
    }
    const field = pendingFocus.current
    pendingFocus.current = null
    setFocus(field)
  }, [loading, flight, editing, showDetails, setFocus])
  if (loading) return wrap(<p role="status">{ru ? 'Загружаем перелёт…' : 'Loading flight…'}</p>)
  if (editId && !flight)
    return wrap(
      <p role="alert">
        {error || flightErrorMessage(new ApiError(404, 'Not found', 'NOT_FOUND'), locale, 'load')}
      </p>,
    )
  if (saved)
    return wrap(
      <section>
        <h2 ref={savedHeading} tabIndex={-1}>
          {ru ? 'Перелёт сохранён' : 'Flight saved'}
        </h2>
        <p role="status">
          {feedback.status === 'ready'
            ? ru
              ? 'Итоги обновлены.'
              : 'Totals updated.'
            : feedback.status === 'pending'
              ? ru
                ? 'Итоги обновляются. Перелёт уже в журнале.'
                : 'Totals are updating. Your flight is in the journal.'
              : ru
                ? 'Итоги ещё не подтвердили обновление. Перелёт уже в журнале.'
                : 'Totals have not confirmed publication yet. Your flight is in the journal.'}
        </p>
        <a
          className="button primary"
          href="/journal"
          onClick={
            onOpenJournal
              ? (event) => {
                  event.preventDefault()
                  onOpenJournal()
                }
              : undefined
          }
        >
          {onOpenJournal ? (ru ? 'Готово' : 'Done') : ru ? 'Открыть журнал' : 'Open journal'}
        </a>
      </section>,
    )
  const deleteButton = flight && (
    <div className="flight-danger">
      <DestructiveConfirm
        open={confirmDelete}
        onOpenChange={(next) => {
          if (next) setDeleteCause(null)
          setConfirmDelete(next)
        }}
        trigger={
          <Button variant="danger" disabled={busy} disabledReason={deleteReason}>
            {ru ? 'Удалить перелёт' : 'Delete flight'}
          </Button>
        }
        title={
          ru
            ? `Удалить перелёт ${flight.origin} → ${flight.destination}, ${formatDateOnly(locale, flight.date)}?`
            : `Delete ${flight.origin} → ${flight.destination}, ${formatDateOnly(locale, flight.date)}?`
        }
        consequence={
          ru
            ? 'Этот перелёт будет удалён из журнала.'
            : 'This flight will be removed from your journal.'
        }
        confirmLabel={ru ? 'Удалить перелёт' : 'Delete flight'}
        cancelLabel={ru ? 'Отмена' : 'Cancel'}
        closeLabel={ru ? 'Закрыть' : 'Close'}
        errorMessage={deleteError}
        confirmDisabledReason={deleteReason}
        onConfirm={async () => {
          if (await remove()) setConfirmDelete(false)
        }}
      />
    </div>
  )
  if (flight && !editing) {
    const state =
      (
        flight as Flight & {
          lifecycle_state?: 'upcoming' | 'awaiting' | 'logged'
        }
      ).lifecycle_state ?? (flight.is_upcoming ? 'upcoming' : 'logged')
    const time = (value: string | null) => (value ? value.slice(0, 5) : null)
    return wrap(
      <section className="flight-detail">
        <Ticket
          locale={locale}
          state={state}
          origin={{
            iata: flight.origin,
            city: choices.find((row) => row.code === flight.origin)?.detail ?? flight.origin,
          }}
          destination={{
            iata: flight.destination,
            city:
              choices.find((row) => row.code === flight.destination)?.detail ?? flight.destination,
          }}
          date={flight.date}
          airline={flight.airline_iata ?? undefined}
          flightNumber={flight.flight_number ?? undefined}
          distanceKm={flight.distance_km ?? undefined}
          actions={
            <Button onClick={() => setEditing(true)}>
              {ru ? 'Изменить перелёт' : 'Edit flight'}
            </Button>
          }
        />
        <dl>
          {[
            ['Авиакомпания', 'Airline', flight.airline_iata],
            ['Самолёт', 'Aircraft', flight.aircraft_icao],
            ['Номер рейса', 'Flight number', flight.flight_number],
            ['Вылет', 'Departure', time(flight.departure_time)],
            ['Прилёт', 'Arrival', time(flight.arrival_time)],
            [
              'Длительность',
              'Duration',
              flight.duration_minutes == null
                ? null
                : formatDuration(locale, flight.duration_minutes),
            ],
          ].map(([russian, english, value]) => (
            <div key={english}>
              <dt>{ru ? russian : english}</dt>
              <dd>{value || (ru ? 'Не указано' : 'Not specified')}</dd>
            </div>
          ))}
        </dl>
        {deleteButton}
        {error && <p role="alert">{error}</p>}
      </section>,
    )
  }
  const combo = (name: 'airline' | 'aircraft', label: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Combobox
          label={label}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          inputRef={field.ref}
          choices={name === 'airline' ? airlineChoices : aircraftChoices}
          locale={locale}
          error={fieldError(name)}
          disabled={busy}
          recents={recents[name]}
          onSelect={(code) => remember(name, code)}
        />
      )}
    />
  )
  const describe = (name: keyof Values, extra?: string) =>
    [fieldError(name) ? `${formId}-${name}-error` : '', extra ?? ''].filter(Boolean).join(' ') ||
    undefined
  const fieldErrorLine = (name: keyof Values) =>
    fieldError(name) && (
      <p id={`${formId}-${name}-error`} role="alert">
        {fieldError(name)}
      </p>
    )
  const flightNumber = (
    <div className="flight-field">
      <label htmlFor={`${formId}-number`}>{ru ? 'Номер рейса' : 'Flight number'}</label>
      <input
        className="ui-field-input"
        id={`${formId}-number`}
        {...register('number')}
        aria-invalid={!!fieldError('number')}
        aria-describedby={describe('number')}
      />
      {fieldErrorLine('number')}
    </div>
  )
  const revalidate = {
    shouldDirty: true,
    shouldValidate: formState.isSubmitted,
  }
  // Times as one leg: Departs → Arrives, a "+1" on a next-day arrival, and the duration under the row.
  const leg = legSummary(
    /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDay(0),
    values.departure,
    values.arrival,
    origin?.length === 3 ? findAirport(origin)?.timezone : undefined,
    destination?.length === 3 ? findAirport(destination)?.timezone : undefined,
  )
  const nextDay = !!leg?.nextDay
  const timeField = (name: 'departure' | 'arrival', label: string) => (
    <div className="flight-field">
      <label htmlFor={`${formId}-${name}`}>{label}</label>
      <div className="flight-time-input">
        <input
          className="ui-field-input"
          id={`${formId}-${name}`}
          type="time"
          {...register(name)}
          aria-invalid={!!fieldError(name)}
          aria-describedby={describe(
            name,
            name === 'arrival' && nextDay ? `${formId}-next-day` : undefined,
          )}
        />
        {name === 'arrival' && nextDay && (
          <span className="flight-next-day" id={`${formId}-next-day`}>
            <span aria-hidden="true">+1</span>
            <span className="sr-only">{ru ? 'на следующий день' : 'next day'}</span>
          </span>
        )}
      </div>
      {fieldErrorLine(name)}
    </div>
  )
  const filled = [
    values.airline &&
      (airlineChoices.find((row) => row.code === values.airline)?.label ?? values.airline),
    values.number,
    values.aircraft &&
      (aircraftChoices.find((row) => row.code === values.aircraft)?.label ?? values.aircraft),
    [values.departure, values.arrival].filter(Boolean).join('–'),
  ].filter(Boolean)
  const detailsSummary = filled.length
    ? filled.join(' · ')
    : ru
      ? 'Авиакомпания, номер рейса, самолёт, время'
      : 'Airline, flight number, aircraft, times'
  const city = (code: string) => {
    const choice = choices.find((row) => row.code === code)
    return choice?.detail ?? choice?.label ?? code
  }
  const lastFlight = last?.flight
  const lastDay = lastFlight && dayParts(locale, lastFlight.date)
  const shortcuts = !editId && lastFlight && (
    <div className="route-shortcuts">
      <div className="route-shortcut-row">
        {!last.returnLogged && (
          <Button
            className="route-shortcut"
            aria-pressed={
              applied === 'return' &&
              origin === lastFlight.destination &&
              destination === lastFlight.origin
            }
            aria-label={`${ru ? 'Обратный рейс' : 'Return flight'}: ${city(lastFlight.destination)}, ${lastFlight.destination} → ${city(lastFlight.origin)}, ${lastFlight.origin}`}
            icon={<Undo size={16} strokeWidth={2} aria-hidden="true" />}
            disabled={busy}
            onClick={() => {
              setValue('origin', lastFlight.destination, revalidate)
              setValue('destination', lastFlight.origin, revalidate)
              setApplied('return')
            }}
          >
            {ru ? 'Обратно' : 'Return'}{' '}
            <span className="route-shortcut-codes">
              {lastFlight.destination}→{lastFlight.origin}
            </span>
          </Button>
        )}
        <Button
          className="route-shortcut"
          aria-pressed={applied === 'onward' && origin === lastFlight.destination}
          aria-label={
            ru
              ? `Следующий рейс из ${lastFlight.destination}: ${city(lastFlight.destination)}`
              : `Onward flight: from ${city(lastFlight.destination)}, ${lastFlight.destination}`
          }
          icon={<ArrowRight size={16} strokeWidth={2} aria-hidden="true" />}
          disabled={busy}
          onClick={() => {
            setValue('origin', lastFlight.destination, revalidate)
            if (destination === lastFlight.destination) setValue('destination', '', revalidate)
            setApplied('onward')
            if (!destination || destination === lastFlight.destination)
              routeControl.current?.open('destination')
          }}
        >
          {ru ? 'Из' : 'From'}{' '}
          <span className="route-shortcut-codes">{lastFlight.destination}</span>
        </Button>
      </div>
      <p className="route-shortcut-caption">
        {ru ? 'С прошлого рейса' : 'From your last flight'}, {lastDay?.day} {lastDay?.month}
      </p>
    </div>
  )
  const notice = (tone: 'warning' | 'danger', title: ReactNode, detail?: ReactNode) => {
    const Icon = tone === 'danger' ? CircleAlert : TriangleAlert
    return (
      <div className="flight-notice" data-tone={tone}>
        <Icon className="flight-notice-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="flight-notice-title">{title}</p>
          {detail ? <p className="flight-notice-detail">{detail}</p> : null}
        </div>
      </div>
    )
  }
  const cancel = onCancel ? (
    <Button onClick={onCancel}>{ru ? 'Отмена' : 'Cancel'}</Button>
  ) : (
    <a className="button secondary" href="/journal">
      {ru ? 'Отмена' : 'Cancel'}
    </a>
  )
  const saveButton = (
    <Button
      variant="primary"
      type="submit"
      form={formId}
      morphText
      instantText={keyboardText}
      onPointerDown={() => setKeyboardText(false)}
      loading={busy}
      loadingLabel={ru ? 'Сохраняем…' : 'Saving…'}
      disabled={!!receipt}
      disabledReason={saveReason}
    >
      {ru ? 'Сохранить перелёт' : 'Save flight'}
    </Button>
  )
  // Save notices sit in the footer directly above the actions they lead to; nothing comes between them.
  const footer = receipt ? (
    <div className="flight-footer-block" role="alert">
      {notice(
        'warning',
        receipt.expired
          ? ru
            ? 'Срок безопасного повтора истёк. Проверьте журнал.'
            : 'Safe retry expired. Check the journal before a new save.'
          : ru
            ? 'Предыдущее сохранение не подтверждено. Повторите исходные данные.'
            : 'The last save is unconfirmed. Retry the original flight.',
      )}
      <div className="flight-footer-actions">
        {!receipt.expired && (
          <Button
            variant="primary"
            disabled={busy}
            disabledReason={saveReason}
            onClick={() => void save(empty, receipt.body)}
          >
            {ru ? 'Повторить исходное сохранение' : 'Retry original save'}
          </Button>
        )}
        <Button
          disabled={busy}
          disabledReason={saveReason}
          onClick={() => {
            abandonFlightCreateOperation(ownerId, operationId)
            setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`))
            setErrorCause(null)
          }}
        >
          {ru
            ? 'Журнал проверен — начать новое сохранение'
            : 'I checked the journal — start a new save'}
        </Button>
      </div>
    </div>
  ) : duplicate ? (
    <div ref={duplicateRef} tabIndex={-1} role="status" className="flight-footer-block">
      {notice(
        'warning',
        ru
          ? 'Перелёт с этой датой и маршрутом уже есть.'
          : 'A flight with this date and route already exists.',
        `${duplicate.origin} → ${duplicate.destination} · ${formatDateOnly(locale, duplicate.date)}`,
      )}
      <div className="flight-footer-actions">
        <a className="button secondary" href={`/journal/${duplicate.id}/edit`}>
          {ru ? 'Открыть существующий' : 'Open existing'}
        </a>
        <Button disabled={busy} disabledReason={saveReason} onClick={() => void submit(true)()}>
          {ru ? 'Всё равно сохранить' : 'Save anyway'}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flight-footer-block">
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="flight-footer-error">
          {notice('danger', error)}
        </div>
      )}
      <div className="flight-footer-actions">
        {cancel}
        {saveButton}
      </div>
      <small className="flight-keyboard-hint">⌘/Ctrl + Enter</small>
    </div>
  )
  return wrap(
    <form
      id={formId}
      className="capture-card flight-editor"
      noValidate
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter') setKeyboardText(true)
      }}
      onPointerDownCapture={() => setKeyboardText(false)}
      onSubmit={submit()}
    >
      {restored && Object.values(values).some(Boolean) && (
        <div className="flight-restored">
          <p>{ru ? 'Незаконченная запись восстановлена' : 'Unfinished entry restored'}</p>
          <Button variant="ghost" dense disabled={busy} onClick={discard}>
            {ru ? 'Сбросить' : 'Discard'}
          </Button>
        </div>
      )}
      {storageFailed && (
        <p className="flight-storage-note" role="status">
          {ru
            ? 'Запись сохранится, только пока открыта эта страница.'
            : 'This entry is kept only while this page is open.'}
        </p>
      )}
      <fieldset disabled={busy}>
        <div className="flight-route">
          <RouteCard
            controlRef={routeControl}
            origin={from.value}
            destination={to.value}
            onPick={(end, code) => {
              ;(end === 'origin' ? from : to).onChange(code)
              remember('airports', code)
              if (end === 'origin' || applied === 'return') setApplied(null)
            }}
            onSwap={() => {
              setValue('origin', destination, revalidate)
              setValue('destination', origin, revalidate)
              setApplied(null)
            }}
            choices={choices}
            recents={recents.airports}
            locale={locale}
            errors={{
              origin: fieldError('origin'),
              destination: fieldError('destination'),
            }}
            disabled={busy}
            endRefs={{ origin: from.ref, destination: to.ref }}
          />
          {shortcuts}
        </div>
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DateTiles
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              locale={locale}
              error={fieldError('date')}
              disabled={busy}
            />
          )}
        />
        <Disclosure
          layout="row"
          summary={ru ? 'Подробности' : 'Optional details'}
          description={detailsSummary}
          open={showDetails}
          onOpenChange={(open) => {
            setShowDetails(open)
            if (editId) writeCapturePreference(ownerId, 'details', open)
          }}
        >
          <div className="flight-details">
            <div className="capture-grid">
              {combo('airline', ru ? 'Авиакомпания' : 'Airline')}
              {flightNumber}
              {combo('aircraft', ru ? 'Самолёт' : 'Aircraft')}
            </div>
            <fieldset className="flight-times">
              <legend>{ru ? 'Местное время' : 'Local times'}</legend>
              <div className="flight-times-row">
                {timeField('departure', ru ? 'Вылет' : 'Departs')}
                <span className="flight-times-arrow" aria-hidden="true">
                  →
                </span>
                {timeField('arrival', ru ? 'Прилёт' : 'Arrives')}
              </div>
              {leg && (
                <p className="flight-times-duration">
                  {ru
                    ? `В полёте ${formatDuration(locale, leg.minutes)}`
                    : `${formatDuration(locale, leg.minutes)} flight`}
                </p>
              )}
            </fieldset>
          </div>
        </Disclosure>
      </fieldset>
      {deleteButton}
    </form>,
    surface ? footer : <footer className="capture-footer">{footer}</footer>,
  )
}
