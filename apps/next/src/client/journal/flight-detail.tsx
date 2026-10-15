'use client'
// The detail sheet's content: one flight read as a journey (cities, local times, the time between them), a compact block of
// supporting facts and one quiet history fact. Edit (in the sheet header) switches the same panel to labeled fields that save
// together.
// Presentational: the container (detail-sheet.tsx) owns writes, Undo, the lazily loaded editor catalogue and the layout.
import { CircleAlert, MapPin, TriangleAlert } from '@keyline-icons/react'
import { makerOf } from '@kuuki/data/aircraft-makers'
import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import {
  connectionChains,
  type ConnectionLabel,
} from '../../../../../functions/api/_services/connections'
import { formatDateOnly, formatDistanceKm, formatDuration, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { MakerSwatch } from '../ui/category-mark'
import { Combobox, type Choice } from '../ui/combobox'
import { Field } from '../ui/field'
import { arrivalOrdinal } from './arrivals'
import type { Changes, Drafts, EditableField, EditOutcome, FieldErrors } from './flight-edits'
import { flightCode, type JournalFlight, type JournalPayload } from './model'
import './flight-detail.css'

/** The lazily loaded write module (flight-edits.ts). Only its types are imported here, so the catalogues stay out of the page bundle. */
export type FlightEditor = typeof import('./flight-edits')

/**
 * Asked by the container before Escape or a close request ends the sheet. True: the content handled it (left Edit, or is asking
 * whether to discard changes and will call `proceed` on Discard).
 */
export type CloseGuard = (kind: 'escape' | 'close', proceed: () => void) => boolean

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' })
const ordinalSuffix: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
}

const copy = {
  en: {
    departs: 'Departs',
    arrives: 'Arrives',
    from: 'From',
    to: 'To',
    flightTime: (duration: string, estimated: boolean) => (estimated ? `≈ ${duration}` : duration),
    flightTimeLabel: (duration: string, estimated: boolean) =>
      `${estimated ? 'About ' : ''}${duration} in the air`,
    nextDay: 'next day',
    arrival: (ordinal: number, city: string) =>
      `${ordinal}${ordinalSuffix[ordinalRules.select(ordinal)] ?? 'th'} recorded arrival in ${city}`,
    facts: 'Flight facts',
    flight: 'Flight',
    aircraft: 'Aircraft',
    distance: 'Distance',
    edit: 'Edit',
    editName: 'Edit flight',
    awaiting: 'Waiting for your confirmation',
    upcoming: 'Upcoming flight',
    connection: 'Connection',
    previousLeg: 'Previous leg',
    nextLeg: 'Next leg',
    transfer: (duration: string, airport: string, estimated: boolean) =>
      `${estimated ? '≈ ' : ''}${duration} transfer in ${airport}`,
    transferUnknown: (airport: string) => `Connection in ${airport}`,
    open: (route: string, date: string) => `Open ${route}, ${date}`,
    form: 'Edit flight',
    field: {
      origin: 'From',
      destination: 'To',
      date: 'Date',
      departure_time: 'Departure time',
      arrival_time: 'Arrival time',
      airline_iata: 'Airline',
      flight_number: 'Flight number',
      aircraft_icao: 'Aircraft',
    } satisfies Record<EditableField, string>,
    localTime: 'Local time, HH:MM',
    save: 'Save changes',
    saving: 'Saving…',
    cancel: 'Cancel',
    loading: 'Loading the editor…',
    loadFailed: 'Could not load the editor.',
    retry: 'Try again',
    invalid: 'Check the highlighted fields.',
    discard: 'Discard your changes to this flight?',
    discardYes: 'Discard',
    discardNo: 'Keep editing',
    unknown:
      'Could not confirm the change: it may or may not be saved. The list is refreshing. Check it, then save again if needed.',
  },
  ru: {
    departs: 'Вылет',
    arrives: 'Прилёт',
    from: 'Откуда',
    to: 'Куда',
    flightTime: (duration: string, estimated: boolean) => (estimated ? `≈ ${duration}` : duration),
    flightTimeLabel: (duration: string, estimated: boolean) =>
      `В воздухе ${estimated ? 'около ' : ''}${duration}`,
    nextDay: 'на следующий день',
    arrival: (ordinal: number, city: string) => `${city}: ${ordinal}-й прилёт в журнале`,
    facts: 'Сведения о рейсе',
    flight: 'Рейс',
    aircraft: 'Самолёт',
    distance: 'Расстояние',
    edit: 'Изменить',
    editName: 'Изменить перелёт',
    awaiting: 'Ждёт вашего подтверждения',
    upcoming: 'Предстоящий перелёт',
    connection: 'Пересадка',
    previousLeg: 'Предыдущий рейс',
    nextLeg: 'Следующий рейс',
    transfer: (duration: string, airport: string, estimated: boolean) =>
      `Пересадка в ${airport}: ${estimated ? '≈ ' : ''}${duration}`,
    transferUnknown: (airport: string) => `Пересадка в ${airport}`,
    open: (route: string, date: string) => `Открыть ${route}, ${date}`,
    form: 'Изменить перелёт',
    field: {
      origin: 'Откуда',
      destination: 'Куда',
      date: 'Дата',
      departure_time: 'Время вылета',
      arrival_time: 'Время прилёта',
      airline_iata: 'Авиакомпания',
      flight_number: 'Номер рейса',
      aircraft_icao: 'Самолёт',
    } satisfies Record<EditableField, string>,
    localTime: 'Местное время, ЧЧ:ММ',
    save: 'Сохранить',
    saving: 'Сохраняем…',
    cancel: 'Отменить',
    loading: 'Загружаем редактор…',
    loadFailed: 'Не удалось загрузить редактор.',
    retry: 'Повторить',
    invalid: 'Проверьте отмеченные поля.',
    discard: 'Отменить изменения этого перелёта?',
    discardYes: 'Отменить изменения',
    discardNo: 'Продолжить',
    unknown:
      'Не удалось подтвердить изменение: оно могло сохраниться, а могло и нет. Список обновляется. Проверьте его и при необходимости сохраните снова.',
  },
} as const

