'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { validateFlightInput } from '@kuuki/shared'
import { Combobox } from '../ui/combobox'
import { Calendar } from '../ui/calendar'
import { Disclosure } from '../ui/disclosure'
import { Ticket } from '../signature/ticket'
import { formatDateOnly, formatDuration } from '../../lib/format'
import { airportChoices, airlineChoices, aircraftChoices } from './reference-choices'
import { readCapturePreference, writeCapturePreference } from './capture-preferences'
import { findAirport } from '@kuuki/data/airport-lookup'
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { calculateFlightDistance, calculateFlightDuration, estimateFlightDuration } from '../../../../web/src/lib/geo'
import { checkDuplicateFlight, deleteFlight, getFlight, type Flight } from '../../../../web/src/lib/flights'
import { createFlight, updateFlight } from './flight-writes'
import { abandonFlightCreateOperation, currentFlightOperationId, pendingFlightCreateOperation, rotateFlightOperationId } from '../../../../web/src/lib/flightCreateOperations'
import { getAuthGeneration } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import type { Locale } from '../../server/locale'
import './capture.css'

const empty = { date: '', origin: '', destination: '', airline: '', aircraft: '', number: '', departure: '', arrival: '' }
type Values = typeof empty
const fieldNames: Record<string, keyof Values> = { date: 'date', origin: 'origin', destination: 'destination', airline_iata: 'airline', aircraft_icao: 'aircraft', flight_number: 'number', departure_time: 'departure', arrival_time: 'arrival' }
function input(values: Values) {
  return { date: values.date, origin: values.origin, destination: values.destination, airline_iata: values.airline || null, aircraft_icao: values.aircraft || null, flight_number: values.number || null, departure_time: values.departure || null, arrival_time: values.arrival || null }
}
export type FlightSurface = (content: ReactNode, footer?: ReactNode) => ReactNode

