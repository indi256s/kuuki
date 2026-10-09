'use client'
// The detail sheet's content: one flight, read first, with each editable value an inline field (spec "Detail sheet").
// Presentational: the container (detail-sheet.tsx) owns writes, Undo, the lazily loaded editor catalogue and the layout.
import { makerOf } from '@kuuki/data/aircraft-makers'
import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { connectionChains, type ConnectionLabel } from '../../../../../functions/api/_services/connections'
import { formatDateOnly, formatDistanceKm, formatDuration, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { MakerSwatch } from '../ui/category-mark'
import { Combobox, type Choice } from '../ui/combobox'
import { Field } from '../ui/field'
import type { InlineEditOutcome } from '../ui/inline-edit'
import { firstsLabels } from './firsts-glyph'
import type { EditableField } from './flight-edits'
import type { JournalFlight, JournalPayload } from './model'
import './flight-detail.css'

/** The lazily loaded write module (flight-edits.ts). Only its types are imported here, so the catalogues stay out of the page bundle. */
export type FlightEditor = typeof import('./flight-edits')

const copy = {
  en: {
    from: 'From', to: 'To', date: 'Date', departure: 'Departure', arrival: 'Arrival', airline: 'Airline', flightNumber: 'Flight number', aircraft: 'Aircraft',
    distance: 'Distance', duration: 'Duration', notRecorded: 'Not recorded', localTime: 'Local time, HH:MM',
    add: { departure_time: 'Add time', arrival_time: 'Add time', airline_iata: 'Add airline', flight_number: 'Add flight number', aircraft_icao: 'Add aircraft' } as Partial<Record<EditableField, string>>,
    change: (label: string, value: string) => `Change ${label.toLowerCase()}, now ${value}`,
    save: 'Save', cancel: 'Cancel editing', saving: 'Saving…', loading: 'Loading the editor…', loadFailed: 'Could not load the editor.', retry: 'Try again',
    hint: 'Enter or leaving the field saves, Escape cancels.',
    unknown: 'Could not confirm the change: it may or may not be saved. The list is refreshing. Check it, then save again if needed.',
    nextDay: 'next day',
    connection: 'Connection', previousLeg: 'Previous leg', nextLeg: 'Next leg',
    transfer: (duration: string, airport: string, estimated: boolean) => `${estimated ? '≈ ' : ''}${duration} transfer in ${airport}`,
    transferUnknown: (airport: string) => `Connection in ${airport}`,
    open: (route: string, date: string) => `Open ${route}, ${date}`,
    firsts: 'Firsts',
    record: 'In your journal',
    imported: (date: string) => `Imported on ${date}`, added: (date: string) => `Added by you on ${date}`,
    importedNoDate: 'Imported', addedNoDate: 'Added by you',
    confirmation: { save: 'Saved as a flight you already took', user: 'Confirmed by you', automatic: 'Confirmed automatically seven days after the flight', legacy: 'Carried over from your earlier journal' },
    awaiting: 'Waiting for your confirmation', upcoming: 'Upcoming flight',
  },
  ru: {
    from: 'Откуда', to: 'Куда', date: 'Дата', departure: 'Вылет', arrival: 'Прилёт', airline: 'Авиакомпания', flightNumber: 'Номер рейса', aircraft: 'Самолёт',
    distance: 'Расстояние', duration: 'В пути', notRecorded: 'Нет данных', localTime: 'Местное время, ЧЧ:ММ',
    add: { departure_time: 'Добавить время', arrival_time: 'Добавить время', airline_iata: 'Добавить авиакомпанию', flight_number: 'Добавить номер рейса', aircraft_icao: 'Добавить самолёт' } as Partial<Record<EditableField, string>>,
    change: (label: string, value: string) => `Изменить: ${label.toLowerCase()}, сейчас ${value}`,
    save: 'Сохранить', cancel: 'Отменить редактирование', saving: 'Сохраняем…', loading: 'Загружаем редактор…', loadFailed: 'Не удалось загрузить редактор.', retry: 'Повторить',
    hint: 'Enter или выход из поля сохраняет, Escape отменяет.',
    unknown: 'Не удалось подтвердить изменение: оно могло сохраниться, а могло и нет. Список обновляется. Проверьте его и при необходимости сохраните снова.',
    nextDay: 'на следующий день',
    connection: 'Пересадка', previousLeg: 'Предыдущий рейс', nextLeg: 'Следующий рейс',
    transfer: (duration: string, airport: string, estimated: boolean) => `Пересадка в ${airport}: ${estimated ? '≈ ' : ''}${duration}`,
    transferUnknown: (airport: string) => `Пересадка в ${airport}`,
    open: (route: string, date: string) => `Открыть ${route}, ${date}`,
    firsts: 'Впервые',
    record: 'В журнале',
    imported: (date: string) => `Импортирован ${date}`, added: (date: string) => `Добавлен вами ${date}`,
    importedNoDate: 'Импортирован', addedNoDate: 'Добавлен вами',
    confirmation: { save: 'Сохранён как уже совершённый перелёт', user: 'Подтверждён вами', automatic: 'Подтверждён автоматически через семь дней после перелёта', legacy: 'Перенесён из прежнего журнала' },
    awaiting: 'Ждёт вашего подтверждения', upcoming: 'Предстоящий перелёт',
  },
} as const

type Copy = (typeof copy)[Locale]

// ---- Read-first formatting ----

const regionNames = new Map<Locale, Intl.DisplayNames>()
function countryName(locale: Locale, code: string | null): string | null {
  if (!code) return null
  let names = regionNames.get(locale)
  if (!names) { names = new Intl.DisplayNames([locale], { type: 'region' }); regionNames.set(locale, names) }
  try { return names.of(code) ?? code } catch { return code }
}

/** "UTC+4", "UTC+5:30", "UTC" for the zone at that instant, or null when the zone is unknown. */
export function utcOffset(timeZone: string | null, at: Date): string | null {
  if (!timeZone || Number.isNaN(at.getTime())) return null
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(at).find(part => part.type === 'timeZoneName')?.value
    return name ? name.replace(/^GMT/, 'UTC') : null
  } catch { return null }
}