type Copy = (typeof copy)[Locale]

// ---- Read-first formatting ----

const regionNames = new Map<Locale, Intl.DisplayNames>()
function countryName(locale: Locale, code: string | null): string | null {
  if (!code) return null
  let names = regionNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: 'region' })
    regionNames.set(locale, names)
  }
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

/** "UTC+4", "UTC+5:30", "UTC" for the zone at that instant, or null when the zone is unknown. */
export function utcOffset(timeZone: string | null, at: Date): string | null {
  if (!timeZone || Number.isNaN(at.getTime())) return null
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value
    return name ? name.replace(/^GMT/, 'UTC') : null
  } catch {
    return null
  }
}

/** The calendar day of an instant in a zone, YYYY-MM-DD. */
function localDay(timeZone: string, at: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at)
    const get = (type: string) => parts.find((part) => part.type === type)?.value
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return null
  }
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

const instantOf = (value: string | null, fallbackDay: string) =>
  new Date(value ?? `${fallbackDay}T12:00:00Z`)
const clock = (value: string) => value.slice(0, 5)
const positive = (value: number | null) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

type Leg = {
  flight: JournalFlight
  minutes: number | null
  label: ConnectionLabel
  airport: string
}
const linkIndexes = new WeakMap<
  JournalPayload,
  {
    next: Map<number, { toId: number; label: ConnectionLabel }>
    previous: Map<number, { fromId: number; label: ConnectionLabel }>
  }
>()

/** The previous and next leg of the flight's connection chain, over the whole journal. */
function connectionOf(
  payload: JournalPayload,
  flight: JournalFlight,
): { previous: Leg | null; next: Leg | null } {
  let index = linkIndexes.get(payload)
  if (!index) {
    index = { next: new Map(), previous: new Map() }
    for (const [id, decision] of connectionChains(payload.flights)) {
      if (decision.kind !== 'link') continue
      index.next.set(id, { toId: decision.toId, label: decision.label })
      index.previous.set(decision.toId, { fromId: id, label: decision.label })
    }
    linkIndexes.set(payload, index)
  }
  const byId = (id: number) => payload.flights.find((item) => item.id === id)
  const gap = (inbound: JournalFlight, outbound: JournalFlight) => {
    const arrival = inbound.arrival_utc ? Date.parse(inbound.arrival_utc) : Number.NaN,
      departure = outbound.departure_utc ? Date.parse(outbound.departure_utc) : Number.NaN
    return Number.isNaN(arrival) || Number.isNaN(departure)
      ? null
      : Math.max(0, Math.round((departure - arrival) / 60_000))
  }
  const before = index.previous.get(flight.id),
    after = index.next.get(flight.id)
  const previousFlight = before ? byId(before.fromId) : undefined,
    nextFlight = after ? byId(after.toId) : undefined
  return {
    previous:
      before && previousFlight
        ? {
            flight: previousFlight,
            minutes: gap(previousFlight, flight),
            label: before.label,
            airport: flight.origin,
          }
        : null,
    next:
      after && nextFlight
        ? {
            flight: nextFlight,
            minutes: gap(flight, nextFlight),
            label: after.label,
            airport: flight.destination,
          }
        : null,
  }
}

