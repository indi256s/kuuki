'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useOnline } from '../awaiting'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { validateFlightInput } from '@kuuki/shared'
import { Button } from '../ui/button'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { Combobox } from '../ui/combobox'
import { Calendar } from '../ui/calendar'
import { Disclosure } from '../ui/disclosure'
import { Ticket } from '../signature/ticket'
import { formatDateOnly, formatDuration } from '../../lib/format'
import { airportChoices, airlineChoices, aircraftChoices } from './reference-choices'
import { readCapturePreference, writeCapturePreference } from './capture-preferences'
import { findAirport } from '@kuuki/data/airport-lookup'
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { calculateFlightDistance, calculateFlightDuration, estimateFlightDuration } from '@kuuki/client/geo'
import { checkDuplicateFlight, deleteFlight, getFlight, type Flight } from '@kuuki/client/flights'
import { createFlight, updateFlight } from './flight-writes'
import { abandonFlightCreateOperation, currentFlightOperationId, pendingFlightCreateOperation, rotateFlightOperationId } from '@kuuki/client/flightCreateOperations'
import { ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import { flightErrorMessage, validateFlightValues } from './flight-messages'
import type { Locale } from '../../server/locale'
import type { DerivedAck } from '@kuuki/client/derivedState'
import './capture.css'

const empty = { date: '', origin: '', destination: '', airline: '', aircraft: '', number: '', departure: '', arrival: '' }
type Values = typeof empty
function input(values: Values) {
  return { date: values.date, origin: values.origin, destination: values.destination, airline_iata: values.airline || null, aircraft_icao: values.aircraft || null, flight_number: values.number || null, departure_time: values.departure || null, arrival_time: values.arrival || null }
}
export type FlightSurface = (content: ReactNode, footer?: ReactNode) => ReactNode

export function FlightForm({ ownerId, locale, editId, initialEditing = true, focusField, surface, onCancel, onOpenJournal, onDelete, onSaved }: { ownerId: string; locale: Locale; editId?: number; initialEditing?: boolean; /** Opens Optional details and focuses this field once the flight has loaded. */ focusField?: 'aircraft'; surface?: FlightSurface; onCancel?: () => void; onOpenJournal?: () => void; onDelete?: (id: number) => void; onSaved?: (flight: Flight & DerivedAck, publication: 'idle' | 'ready' | 'pending' | 'delayed') => void }) {
  const router = useRouter()
  const online = useOnline()
  const feedback = useWriteFeedback(ownerId)
  const ru = locale === 'ru'
  const choices = airportChoices(locale)
  const formId = `flight-form-${editId ?? 'new'}`
  const [editing, setEditing] = useState(initialEditing)
  const [recents, setRecents] = useState<Record<'airports' | 'airline' | 'aircraft', string[]>>(() => ({ airports: readCapturePreference(ownerId, 'airports', []), airline: readCapturePreference(ownerId, 'airline', []), aircraft: readCapturePreference(ownerId, 'aircraft', []) }))
  const remember = (kind: keyof typeof recents, code: string) => { const next = [code, ...recents[kind].filter(item => item !== code)].slice(0, 8); setRecents(previous => ({ ...previous, [kind]: next })); writeCapturePreference(ownerId, kind, next) }
  // Offline never disables typing: only save and delete are blocked, each with its own visible reason.
  const saveReason = !online ? (ru ? 'Нет сети. Подключитесь, чтобы сохранить.' : 'Offline. Connect to save.') : undefined
  const deleteReason = !online ? (ru ? 'Нет сети. Подключитесь, чтобы удалить.' : 'Offline. Connect to delete.') : undefined
  const wrap = (content: ReactNode, footer?: ReactNode) => surface ? surface(content, footer) : <>{content}{footer}</>
  const [operationId, setOperationId] = useState(() => currentFlightOperationId(`next-manual:${ownerId}`))
  const [flight, setFlight] = useState<Flight | null>(null)
  const [loading, setLoading] = useState(!!editId)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<Flight | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const duplicateRef = useRef<HTMLDivElement>(null)
  const focusBlockedSave = useRef(false)
  useEffect(() => {
    if (!busy && focusBlockedSave.current) {
      focusBlockedSave.current = false
      const notice = error ? errorRef.current : duplicateRef.current
      notice?.focus()
    }
  }, [busy, error, duplicate])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedFlight, setSavedFlight] = useState<(Flight & DerivedAck) | null>(null)
  useEffect(() => { if (savedFlight) onSaved?.(savedFlight, feedback.status) }, [savedFlight, feedback.status, onSaved])
  const savedHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (saved) savedHeading.current?.focus() }, [saved])
  const [showDetails, setShowDetails] = useState(() => readCapturePreference(ownerId, 'details', false))
  const schema = z.object({ date: z.string(), origin: z.string(), destination: z.string(), airline: z.string(), aircraft: z.string(), number: z.string(), departure: z.string(), arrival: z.string() }).superRefine((raw, ctx) => {
    for (const [field, message] of Object.entries(validateFlightValues(raw as Values, locale))) ctx.addIssue({ code: 'custom', path: [field], message })
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty, mode: 'onTouched' })
  const { control, register, handleSubmit, watch, setValue, reset, formState, setFocus } = form
  const [date, origin, destination] = watch(['date', 'origin', 'destination'])
  const receipt = !editId && !busy && pendingFlightCreateOperation(ownerId, operationId)
  const current = (generation: number, controller: AbortController) => !controller.signal.aborted && generation === getAuthGeneration()
  useEffect(() => {
    if (!editId) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    void getFlight(editId, { signal: controller.signal }).then(row => { if (!current(generation, controller)) return; setFlight(row); if (row) { reset({ date: row.date, origin: row.origin, destination: row.destination, airline: row.airline_iata ?? '', aircraft: row.aircraft_icao ?? '', number: row.flight_number ?? '', departure: row.departure_time?.slice(0,5) ?? '', arrival: row.arrival_time?.slice(0,5) ?? '' }); setShowDetails(readCapturePreference(ownerId, 'details', false) || !!(row.airline_iata || row.aircraft_icao || row.flight_number || row.departure_time || row.arrival_time) || !!focusField) } }).catch(cause => { if (current(generation, controller)) setError(flightErrorMessage(cause, locale, 'load')) }).finally(() => { if (current(generation, controller)) setLoading(false) })
    return () => { controller.abort(); release() }
  }, [editId, reset, ownerId, locale, focusField])
  useEffect(() => {
    setDuplicate(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || origin?.length !== 3 || destination?.length !== 3) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    const timer = setTimeout(() => void checkDuplicateFlight(ownerId, date, origin, destination, editId, { signal: controller.signal }).then(row => { if (current(generation, controller)) setDuplicate(row) }).catch(() => { if (current(generation, controller)) setDuplicate(null) }), 300)
    return () => { clearTimeout(timer); controller.abort(); release() }
  }, [ownerId, date, origin, destination, editId])
  async function save(values: Values, original?: object, bypassDuplicate = false) {
    if (!online || saving.current || receipt && !original) return
    saving.current = true
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration(); setBusy(true); setError('')
    try {
      try { validateFlightInput(original ?? input(values), 'create') } catch { throw new ApiError(400, 'Invalid flight', 'INVALID_FLIGHT') }
      if (!original && !bypassDuplicate) {
        const existing = await checkDuplicateFlight(ownerId, values.date, values.origin, values.destination, editId, { signal: controller.signal })
        if (!current(generation, controller)) return
        setDuplicate(existing)
        if (existing) { focusBlockedSave.current = true; return }
      }
      const from = findAirport(values.origin), to = findAirport(values.destination), plane = values.aircraft ? findAircraft(values.aircraft) : undefined
      const distance = from && to ? calculateFlightDistance(from.latitude, from.longitude, to.latitude, to.longitude) : null
      const duration = values.departure && values.arrival ? calculateFlightDuration(values.departure, values.arrival, values.date, from?.timezone, to?.timezone) : distance == null ? null : estimateFlightDuration(distance, plane?.type)
      const body = original ?? { date: values.date, origin: values.origin, destination: values.destination, airline_iata: values.airline || null, aircraft_icao: values.aircraft || null, flight_number: values.number || null, departure_time: values.departure || null, arrival_time: values.arrival || null, distance_km: distance, duration_minutes: duration, origin_tz: from?.timezone || null, dest_tz: to?.timezone || null }
      const ack = flight ? await updateFlight(flight.id, body) : await createFlight({ ...body, source: 'manual', user_id: ownerId } as Parameters<typeof createFlight>[0], operationId, original ? receipt ? receipt.key : '' : undefined)
      if (!current(generation, controller)) return
      if (!flight) setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`))
      const nextRecents = [...new Set([values.origin, values.destination, ...recents.airports])].filter(Boolean).slice(0, 8)
      setRecents(previous => ({ ...previous, airports: nextRecents })); writeCapturePreference(ownerId, 'airports', nextRecents)
      feedback.acknowledge(ack); setSavedFlight(ack); setSaved(true); router.refresh()
    } catch (cause) { if (current(generation, controller)) { focusBlockedSave.current = true; setError(flightErrorMessage(cause, locale, 'save')) } }
    finally { saving.current = false; if (current(generation, controller)) setBusy(false); release() }
  }
  async function remove() {
    if (!online || !flight || saving.current) return false
    if (onDelete) { onDelete(flight.id); onOpenJournal?.(); return true }
    saving.current = true
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration(); setBusy(true); setDeleteError('')
    try { const ack = await deleteFlight(flight.id); if (current(generation, controller)) { feedback.acknowledge(ack); if (onOpenJournal) onOpenJournal(); else router.push('/journal'); router.refresh() } return true }
    catch (cause) { if (current(generation, controller)) { setDeleteError(flightErrorMessage(cause, locale, 'delete')); throw cause } }
    finally { saving.current = false; if (current(generation, controller)) setBusy(false); release() }
  }
  const fieldError = (name: keyof Values) => formState.errors[name]?.message
  const invalid = (issues: typeof formState.errors) => {
    // Focus the first invalid field in the order it appears on screen.
    const field = (['origin', 'destination', 'date', 'airline', 'aircraft', 'number', 'departure', 'arrival'] as const).find(name => name in issues) ?? (Object.keys(issues)[0] as keyof Values)
    if (['airline', 'aircraft', 'number', 'departure', 'arrival'].includes(field)) setShowDetails(true)
    requestAnimationFrame(() => setFocus(field))
  }
  const submit = (bypass = false) => handleSubmit(values => void save(values, undefined, bypass), invalid)
  const keyboardSave = useRef<() => void>(() => {})
  keyboardSave.current = () => { if (!loading && !saved && editing && !confirmDelete) void submit()() }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); keyboardSave.current() } }
    const resetPreferences = () => { setRecents({ airports: [], airline: [], aircraft: [] }); setShowDetails(false) }
    window.addEventListener('keydown', listener)
    window.addEventListener('kuuki:identity-reset', resetPreferences)
    return () => { window.removeEventListener('keydown', listener); window.removeEventListener('kuuki:identity-reset', resetPreferences) }
  }, [])
  const pendingFocus = useRef<'aircraft' | null>(focusField ?? null)
  useEffect(() => {
    if (!pendingFocus.current || loading || !flight || !editing) return
    if (!showDetails) { setShowDetails(true); return }
    const field = pendingFocus.current
    pendingFocus.current = null
    setFocus(field)
  }, [loading, flight, editing, showDetails, setFocus])
  if (loading) return wrap(<p role="status">{ru ? 'Загружаем перелёт…' : 'Loading flight…'}</p>)
  if (editId && !flight) return wrap(<p role="alert">{error || flightErrorMessage(new ApiError(404, 'Not found', 'NOT_FOUND'), locale, 'load')}</p>)
  if (saved) return wrap(<section><h2 ref={savedHeading} tabIndex={-1}>{ru ? 'Перелёт сохранён' : 'Flight saved'}</h2><p role="status">{feedback.status === 'ready' ? (ru ? 'Итоги обновлены.' : 'Totals updated.') : feedback.status === 'pending' ? (ru ? 'Итоги обновляются. Перелёт уже в журнале.' : 'Totals are updating. Your flight is in the journal.') : (ru ? 'Итоги ещё не подтвердили обновление. Перелёт уже в журнале.' : 'Totals have not confirmed publication yet. Your flight is in the journal.')}</p><a className="button primary" href="/journal" onClick={onOpenJournal ? event => { event.preventDefault(); onOpenJournal() } : undefined}>{onOpenJournal ? (ru ? 'Готово' : 'Done') : (ru ? 'Открыть журнал' : 'Open journal')}</a></section>)
  const deleteButton = flight && <div className="flight-danger"><DestructiveConfirm
    open={confirmDelete} onOpenChange={next => { if (next) setDeleteError(''); setConfirmDelete(next) }}
    trigger={<Button variant="danger" disabled={busy} disabledReason={deleteReason}>{ru ? 'Удалить перелёт' : 'Delete flight'}</Button>}
    title={ru ? `Удалить перелёт ${flight.origin} → ${flight.destination}, ${formatDateOnly(locale, flight.date)}?` : `Delete ${flight.origin} → ${flight.destination}, ${formatDateOnly(locale, flight.date)}?`}
    consequence={ru ? 'Этот перелёт будет удалён из журнала.' : 'This flight will be removed from your journal.'}
    confirmLabel={ru ? 'Удалить перелёт' : 'Delete flight'} cancelLabel={ru ? 'Отмена' : 'Cancel'} closeLabel={ru ? 'Закрыть' : 'Close'}
    errorMessage={deleteError} confirmDisabledReason={deleteReason} onConfirm={async () => { if (await remove()) setConfirmDelete(false) }} /></div>
  if (flight && !editing) {
    const state = (flight as Flight & { lifecycle_state?: 'upcoming' | 'awaiting' | 'logged' }).lifecycle_state ?? (flight.is_upcoming ? 'upcoming' : 'logged')
    const time = (value: string | null) => value ? value.slice(0, 5) : null
    return wrap(<section className="flight-detail"><Ticket locale={locale} state={state} origin={{ iata: flight.origin, city: choices.find(row => row.code === flight.origin)?.detail ?? flight.origin }} destination={{ iata: flight.destination, city: choices.find(row => row.code === flight.destination)?.detail ?? flight.destination }} date={flight.date} airline={flight.airline_iata ?? undefined} flightNumber={flight.flight_number ?? undefined} distanceKm={flight.distance_km ?? undefined} actions={<Button onClick={() => setEditing(true)}>{ru ? 'Изменить перелёт' : 'Edit flight'}</Button>} /><dl>{[['Авиакомпания', 'Airline', flight.airline_iata], ['Самолёт', 'Aircraft', flight.aircraft_icao], ['Номер рейса', 'Flight number', flight.flight_number], ['Вылет', 'Departure', time(flight.departure_time)], ['Прилёт', 'Arrival', time(flight.arrival_time)], ['Длительность', 'Duration', flight.duration_minutes == null ? null : formatDuration(locale, flight.duration_minutes)]].map(([russian, english, value]) => <div key={english}><dt>{ru ? russian : english}</dt><dd>{value || (ru ? 'Не указано' : 'Not specified')}</dd></div>)}</dl>{deleteButton}{error && <p role="alert">{error}</p>}</section>)
  }
  const combo = (name: 'origin' | 'destination' | 'airline' | 'aircraft', label: string) => <Controller name={name} control={control} render={({ field }) => <Combobox label={label} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} choices={name === 'airline' ? airlineChoices : name === 'aircraft' ? aircraftChoices : choices} locale={locale} error={fieldError(name)} disabled={busy} recents={recents[name === 'origin' || name === 'destination' ? 'airports' : name]} onSelect={code => remember(name === 'origin' || name === 'destination' ? 'airports' : name, code)} />} />
  const optional = (name: 'number' | 'departure' | 'arrival', label: string, type = 'text') => <div className="flight-field"><label htmlFor={`${formId}-${name}`}>{label}</label><input id={`${formId}-${name}`} type={type} {...register(name)} aria-invalid={!!fieldError(name)} aria-describedby={fieldError(name) ? `${formId}-${name}-error` : undefined} />{fieldError(name) && <p id={`${formId}-${name}-error`} role="alert">{fieldError(name)}</p>}</div>
  const footer = <>{onCancel ? <Button onClick={onCancel}>{ru ? 'Отмена' : 'Cancel'}</Button> : <a className="button secondary" href="/journal">{ru ? 'Отмена' : 'Cancel'}</a>}<Button variant="primary" type="submit" form={formId} loading={busy} loadingLabel={ru ? 'Сохраняем…' : 'Saving…'} disabled={!!receipt} disabledReason={saveReason}>{ru ? 'Сохранить перелёт' : 'Save flight'}</Button><small className="flight-keyboard-hint">⌘/Ctrl + Enter</small></>
  return wrap(<form id={formId} className="capture-card flight-editor" noValidate onSubmit={submit()}>
    <fieldset disabled={busy}><legend className="eyebrow">{ru ? 'Маршрут' : 'Route'}</legend><div className="capture-grid">{combo('origin', ru ? 'Откуда' : 'From')}{combo('destination', ru ? 'Куда' : 'To')}<button type="button" className="button secondary capture-swap" onClick={() => { setValue('origin', destination, { shouldDirty: true }); setValue('destination', origin, { shouldDirty: true }) }}>{ru ? 'Поменять местами' : 'Swap route'}</button></div>
    {duplicate && <div ref={duplicateRef} tabIndex={-1} role="status" className="flight-duplicate"><p>{ru ? 'Перелёт с этой датой и маршрутом уже есть.' : 'A flight with this date and route already exists.'}</p><p>{duplicate.origin} → {duplicate.destination} · {formatDateOnly(locale, duplicate.date)}</p><a className="button secondary" href={`/journal/${duplicate.id}/edit`}>{ru ? 'Открыть существующий' : 'Open existing'}</a><Button disabled={busy || !!receipt} disabledReason={saveReason} onClick={() => void submit(true)()}>{ru ? 'Всё равно сохранить' : 'Save anyway'}</Button></div>}
    <Controller name="date" control={control} render={({ field }) => <Calendar label={ru ? 'Дата' : 'Date'} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} locale={locale} error={fieldError('date')} disabled={busy} />} />
    <Disclosure summary={ru ? 'Подробности' : 'Optional details'} open={showDetails} onOpenChange={open => { setShowDetails(open); writeCapturePreference(ownerId, 'details', open) }}><div className="capture-grid">{combo('airline', ru ? 'Авиакомпания (необязательно)' : 'Airline (optional)')}{optional('number', ru ? 'Номер рейса (необязательно)' : 'Flight number (optional)')}{combo('aircraft', ru ? 'Самолёт (необязательно)' : 'Aircraft (optional)')}{optional('departure', ru ? 'Вылет (необязательно)' : 'Departure (optional)', 'time')}{optional('arrival', ru ? 'Прилёт (необязательно)' : 'Arrival (optional)', 'time')}</div></Disclosure></fieldset>
    {receipt && <div className="status-note" role="alert"><p>{receipt.expired ? (ru ? 'Срок безопасного повтора истёк. Проверьте журнал.' : 'Safe retry expired. Check the journal before a new save.') : (ru ? 'Предыдущее сохранение не подтверждено. Повторите исходные данные.' : 'The last save is unconfirmed. Retry the original flight.')}</p>{!receipt.expired && <Button disabled={busy} disabledReason={saveReason} onClick={() => void save(empty, receipt.body)}>{ru ? 'Повторить исходное сохранение' : 'Retry original save'}</Button>}<Button disabled={busy} disabledReason={saveReason} onClick={() => { abandonFlightCreateOperation(ownerId, operationId); setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`)); setError('') }}>{ru ? 'Журнал проверен — начать новое сохранение' : 'I checked the journal — start a new save'}</Button></div>}
    {error && <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>}{deleteButton}
  </form>, surface ? footer : <footer className="capture-footer">{footer}</footer>)
}