/** The calendar day of an instant in a zone, YYYY-MM-DD. */
function localDay(timeZone: string, at: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
    const get = (type: string) => parts.find(part => part.type === type)?.value
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch { return null }
}

const instantOf = (value: string | null, fallbackDay: string) => new Date(value ?? `${fallbackDay}T12:00:00Z`)
const clock = (value: string) => value.slice(0, 5)
const positive = (value: number | null) => typeof value === 'number' && Number.isFinite(value) && value > 0

type Leg = { flight: JournalFlight; minutes: number | null; label: ConnectionLabel; airport: string }
const linkIndexes = new WeakMap<JournalPayload, { next: Map<number, { toId: number; label: ConnectionLabel }>; previous: Map<number, { fromId: number; label: ConnectionLabel }> }>()

/** The previous and next leg of the flight's connection chain, over the whole journal. */
function connectionOf(payload: JournalPayload, flight: JournalFlight): { previous: Leg | null; next: Leg | null } {
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
  const byId = (id: number) => payload.flights.find(item => item.id === id)
  const gap = (inbound: JournalFlight, outbound: JournalFlight) => {
    const arrival = inbound.arrival_utc ? Date.parse(inbound.arrival_utc) : Number.NaN, departure = outbound.departure_utc ? Date.parse(outbound.departure_utc) : Number.NaN
    return Number.isNaN(arrival) || Number.isNaN(departure) ? null : Math.max(0, Math.round((departure - arrival) / 60_000))
  }
  const before = index.previous.get(flight.id), after = index.next.get(flight.id)
  const previousFlight = before ? byId(before.fromId) : undefined, nextFlight = after ? byId(after.toId) : undefined
  return {
    previous: before && previousFlight ? { flight: previousFlight, minutes: gap(previousFlight, flight), label: before.label, airport: flight.origin } : null,
    next: after && nextFlight ? { flight: nextFlight, minutes: gap(flight, nextFlight), label: after.label, airport: flight.destination } : null,
  }
}