// ---- Reading ----

type ReadingProps = {
  flight: JournalFlight
  payload: JournalPayload
  locale: Locale
  t: Copy
  onOpenFlight: (id: number) => void
}

function JourneyReading({ flight, payload, locale, t, onOpenFlight }: ReadingProps) {
  const refs = payload.refs
  const endpoint = (code: string, country: string | null) => {
    const ref = refs.airports[code]
    return {
      city: ref?.city ?? ref?.name ?? code,
      country: countryName(locale, country ?? ref?.country ?? null),
    }
  }
  const origin = endpoint(flight.origin, flight.origin_country),
    destination = endpoint(flight.destination, flight.destination_country)
  const time = (value: string | null, zone: string | null, utc: string | null) => {
    if (!value) return null
    const at = instantOf(utc, flight.date)
    return {
      clock: clock(value),
      offset: utcOffset(zone, at),
      day: zone && utc ? localDay(zone, at) : null,
    }
  }
  const departure = time(flight.departure_time, flight.origin_tz, flight.departure_utc)
  const arrival = time(flight.arrival_time, flight.dest_tz, flight.arrival_utc)
  // The arrival's local day, when it is not the flight's date (overnight, or a date-line crossing).
  const arrivalDay =
    arrival?.day && arrival.day !== flight.date
      ? arrival.day === nextDay(flight.date)
        ? t.nextDay
        : formatDateOnly(locale, arrival.day, 'medium')
      : null
  const estimated = flight.duration_source === 'estimate'
  const duration = positive(flight.duration_minutes)
    ? formatDuration(locale, flight.duration_minutes!)
    : null
  const history = arrivalOrdinal(payload, flight)

  const airlineName = flight.airline_iata
    ? (refs.airlines[flight.airline_iata]?.name ?? null)
    : null
  const code = flightCode(flight)
  const aircraftName = flight.aircraft_icao
    ? (refs.aircraft[flight.aircraft_icao]?.name ?? null)
    : null
  const distance = positive(flight.distance_km)
    ? formatDistanceKm(locale, Math.round(flight.distance_km!))
    : null
  const connection = useMemo(() => connectionOf(payload, flight), [payload, flight])

  const stop = (
    end: 'departure' | 'arrival',
    place: { city: string; country: string | null },
    airport: string,
    at: ReturnType<typeof time>,
    day: string | null,
  ) => (
    <>
      {at && (
        <p className="jd-when" data-end={end}>
          <span className="sr-only">{end === 'departure' ? t.departs : t.arrives} </span>
          <span className="jd-clock">{at.clock}</span>
          {at.offset && <span className="jd-offset">{at.offset}</span>}
          {day && <span className="jd-day">{day}</span>}
        </p>
      )}
      <span className="jd-dot" data-end={end} aria-hidden="true" />
      <p className="jd-where" data-end={end}>
        <span className="sr-only">{end === 'departure' ? t.from : t.to} </span>
        <span className="jd-city">{place.city}</span>
        <span className="jd-airport">
          <span className="jd-code">{airport}</span>
          {place.country && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              {place.country}
            </>
          )}
        </span>
      </p>
    </>
  )

  const legButton = (leg: Leg, label: string) => {
    const route = `${leg.flight.origin} → ${leg.flight.destination}`
    const legDate = formatDateOnly(locale, leg.flight.date, 'medium')
    return (
      <div className="jd-leg">
        <span className="jd-leg-label">{label}</span>
        <button
          type="button"
          className="jd-leg-open"
          aria-label={t.open(route, legDate)}
          onClick={() => onOpenFlight(leg.flight.id)}
        >
          <span className="jd-code">
            {leg.flight.origin}
            <span aria-hidden="true"> → </span>
            {leg.flight.destination}
          </span>
          <span className="jd-meta">{legDate}</span>
        </button>
        <span className="jd-meta">
          {leg.minutes === null
            ? t.transferUnknown(leg.airport)
            : t.transfer(
                formatDuration(locale, leg.minutes),
                leg.airport,
                leg.label === 'estimated',
              )}
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="jd-journey" data-times={departure || arrival ? undefined : 'none'}>
        {stop('departure', origin, flight.origin, departure, null)}
        <span className="jd-line" aria-hidden="true" />
        <p className="jd-span">
          {duration && (
            <>
              <span aria-hidden="true">{t.flightTime(duration, estimated)}</span>
              <span className="sr-only">{t.flightTimeLabel(duration, estimated)}</span>
            </>
          )}
        </p>
        {stop('arrival', destination, flight.destination, arrival, arrivalDay)}
      </div>
      {/* The header carries the date; the flight number lives here, beside its airline. Absent facts are omitted. */}
      {(airlineName || code || flight.airline_iata || distance || flight.aircraft_icao) && (
        <dl className="jd-facts" aria-label={t.facts}>
          {(airlineName || code || flight.airline_iata) && (
            <div className="jd-fact">
              <dt>{t.flight}</dt>
              <dd className="jd-stack">
                {airlineName && <span>{airlineName}</span>}
                {(code ?? (airlineName ? null : flight.airline_iata)) && (
                  <span className="jd-code">{code ?? flight.airline_iata}</span>
                )}
              </dd>
            </div>
          )}
          {distance && (
            <div className="jd-fact">
              <dt>{t.distance}</dt>
              <dd>{distance}</dd>
            </div>
          )}
          {flight.aircraft_icao && (
            <div className="jd-fact" data-wide="">
              <dt>{t.aircraft}</dt>
              <dd className="jd-aircraft">
                <MakerSwatch maker={makerOf(flight.aircraft_icao)} size={10} />
                <span className="jd-stack">
                  <span>{aircraftName ?? flight.aircraft_icao}</span>
                  {aircraftName && <span className="jd-code jd-quiet">{flight.aircraft_icao}</span>}
                </span>
              </dd>
            </div>
          )}
        </dl>
      )}
      {history && (
        <p className="jd-history">
          <MapPin size={16} strokeWidth={2} aria-hidden="true" />
          {t.arrival(history.ordinal, history.city)}
        </p>
      )}
      {(connection.previous || connection.next) && (
        <section className="jd-section" aria-labelledby={`jd-connection-${flight.id}`}>
          <h3 id={`jd-connection-${flight.id}`} className="jd-heading">
            {t.connection}
          </h3>
          {connection.previous && legButton(connection.previous, t.previousLeg)}
          {connection.next && legButton(connection.next, t.nextLeg)}
        </section>
      )}
    </>
  )
}