export function FlightForm({ ownerId, locale, editId, initialEditing = true, surface, onCancel, onOpenJournal }: { ownerId: string; locale: Locale; editId?: number; initialEditing?: boolean; surface?: FlightSurface; onCancel?: () => void; onOpenJournal?: () => void }) {
  const router = useRouter()
  const feedback = useWriteFeedback(ownerId)
  const ru = locale === 'ru'
  const choices = airportChoices(locale)
  const formId = `flight-form-${editId ?? 'new'}`
  const [editing, setEditing] = useState(initialEditing)
  const [recents, setRecents] = useState<Record<'airports' | 'airline' | 'aircraft', string[]>>(() => ({ airports: readCapturePreference(ownerId, 'airports', []), airline: readCapturePreference(ownerId, 'airline', []), aircraft: readCapturePreference(ownerId, 'aircraft', []) }))
  const remember = (kind: keyof typeof recents, code: string) => { const next = [code, ...recents[kind].filter(item => item !== code)].slice(0, 8); setRecents(previous => ({ ...previous, [kind]: next })); writeCapturePreference(ownerId, kind, next) }
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
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDetails, setShowDetails] = useState(() => readCapturePreference(ownerId, 'details', false))
  const invalidMessage = ru ? 'Проверьте значение поля.' : 'Check this field.'
  const schema = z.object({ date: z.string(), origin: z.string(), destination: z.string(), airline: z.string(), aircraft: z.string(), number: z.string(), departure: z.string(), arrival: z.string() }).superRefine((raw, ctx) => {
    const values = raw as Values
    try { validateFlightInput(input(values), 'create') } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      const field = Object.entries(fieldNames).find(([name]) => message.startsWith(name))?.[1] ?? (!values.date ? 'date' : !values.origin ? 'origin' : 'destination')
      ctx.addIssue({ code: 'custom', path: [field], message: invalidMessage })
    }
    if (values.origin && values.origin === values.destination) ctx.addIssue({ code: 'custom', path: ['destination'], message: ru ? 'Выберите другой аэропорт.' : 'Choose a different airport.' })
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty, mode: 'onBlur' })
  const { control, register, handleSubmit, watch, setValue, reset, formState, setFocus } = form
  const [date, origin, destination] = watch(['date', 'origin', 'destination'])
  const receipt = !editId && !busy && pendingFlightCreateOperation(ownerId, operationId)
  const current = (generation: number, controller: AbortController) => !controller.signal.aborted && generation === getAuthGeneration()
  useEffect(() => {
    if (!editId) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    void getFlight(editId, { signal: controller.signal }).then(row => { if (!current(generation, controller)) return; setFlight(row); if (row) { reset({ date: row.date, origin: row.origin, destination: row.destination, airline: row.airline_iata ?? '', aircraft: row.aircraft_icao ?? '', number: row.flight_number ?? '', departure: row.departure_time?.slice(0,5) ?? '', arrival: row.arrival_time?.slice(0,5) ?? '' }); setShowDetails(readCapturePreference(ownerId, 'details', false) || !!(row.airline_iata || row.aircraft_icao || row.flight_number || row.departure_time || row.arrival_time)) } }).catch(cause => { if (current(generation, controller)) setError(String(cause)) }).finally(() => { if (current(generation, controller)) setLoading(false) })
    return () => { controller.abort(); release() }
  }, [editId, reset, ownerId])
  useEffect(() => {
    setDuplicate(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || origin?.length !== 3 || destination?.length !== 3) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    const timer = setTimeout(() => void checkDuplicateFlight(ownerId, date, origin, destination, editId, { signal: controller.signal }).then(row => { if (current(generation, controller)) setDuplicate(row) }).catch(() => { if (current(generation, controller)) setDuplicate(null) }), 300)
    return () => { clearTimeout(timer); controller.abort(); release() }
  }, [ownerId, date, origin, destination, editId])
  async function save(values: Values, original?: object, bypassDuplicate = false) {
    if (saving.current || receipt && !original) return
    saving.current = true
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration(); setBusy(true); setError('')
    try {
      validateFlightInput(original ?? input(values), 'create')
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
      const ack = flight ? await updateFlight(flight.id, body) : await createFlight({ ...body, source: 'manual', user_id: ownerId } as Parameters<typeof createFlight>[0], operationId)
      if (!current(generation, controller)) return
      if (!flight) setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`))
      const nextRecents = [...new Set([values.origin, values.destination, ...recents.airports])].filter(Boolean).slice(0, 8)
      setRecents(previous => ({ ...previous, airports: nextRecents })); writeCapturePreference(ownerId, 'airports', nextRecents)
      feedback.acknowledge(ack); setSaved(true); router.refresh()
    } catch (cause) { if (current(generation, controller)) { focusBlockedSave.current = true; setError(cause instanceof Error ? cause.message : String(cause)) } }
    finally { saving.current = false; if (current(generation, controller)) setBusy(false); release() }
  }
  async function remove() {
    if (!flight || saving.current) return
    saving.current = true
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration(); setBusy(true); setError('')
    try { const ack = await deleteFlight(flight.id); if (current(generation, controller)) { feedback.acknowledge(ack); if (onOpenJournal) onOpenJournal(); else router.push('/journal'); router.refresh() } }
    catch (cause) { if (current(generation, controller)) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { saving.current = false; if (current(generation, controller)) setBusy(false); release() }
  }
  const fieldError = (name: keyof Values) => formState.errors[name]?.message
  const invalid = (issues: typeof formState.errors) => {
    const field = Object.keys(issues)[0] as keyof Values
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
  if (loading) return wrap(<p role="status">{ru ? 'Загружаем перелёт…' : 'Loading flight…'}</p>)
  if (editId && !flight) return wrap(<p role="alert">{error || (ru ? 'Перелёт не найден.' : 'Flight not found.')}</p>)
  if (saved) return wrap(<section role="status"><h2>{ru ? 'Перелёт сохранён' : 'Flight saved'}</h2><p>{feedback.status === 'ready' ? (ru ? 'Итоги обновлены.' : 'Totals updated.') : feedback.status === 'pending' ? (ru ? 'Итоги обновляются. Перелёт уже в журнале.' : 'Totals are updating. Your flight is in the journal.') : (ru ? 'Итоги ещё не подтвердили обновление. Перелёт уже в журнале.' : 'Totals have not confirmed publication yet. Your flight is in the journal.')}</p><a className="button primary" href="/journal" onClick={onOpenJournal ? event => { event.preventDefault(); onOpenJournal() } : undefined}>{ru ? 'Открыть журнал' : 'Open journal'}</a></section>)
  const deletion = <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}><Dialog.Portal><Dialog.Overlay className="ui-overlay" /><Dialog.Content className="capture-confirm" onCloseAutoFocus={event => { event.preventDefault(); deleteTrigger.current?.focus() }}><Dialog.Title>{ru ? 'Удалить перелёт?' : 'Delete flight?'}</Dialog.Title><Dialog.Description>{ru ? 'Этот перелёт будет удалён из журнала.' : 'This flight will be removed from your journal.'}</Dialog.Description><Dialog.Close type="button">{ru ? 'Отмена' : 'Cancel'}</Dialog.Close><button type="button" disabled={busy} onClick={() => void remove()}>{ru ? 'Удалить перелёт' : 'Delete flight'}</button></Dialog.Content></Dialog.Portal></Dialog.Root>
  const deleteButton = flight && <div className="flight-danger"><button type="button" ref={deleteTrigger} className="button secondary" disabled={busy} onClick={() => setConfirmDelete(true)}>{ru ? 'Удалить перелёт' : 'Delete flight'}</button></div>
  if (flight && !editing) {
    const state = (flight as Flight & { lifecycle_state?: 'upcoming' | 'awaiting' | 'logged' }).lifecycle_state ?? (flight.is_upcoming ? 'upcoming' : 'logged')
    return wrap(<section className="flight-detail"><Ticket locale={locale} state={state} origin={{ iata: flight.origin, city: choices.find(row => row.code === flight.origin)?.detail ?? flight.origin }} destination={{ iata: flight.destination, city: choices.find(row => row.code === flight.destination)?.detail ?? flight.destination }} date={flight.date} airline={flight.airline_iata ?? undefined} flightNumber={flight.flight_number ?? undefined} distanceKm={flight.distance_km ?? undefined} actions={<button type="button" className="button secondary" onClick={() => setEditing(true)}>{ru ? 'Изменить перелёт' : 'Edit flight'}</button>} /><dl>{[['Авиакомпания', 'Airline', flight.airline_iata], ['Самолёт', 'Aircraft', flight.aircraft_icao], ['Номер рейса', 'Flight number', flight.flight_number], ['Вылет', 'Departure', flight.departure_time], ['Прилёт', 'Arrival', flight.arrival_time], ['Длительность', 'Duration', flight.duration_minutes == null ? null : formatDuration(locale, flight.duration_minutes)]].map(([russian, english, value]) => <div key={english}><dt>{ru ? russian : english}</dt><dd>{value || (ru ? 'Не указано' : 'Not specified')}</dd></div>)}</dl>{deleteButton}{error && <p role="alert">{error}</p>}{deletion}</section>)
  }
  const combo = (name: 'origin' | 'destination' | 'airline' | 'aircraft', label: string) => <Controller name={name} control={control} render={({ field }) => <Combobox label={label} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} choices={name === 'airline' ? airlineChoices : name === 'aircraft' ? aircraftChoices : choices} locale={locale} error={fieldError(name)} disabled={busy} recents={recents[name === 'origin' || name === 'destination' ? 'airports' : name]} onSelect={code => remember(name === 'origin' || name === 'destination' ? 'airports' : name, code)} />} />
  const optional = (name: 'number' | 'departure' | 'arrival', label: string, type = 'text') => <label>{label}<input type={type} {...register(name)} aria-invalid={!!fieldError(name)} aria-describedby={fieldError(name) ? `${formId}-${name}-error` : undefined} />{fieldError(name) && <p id={`${formId}-${name}-error`} role="alert">{fieldError(name)}</p>}</label>
  const footer = <>{onCancel ? <button type="button" className="button secondary" onClick={onCancel}>{ru ? 'Отмена' : 'Cancel'}</button> : <a className="button secondary" href="/journal">{ru ? 'Отмена' : 'Cancel'}</a>}<button className="button primary" form={formId} disabled={busy || !!receipt} type="submit">{busy ? (ru ? 'Сохраняем…' : 'Saving…') : (ru ? 'Сохранить перелёт' : 'Save flight')}</button><small className="flight-keyboard-hint">⌘/Ctrl + Enter</small></>
  return wrap(<form id={formId} className="capture-card flight-editor" noValidate onSubmit={submit()}>
    <fieldset disabled={busy}><legend className="eyebrow">{ru ? 'Маршрут' : 'Route'}</legend><div className="capture-grid">{combo('origin', ru ? 'Откуда' : 'From')}{combo('destination', ru ? 'Куда' : 'To')}<button type="button" className="button secondary capture-swap" onClick={() => { setValue('origin', destination, { shouldDirty: true }); setValue('destination', origin, { shouldDirty: true }) }}>{ru ? 'Поменять местами' : 'Swap route'}</button></div>
    {duplicate && <div ref={duplicateRef} tabIndex={-1} role="status" className="flight-duplicate"><p>{ru ? 'Перелёт с этой датой и маршрутом уже есть.' : 'A flight with this date and route already exists.'}</p><p>{duplicate.origin} → {duplicate.destination} · {formatDateOnly(locale, duplicate.date)}</p><a className="button secondary" href={`/journal/${duplicate.id}/edit`}>{ru ? 'Открыть существующий' : 'Open existing'}</a><button type="button" className="button secondary" disabled={busy || !!receipt} onClick={() => void submit(true)()}>{ru ? 'Всё равно сохранить' : 'Save anyway'}</button></div>}
    <Controller name="date" control={control} render={({ field }) => <Calendar label={ru ? 'Дата' : 'Date'} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} locale={locale} error={fieldError('date')} disabled={busy} />} />
    <Disclosure summary={ru ? '＋ Подробности' : '＋ Optional details'} open={showDetails} onOpenChange={open => { setShowDetails(open); writeCapturePreference(ownerId, 'details', open) }}><div className="capture-grid">{combo('airline', ru ? 'Авиакомпания (необязательно)' : 'Airline (optional)')}{optional('number', ru ? 'Номер рейса (необязательно)' : 'Flight number (optional)')}{combo('aircraft', ru ? 'Самолёт (необязательно)' : 'Aircraft (optional)')}{optional('departure', ru ? 'Вылет (необязательно)' : 'Departure (optional)', 'time')}{optional('arrival', ru ? 'Прилёт (необязательно)' : 'Arrival (optional)', 'time')}</div></Disclosure></fieldset>
    {receipt && <div className="status-note" role="alert"><p>{receipt.expired ? (ru ? 'Срок безопасного повтора истёк. Проверьте журнал.' : 'Safe retry expired. Check the journal before a new save.') : (ru ? 'Предыдущее сохранение не подтверждено. Повторите исходные данные.' : 'The last save is unconfirmed. Retry the original flight.')}</p>{!receipt.expired && <button type="button" disabled={busy} onClick={() => void save(empty, receipt.body)}>{ru ? 'Повторить исходное сохранение' : 'Retry original save'}</button>}<button type="button" disabled={busy} onClick={() => { abandonFlightCreateOperation(ownerId, operationId); setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`)); setError('') }}>{ru ? 'Вы проверили журнал — новый перелёт' : 'I checked the journal — start a new save'}</button></div>}
    {error && <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>}{deleteButton}{deletion}
  </form>, surface ? footer : <footer className="capture-footer">{footer}</footer>)
}