// ---- Inline field ----

/** Which control edits the field: a typeable date, a catalogue picker, or plain text (times and the flight number). */
type InputKind = { kind: 'date' } | { kind: 'choices'; choices: Choice[] } | { kind: 'text'; time: boolean }
type InputProps = { input: InputKind; locale: Locale; hint: string; label: string; value: string; onChange: (value: string) => void; inputRef: (node: HTMLInputElement | null) => void; error?: string; disabled: boolean }

function FieldInput({ input, locale, hint, label, value, onChange, inputRef, error, disabled }: InputProps) {
  if (input.kind === 'date') return <Calendar label={label} value={value} onChange={onChange} inputRef={inputRef} locale={locale} error={error} disabled={disabled} />
  if (input.kind === 'choices') return <Combobox label={label} value={value} onChange={onChange} inputRef={inputRef} choices={input.choices} locale={locale} error={error} disabled={disabled} />
  return <Field label={label} value={value} onChange={event => onChange(event.target.value)} ref={inputRef} error={error} disabled={disabled} autoComplete="off"
    hint={input.time ? hint : undefined} inputMode={input.time ? 'numeric' : undefined} placeholder={input.time ? '14:30' : undefined} maxLength={input.time ? 8 : 20} />
}

type DetailFieldProps = {
  field: EditableField
  label: string
  /** The saved value as edit text. */
  value: string
  display: ReactNode
  /** Text for the trigger's accessible name. */
  valueText: string
  /** No value yet: the trigger reads as an Add action. */
  empty: boolean
  t: Copy
  editing: boolean
  onEditingChange: (field: EditableField, editing: boolean) => void
  /** Null while the editor module loads; `failed` offers a retry. */
  input: InputKind | null
  locale: Locale
  editorState: 'loading' | 'ready' | 'failed'
  onRetryEditor: () => void
  onSave: (field: EditableField, draft: string) => Promise<InlineEditOutcome>
  preview: (field: EditableField, draft: string) => string | null
  /** Blocks starting (offline, or another save of this flight in flight). */
  disabled: boolean
  disabledReasonId?: string
  /** The value just settled: show the check. */
  confirmed: boolean
}

const FOCUSABLE = 'input,button,select,textarea,a[href],[tabindex]'