// ---- Editing ----

/** Which control edits the field: a typeable date, a catalogue picker, or plain text (times and the flight number). */
type InputKind =
  | { kind: 'date' }
  | { kind: 'choices'; choices: Choice[] }
  | { kind: 'text'; time: boolean }

function FieldInput({
  input,
  locale,
  hint,
  label,
  value,
  onChange,
  inputRef,
  error,
  disabled,
}: {
  input: InputKind
  locale: Locale
  hint: string
  label: string
  value: string
  onChange: (value: string) => void
  inputRef: (node: HTMLInputElement | null) => void
  error?: string
  disabled: boolean
}) {
  if (input.kind === 'date')
    return (
      <Calendar
        label={label}
        value={value}
        onChange={onChange}
        inputRef={inputRef}
        locale={locale}
        error={error}
        disabled={disabled}
      />
    )
  if (input.kind === 'choices')
    return (
      <Combobox
        label={label}
        value={value}
        onChange={onChange}
        inputRef={inputRef}
        choices={input.choices}
        locale={locale}
        error={error}
        disabled={disabled}
      />
    )
  return (
    <Field
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      ref={inputRef}
      error={error}
      disabled={disabled}
      autoComplete="off"
      hint={input.time ? hint : undefined}
      inputMode={input.time ? 'numeric' : undefined}
      placeholder={input.time ? '14:30' : undefined}
      maxLength={input.time ? 8 : 20}
    />
  )
}