function DetailField({ field, label, value, display, valueText, empty, t, editing, onEditingChange, input: inputKind, locale, editorState, onRetryEditor, onSave, preview, disabled, disabledReasonId, confirmed }: DetailFieldProps) {
  const [draft, setDraft] = useState(value)
  const draftRef = useRef(value)
  const [problem, setProblem] = useState<{ kind: 'rejected' | 'unknown'; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  // Enter saves straight away until the draft is touched, so opening a picker and pressing Enter never takes its highlighted suggestion.
  const touched = useRef(false)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const group = useRef<HTMLDivElement | null>(null)
  const input = useRef<HTMLInputElement | null>(null)
  // Mounted already editing (the sheet opened on this field): the field takes focus as soon as it attaches.
  const wanted = useRef<'field' | 'trigger' | null>(editing ? 'field' : null)
  const hintId = useId(), previewId = useId()

  const inputRef = useCallback((node: HTMLInputElement | null) => { input.current = node; if (node && wanted.current === 'field') { wanted.current = null; node.focus() } }, [])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (wanted.current === 'field' && editing && input.current) { wanted.current = null; input.current.focus() }
    else if (wanted.current === 'trigger' && !editing && trigger.current) { wanted.current = null; trigger.current.focus() }
  })

  const focusInside = () => { const active = document.activeElement; return !active || active === document.body || !!group.current?.contains(active) }
  const close = (focus: boolean) => { wanted.current = focus ? 'trigger' : null; setProblem(null); onEditingChange(field, false) }
  // An unknown outcome reconciled by the refetch: the saved value now is the draft, so the edit is done.
  useEffect(() => {
    if (editing && !saving && problem?.kind === 'unknown' && draft.trim() === value) { wanted.current = focusInside() ? 'trigger' : null; onEditingChange(field, false) }
  }, [editing, saving, problem, draft, value, field, onEditingChange])

  const start = () => {
    if (disabled || inFlight.current) return
    touched.current = false
    draftRef.current = value
    setDraft(value); setProblem(null)
    wanted.current = 'field'
    onEditingChange(field, true)
  }
  const change = (next: string) => { touched.current = true; draftRef.current = next; setDraft(next); setProblem(null) }
  const submit = async () => {
    if (inFlight.current || !editing) return
    const next = draftRef.current.trim()
    if (next === value) { close(focusInside()); return } // nothing changed on purpose: no request
    inFlight.current = true
    setSaving(true); setProblem(null)
    let outcome: InlineEditOutcome
    try { outcome = await onSave(field, next) } catch { outcome = { status: 'unknown', message: t.unknown } }
    inFlight.current = false
    if (!mounted.current) return
    setSaving(false)
    const here = focusInside()
    if (outcome.status === 'saved') { wanted.current = here ? 'trigger' : null; onEditingChange(field, false) }
    else { wanted.current = here ? 'field' : null; touched.current = false; setProblem({ kind: outcome.status, message: outcome.message }) }
  }
  const cancel = () => { if (!inFlight.current) close(true) }

  const captureKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') touched.current = true
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && !(event.target as HTMLElement).closest('button')) {
      if (inFlight.current) { event.preventDefault(); return }
      if (!touched.current) { event.preventDefault(); event.stopPropagation(); void submit() }
    }
    if (event.key === 'Escape' && inFlight.current) { event.preventDefault(); event.stopPropagation() }
  }
  const bubbleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return
    // A picker consumes Enter and Escape while its list is open; whatever reaches here is the deliberate press.
    if (event.key === 'Enter' && !(event.target as HTMLElement).closest('button')) { event.preventDefault(); void submit() }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() }
  }
  // Leaving the field saves (spec: Enter or blur). Focus moving within the editor, into the phone search sheet, or out of the window does not.
  const blur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Element | null
    if (next && (group.current?.contains(next) || next.closest('.flight-search-sheet'))) return
    if (!document.hasFocus()) return
    void submit()
  }
  // A press on the editor's own text keeps focus in the field instead of blurring it.
  const keepFocus = (event: MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest(FOCUSABLE)) event.preventDefault() }

  const forecast = editing && !problem ? preview(field, draft) : null
  return <div className="jd-row" data-field={field} data-editing={editing || undefined}>
    <dt className="jd-label">{label}</dt>
    <dd className="jd-value">
      {editing
        ? <div ref={group} className="jd-editor" role="group" aria-label={label} aria-describedby={[hintId, forecast ? previewId : null].filter(Boolean).join(' ')} data-saving={saving || undefined}
          onKeyDownCapture={captureKeys} onKeyDown={bubbleKeys} onBlur={blur} onMouseDown={keepFocus}>
          {inputKind
            ? <FieldInput input={inputKind} locale={locale} hint={t.localTime} label={label} value={draft} onChange={change} inputRef={inputRef} error={problem?.kind === 'rejected' ? problem.message : undefined} disabled={saving} />
            : editorState === 'failed'
              ? <p role="alert" className="jd-editor-note">{t.loadFailed} <Button dense variant="secondary" onClick={onRetryEditor}>{t.retry}</Button></p>
              : <p role="status" className="jd-editor-note">{t.loading}</p>}
          {forecast && <p id={previewId} className="jd-preview" aria-live="polite">{forecast}</p>}
          <div className="jd-editor-actions">
            <button type="button" className="arc-inline-icon" data-role="save" aria-label={`${t.save}: ${label}`} aria-disabled={saving || !inputKind || undefined} onClick={() => { if (inputKind) void submit() }}><Check size={16} strokeWidth={2} aria-hidden="true" /></button>
            <button type="button" className="arc-inline-icon" data-role="cancel" aria-label={t.cancel} aria-disabled={saving || undefined} onClick={cancel}><X size={16} strokeWidth={2} aria-hidden="true" /></button>
            {saving && <span role="status" className="jd-editor-status">{t.saving}</span>}
          </div>
          {problem?.kind === 'unknown' && <p role="alert" className="arc-inline-unknown">{problem.message}</p>}
          <span id={hintId} className="sr-only">{t.hint}</span>
        </div>
        : <span className="jd-settled">
          <button ref={trigger} type="button" className="arc-inline-trigger jd-trigger" data-empty={empty || undefined} aria-label={t.change(label, valueText)}
            aria-disabled={disabled || undefined} aria-describedby={disabled ? disabledReasonId : undefined} onClick={disabled ? event => event.preventDefault() : start}>{display}</button>
          {confirmed && <Check className="jd-check" data-testid="field-saved" size={16} strokeWidth={2} aria-hidden="true" />}
        </span>}
    </dd>
  </div>
}