/** A focused picker or calendar owns Escape first: it closes its list, the form stays. */
const pickerOwnsEscape = () =>
  !!(document.activeElement as Element | null)?.closest(
    '[aria-expanded="true"], .flight-calendar-popover, .flight-search-sheet',
  )

type EditFormProps = {
  flight: JournalFlight
  locale: Locale
  t: Copy
  editor: FlightEditor
  initialField: EditableField | null
  onSave: (flight: JournalFlight, changes: Changes) => Promise<EditOutcome>
  onDone: () => void
  guardRef: RefObject<CloseGuard | null>
}

const ORDER: readonly EditableField[] = [
  'origin',
  'destination',
  'date',
  'departure_time',
  'arrival_time',
  'airline_iata',
  'flight_number',
  'aircraft_icao',
]

function FlightEditForm({
  flight,
  locale,
  t,
  editor,
  initialField,
  onSave,
  onDone,
  guardRef,
}: EditFormProps) {
  // Changes are measured against the flight as it was when Edit started, so a refresh that lands meanwhile is never reverted.
  const [base] = useState(flight)
  const [drafts, setDrafts] = useState<Drafts>(() => editor.draftsOf(flight))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [problem, setProblem] = useState<{
    kind: 'rejected' | 'unknown'
    message: string
    messageCopy?: Record<Locale, string>
  } | null>(null)
  const problemText = problem?.messageCopy?.[locale] ?? problem?.message
  const [saving, setSaving] = useState(false)
  const [discarding, setDiscarding] = useState<{ proceed: (() => void) | null } | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const inputs = useRef(new Map<EditableField, HTMLInputElement>())
  const keepEditing = useRef<HTMLButtonElement | null>(null)
  const problemId = useId()

  const airports = useMemo(() => editor.airportChoices(locale), [editor, locale])
  const inputFor = (field: EditableField): InputKind =>
    field === 'date'
      ? { kind: 'date' }
      : field === 'origin' || field === 'destination'
        ? { kind: 'choices', choices: airports }
        : field === 'airline_iata'
          ? { kind: 'choices', choices: editor.airlineChoices }
          : field === 'aircraft_icao'
            ? { kind: 'choices', choices: editor.aircraftChoices }
            : { kind: 'text', time: field === 'departure_time' || field === 'arrival_time' }

  const localizedErrors = editor.validateDrafts(base, drafts, locale)
  const changes = editor.changesOf(base, drafts)
  const dirty = Object.keys(changes).length > 0
  const preview = problem ? [] : editor.previewChanges(base, changes, locale)

  const [focusField] = useState(initialField)
  useEffect(() => {
    mounted.current = true
    // Opened on a field (the ledger's "Add aircraft"); otherwise the heading keeps focus, so no picker list opens unasked.
    if (focusField) inputs.current.get(focusField)?.focus()
    return () => {
      mounted.current = false
    }
  }, [focusField])
  useEffect(() => {
    if (discarding) keepEditing.current?.focus()
  }, [discarding])
  // An unknown outcome reconciled by the refetch: the flight now holds every sent value, so the edit is done.
  useEffect(() => {
    if (problem?.kind !== 'unknown' || saving) return
    const sent = Object.entries(changes) as [EditableField, string | null][]
    if (sent.length && sent.every(([field, value]) => (flight[field] ?? null) === value)) onDone()
  }, [problem, saving, changes, flight, onDone])

  const guard = useCallback<CloseGuard>(
    (kind, proceed) => {
      if (inFlight.current) return true
      if (kind === 'escape' && pickerOwnsEscape()) return true
      if (discarding) {
        // A second Escape answers the question with "Keep editing".
        if (kind === 'escape') setDiscarding(null)
        return true
      }
      if (dirty) {
        setDiscarding({ proceed: kind === 'close' ? proceed : null })
        return true
      }
      if (kind === 'escape') {
        onDone()
        return true
      }
      return false
    },
    [discarding, dirty, onDone],
  )
  useEffect(() => {
    guardRef.current = guard
    return () => {
      if (guardRef.current === guard) guardRef.current = null
    }
  }, [guard, guardRef])

  const change = (field: EditableField, value: string) => {
    setDrafts((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setProblem(null)
    setDiscarding(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    if (!dirty) {
      onDone()
      return
    } // nothing changed on purpose: no request
    const found = editor.validateDrafts(base, drafts, locale)
    const first = ORDER.find((field) => found[field])
    if (first) {
      setErrors(found)
      setProblem(null)
      inputs.current.get(first)?.focus()
      return
    }
    inFlight.current = true
    setSaving(true)
    setProblem(null)
    setDiscarding(null)
    let outcome: EditOutcome
    try {
      outcome = await onSave(flight, changes)
    } catch {
      outcome = {
        status: 'unknown',
        message: t.unknown,
        messageCopy: { en: copy.en.unknown, ru: copy.ru.unknown },
      }
    }
    inFlight.current = false
    if (!mounted.current) return
    setSaving(false)
    if (outcome.status === 'saved') onDone()
    else
      setProblem({
        kind: outcome.status,
        message: outcome.message,
        messageCopy: outcome.messageCopy,
      })
  }

  const cancel = () => {
    if (!inFlight.current) onDone()
  }
  const keys = (event: KeyboardEvent<HTMLFormElement>) => {
    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === 229
    )
      return
    event.preventDefault()
    event.stopPropagation()
    guard('escape', () => {})
  }

  const field = (name: EditableField) => (
    <div className="jd-input" data-field={name}>
      <FieldInput
        input={inputFor(name)}
        locale={locale}
        hint={t.localTime}
        label={t.field[name]}
        value={drafts[name]}
        onChange={(value) => change(name, value)}
        inputRef={(node) => {
          if (node) inputs.current.set(name, node)
          else inputs.current.delete(name)
        }}
        error={errors[name] ? localizedErrors[name] : undefined}
        disabled={saving}
      />
    </div>
  )

  const invalid = ORDER.some((name) => errors[name])
  return (
    <form
      className="jd-form"
      aria-label={t.form}
      aria-describedby={problem ? problemId : undefined}
      aria-busy={saving || undefined}
      noValidate
      onSubmit={(event) => void submit(event)}
      onKeyDown={keys}
    >
      <div className="jd-form-group">
        {field('origin')}
        {field('destination')}
      </div>
      <div className="jd-form-group">
        {field('date')}
        <div className="jd-form-pair">
          {field('departure_time')}
          {field('arrival_time')}
        </div>
      </div>
      <div className="jd-form-group">
        {field('airline_iata')}
        {field('flight_number')}
        {field('aircraft_icao')}
      </div>
      {preview.length > 0 && (
        <div className="jd-preview" aria-live="polite">
          {preview.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {invalid && (
        <p className="jd-form-note" role="alert">
          {t.invalid}
        </p>
      )}
      {problem && (
        <p
          id={problemId}
          role="alert"
          className={problem.kind === 'unknown' ? 'arc-inline-unknown' : 'jd-form-error'}
        >
          {problem.kind === 'unknown' ? (
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
          ) : (
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          )}
          <span>{problemText}</span>
        </p>
      )}
      {discarding ? (
        <div className="jd-discard" role="alertdialog" aria-label={t.discard}>
          <p>{t.discard}</p>
          <div className="jd-form-actions">
            <Button
              variant="secondary"
              onClick={() => {
                const proceed = discarding.proceed
                onDone()
                proceed?.()
              }}
            >
              {t.discardYes}
            </Button>
            <Button ref={keepEditing} variant="ghost" onClick={() => setDiscarding(null)}>
              {t.discardNo}
            </Button>
          </div>
        </div>
      ) : (
        <div className="jd-form-actions">
          <Button type="submit" variant="primary" loading={saving} loadingLabel={t.saving}>
            {t.save}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={cancel}>
            {t.cancel}
          </Button>
        </div>
      )}
    </form>
  )
}

// ---- Content ----

export type FlightDetailProps = {
  flight: JournalFlight
  payload: JournalPayload
  locale: Locale
  /** False: Edit is unavailable and points at `offlineNoteId`. */
  online: boolean
  offlineNoteId: string
  /** The loaded write module, or null while it loads. */
  editor: FlightEditor | null
  editorState: 'idle' | 'loading' | 'ready' | 'failed'
  loadEditor: () => void
  onSave: (flight: JournalFlight, changes: Changes) => Promise<EditOutcome>
  /** A save or Undo of this flight is in flight: Edit cannot start. */
  busy: boolean
  /** Open in Edit with this field focused (the ledger's "Add aircraft"). */
  initialField?: EditableField | null
  /** Swap the sheet to another flight (a connection leg). */
  onOpenFlight: (id: number) => void
  /** Filled while editing; the container asks it before Escape or a close request. */
  guardRef: RefObject<CloseGuard | null>
  /** The sheet header's action slot: Edit sits beside Close there. Without it, Edit stays at the top of the content. */
  actionSlot?: HTMLElement | null
}

export function FlightDetail({
  flight,
  payload,
  locale,
  online,
  offlineNoteId,
  editor,
  editorState,
  loadEditor,
  onSave,
  busy,
  initialField,
  onOpenFlight,
  guardRef,
  actionSlot,
}: FlightDetailProps) {
  const t = copy[locale]
  const [editing, setEditing] = useState(() => !!initialField && online)
  const editButton = useRef<HTMLButtonElement | null>(null)
  const editHeading = useRef<HTMLHeadingElement | null>(null)
  const returnFocus = useRef(false)
  // Edit started from the button: the heading takes focus and names the mode.
  const focusHeading = useRef(false)
  useEffect(() => {
    if (editing && !editor && editorState !== 'loading' && editorState !== 'failed') loadEditor()
  }, [editing, editor, editorState, loadEditor])
  useEffect(() => {
    if (editing && focusHeading.current) {
      focusHeading.current = false
      editHeading.current?.focus()
    } else if (!editing && returnFocus.current) {
      returnFocus.current = false
      editButton.current?.focus()
    }
  }, [editing])

  const done = useCallback(() => {
    // Focus returns to Edit only when it was inside Edit; a close or swap moves it elsewhere.
    const active = document.activeElement
    returnFocus.current = !active || active === document.body || !!active.closest('.jd-content')
    setEditing(false)
  }, [])
  const unavailable = !online || busy
  const start = () => {
    focusHeading.current = true
    setEditing(true)
  }

  const status =
    flight.lifecycle_state === 'awaiting'
      ? t.awaiting
      : flight.lifecycle_state === 'upcoming'
        ? t.upcoming
        : null

  if (editing)
    return (
      <div className="jd-content" data-mode="edit">
        <h3 ref={editHeading} tabIndex={-1} className="jd-heading">
          {t.form}
        </h3>
        {editor ? (
          <FlightEditForm
            flight={flight}
            locale={locale}
            t={t}
            editor={editor}
            initialField={initialField ?? null}
            onSave={onSave}
            onDone={done}
            guardRef={guardRef}
          />
        ) : editorState === 'failed' ? (
          <div className="jd-form-actions">
            <p role="alert" className="jd-form-note">
              {t.loadFailed}
            </p>
            <Button dense variant="secondary" onClick={loadEditor}>
              {t.retry}
            </Button>
            <Button dense variant="ghost" onClick={done}>
              {t.cancel}
            </Button>
          </div>
        ) : (
          <p role="status" className="jd-form-note">
            {t.loading}
          </p>
        )}
      </div>
    )

  const edit = (
    <Button
      ref={editButton}
      dense
      variant="ghost"
      className="jd-edit"
      data-action="edit-flight"
      aria-label={t.editName}
      disabled={unavailable}
      aria-describedby={!online ? offlineNoteId : undefined}
      onClick={start}
    >
      {t.edit}
    </Button>
  )
  return (
    <div className="jd-content" data-mode="read">
      {actionSlot && createPortal(edit, actionSlot)}
      {(status || !actionSlot) && (
        <div className="jd-bar">
          {status && (
            <p className="jd-status" data-state={flight.lifecycle_state}>
              {status}
            </p>
          )}
          {!actionSlot && edit}
        </div>
      )}
      <JourneyReading
        flight={flight}
        payload={payload}
        locale={locale}
        t={t}
        onOpenFlight={onOpenFlight}
      />
    </div>
  )
}