// ---- Content ----

export type FlightDetailProps = {
  flight: JournalFlight
  payload: JournalPayload
  locale: Locale
  /** False: every field is read-only and its trigger points at `offlineNoteId`. */
  online: boolean
  offlineNoteId: string
  /** The loaded write module, or null while it loads. */
  editor: FlightEditor | null
  editorState: 'idle' | 'loading' | 'ready' | 'failed'
  loadEditor: () => void
  onSave: (flight: JournalFlight, field: EditableField, draft: string) => Promise<InlineEditOutcome>
  /** A save of this flight is in flight: other fields cannot start. */
  busy: boolean
  /** The field whose value just settled. */
  confirmedField: EditableField | null
  /** Start editing this field when the content mounts (the ledger's "Add aircraft"). */
  initialField?: EditableField | null
  /** Swap the sheet to another flight (a connection leg). */
  onOpenFlight: (id: number) => void
}

export function FlightDetail({ flight, payload, locale, online, offlineNoteId, editor, editorState, loadEditor, onSave, busy, confirmedField, initialField, onOpenFlight }: FlightDetailProps) {
  const t = copy[locale]
  const refs = payload.refs
  const [editing, setEditing] = useState<EditableField | null>(() => initialField && online ? initialField : null)
  useEffect(() => { if (editing && !editor && editorState !== 'loading' && editorState !== 'failed') loadEditor() }, [editing, editor, editorState, loadEditor])
  const setFieldEditing = useCallback((field: EditableField, on: boolean) => {
    setEditing(current => on ? field : current === field ? null : current)
  }, [])

  const airports = useMemo(() => editor?.airportChoices(locale) ?? null, [editor, locale])
  const choicesFor = (field: EditableField): Choice[] | null => field === 'origin' || field === 'destination' ? airports
    : field === 'airline_iata' ? editor?.airlineChoices ?? null : field === 'aircraft_icao' ? editor?.aircraftChoices ?? null : null
  const inputFor = (field: EditableField): InputKind | null => {
    if (!editor) return null
    if (field === 'date') return { kind: 'date' }
    const choices = choicesFor(field)
    return choices ? { kind: 'choices', choices } : { kind: 'text', time: field === 'departure_time' || field === 'arrival_time' }
  }
  const save = useCallback((field: EditableField, draft: string) => onSave(flight, field, draft), [onSave, flight])
  const preview = useCallback((field: EditableField, draft: string) => editor?.previewConsequence(flight, field, draft, locale) ?? null, [editor, flight, locale])

  const fieldProps = (field: EditableField) => ({
    field, t, locale, editing: editing === field, onEditingChange: setFieldEditing, input: inputFor(field),
    editorState: editorState === 'failed' ? 'failed' as const : editor ? 'ready' as const : 'loading' as const, onRetryEditor: loadEditor,
    onSave: save, preview, disabled: !online || (busy && editing !== field), disabledReasonId: !online ? offlineNoteId : undefined, confirmed: confirmedField === field,
  })

  // Values
  const airport = (code: string, country: string | null) => {
    const ref = refs.airports[code]
    const place = [ref?.city ?? ref?.name ?? null, countryName(locale, country ?? ref?.country ?? null)].filter(Boolean).join(', ')
    return { display: <><span className="jd-code">{code}</span>{place && <span className="jd-place">{place}</span>}</>, text: place ? `${code}, ${place}` : code }
  }
  const origin = airport(flight.origin, flight.origin_country), destination = airport(flight.destination, flight.destination_country)
  const date = formatDateOnly(locale, flight.date, 'long')
  const time = (value: string | null, zone: string | null, utc: string | null, arriving: boolean) => {
    if (!value) return null
    const at = instantOf(utc, flight.date)
    const offset = utcOffset(zone, at)
    const day = arriving && zone && utc ? localDay(zone, at) : null
    const otherDay = day && day !== flight.date ? (day === nextDay(flight.date) ? t.nextDay : formatDateOnly(locale, day, 'medium')) : null
    const text = [clock(value), offset, otherDay].filter(Boolean).join(' ')
    return { display: <><span className="jd-mono">{clock(value)}</span>{offset && <span className="jd-meta">{offset}</span>}{otherDay && <span className="jd-meta">{otherDay}</span>}</>, text }
  }
  const departure = time(flight.departure_time, flight.origin_tz, flight.departure_utc, false)
  const arrival = time(flight.arrival_time, flight.dest_tz, flight.arrival_utc, true)
  const airlineName = flight.airline_iata ? refs.airlines[flight.airline_iata]?.name ?? null : null
  const aircraftName = flight.aircraft_icao ? refs.aircraft[flight.aircraft_icao]?.name ?? null : null
  const empty = (field: EditableField) => <span className="jd-add">{t.add[field]}</span>

  const distance = positive(flight.distance_km) ? formatDistanceKm(locale, Math.round(flight.distance_km!)) : null
  const duration = positive(flight.duration_minutes) ? `${flight.duration_source === 'estimate' ? '≈ ' : ''}${formatDuration(locale, flight.duration_minutes!)}` : null
  const connection = useMemo(() => connectionOf(payload, flight), [payload, flight])
  const firsts = payload.firsts[flight.id]
  const firstLines = firsts ? firstsLabels(firsts, refs, locale, flight) : []
  const added = /^\d{4}-\d{2}-\d{2}/.test(flight.created_at ?? '') ? formatDateOnly(locale, flight.created_at.slice(0, 10), 'long') : null
  const origination = flight.source === 'ai_import' ? (added ? t.imported(added) : t.importedNoDate) : (added ? t.added(added) : t.addedNoDate)
  const standing = flight.lifecycle_state === 'awaiting' ? t.awaiting : flight.lifecycle_state === 'upcoming' ? t.upcoming
    : flight.confirmation_source ? t.confirmation[flight.confirmation_source] : null

  const legButton = (leg: Leg, label: string) => {
    const route = `${leg.flight.origin} → ${leg.flight.destination}`
    const legDate = formatDateOnly(locale, leg.flight.date, 'medium')
    return <div className="jd-leg">
      <span className="jd-leg-label">{label}</span>
      <button type="button" className="jd-leg-open" aria-label={t.open(route, legDate)} onClick={() => onOpenFlight(leg.flight.id)}>
        <span className="jd-code">{leg.flight.origin}<span aria-hidden="true"> → </span>{leg.flight.destination}</span>
        <span className="jd-meta">{legDate}</span>
      </button>
      <span className="jd-meta">{leg.minutes === null ? t.transferUnknown(leg.airport) : t.transfer(formatDuration(locale, leg.minutes), leg.airport, leg.label === 'estimated')}</span>
    </div>
  }

  return <div className="jd-content">
    <dl className="jd-list">
      <DetailField {...fieldProps('origin')} label={t.from} value={flight.origin} display={origin.display} valueText={origin.text} empty={false} />
      <DetailField {...fieldProps('destination')} label={t.to} value={flight.destination} display={destination.display} valueText={destination.text} empty={false} />
      <DetailField {...fieldProps('date')} label={t.date} value={flight.date} display={date} valueText={date} empty={false} />
      <DetailField {...fieldProps('departure_time')} label={t.departure} value={flight.departure_time ?? ''} display={departure?.display ?? empty('departure_time')} valueText={departure?.text ?? t.notRecorded} empty={!departure} />
      <DetailField {...fieldProps('arrival_time')} label={t.arrival} value={flight.arrival_time ?? ''} display={arrival?.display ?? empty('arrival_time')} valueText={arrival?.text ?? t.notRecorded} empty={!arrival} />
    </dl>
    <dl className="jd-list">
      <DetailField {...fieldProps('airline_iata')} label={t.airline} value={flight.airline_iata ?? ''} empty={!flight.airline_iata}
        display={flight.airline_iata ? <>{airlineName && <span>{airlineName}</span>}<span className="jd-code">{flight.airline_iata}</span></> : empty('airline_iata')}
        valueText={flight.airline_iata ? [airlineName, flight.airline_iata].filter(Boolean).join(', ') : t.notRecorded} />
      <DetailField {...fieldProps('flight_number')} label={t.flightNumber} value={flight.flight_number ?? ''} empty={!flight.flight_number}
        display={flight.flight_number ? <span className="jd-mono">{flight.flight_number}</span> : empty('flight_number')} valueText={flight.flight_number ?? t.notRecorded} />
      <DetailField {...fieldProps('aircraft_icao')} label={t.aircraft} value={flight.aircraft_icao ?? ''} empty={!flight.aircraft_icao}
        display={flight.aircraft_icao ? <><MakerSwatch maker={makerOf(flight.aircraft_icao)} size={10} />{aircraftName && <span>{aircraftName}</span>}<span className="jd-code">{flight.aircraft_icao}</span></> : empty('aircraft_icao')}
        valueText={flight.aircraft_icao ? [aircraftName, flight.aircraft_icao].filter(Boolean).join(', ') : t.notRecorded} />
    </dl>
    <dl className="jd-list">
      <div className="jd-row"><dt className="jd-label">{t.distance}</dt><dd className="jd-value jd-static">{distance ?? t.notRecorded}</dd></div>
      <div className="jd-row"><dt className="jd-label">{t.duration}</dt><dd className="jd-value jd-static">{duration ?? t.notRecorded}</dd></div>
    </dl>
    {(connection.previous || connection.next) && <section className="jd-section" aria-labelledby={`jd-connection-${flight.id}`}>
      <h3 id={`jd-connection-${flight.id}`} className="jd-heading">{t.connection}</h3>
      {connection.previous && legButton(connection.previous, t.previousLeg)}
      {connection.next && legButton(connection.next, t.nextLeg)}
    </section>}
    {firstLines.length > 0 && <section className="jd-section" aria-labelledby={`jd-firsts-${flight.id}`}>
      <h3 id={`jd-firsts-${flight.id}`} className="jd-heading">{t.firsts}</h3>
      <ul className="jd-firsts">{firstLines.map(line => <li key={line}>{line}</li>)}</ul>
    </section>}
    <section className="jd-section" aria-labelledby={`jd-record-${flight.id}`}>
      <h3 id={`jd-record-${flight.id}`} className="jd-heading">{t.record}</h3>
      <p className="jd-text">{origination}</p>
      {standing && <p className="jd-text">{standing}</p>}
    </section>
  </div>
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
