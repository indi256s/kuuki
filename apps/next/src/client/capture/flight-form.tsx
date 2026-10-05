'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import airports from '@kuuki/data/airports'
import airlines from '@kuuki/data/airlines'
import aircraft from '@kuuki/data/aircraft'
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

const schema = z.object({
  date: z.iso.date(), origin: z.string().regex(/^[A-Z]{3}$/), destination: z.string().regex(/^[A-Z]{3}$/),
  airline: z.string().regex(/^$|^[A-Z0-9]{2}$/), aircraft: z.string().regex(/^$|^[A-Z0-9]{2,4}$/),
  number: z.string().max(20), departure: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/), arrival: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
}).refine(value => value.origin !== value.destination, { path: ['destination'], message: 'Route must have different airports' })
type Values = z.infer<typeof schema>
const empty: Values = { date: '', origin: '', destination: '', airline: '', aircraft: '', number: '', departure: '', arrival: '' }
type Choice = { code: string; label: string }

function Combo({ label, value, onChange, choices, required = false }: { label: string; value: string; onChange: (value: string) => void; choices: Choice[]; required?: boolean }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const query = value
  const matches = query.trim() ? choices.filter(item => `${item.code} ${item.label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 8) : []
  return <div className="capture-combo"><label htmlFor={id}>{label}{required && ' *'}</label><input id={id} role="combobox" aria-expanded={open && matches.length > 0} aria-controls={`${id}-list`} aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined} aria-autocomplete="list" autoComplete="off" value={query} onChange={event => { const next = event.target.value.toUpperCase(); onChange(next); setActive(0); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setOpen(true); setActive(index => (index + 1) % matches.length) } if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setOpen(true); setActive(index => (index + matches.length - 1) % matches.length) } if (event.key === 'Enter' && open && matches[active]) { event.preventDefault(); onChange(matches[active].code); setOpen(false) } }} />{open && matches.length > 0 && <ul id={`${id}-list`} role="listbox">{matches.map((item, index) => <li id={`${id}-option-${index}`} key={item.code} role="option" aria-selected={index === active}><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(item.code); setOpen(false) }}>{item.code} · {item.label}</button></li>)}</ul>}</div>
}

const airportChoices: Choice[] = airports.filter(item => item.iata).map(item => ({ code: item.iata, label: `${item.city} · ${item.name}` }))
const airlineChoices: Choice[] = airlines.filter(item => item.iata).map(item => ({ code: item.iata, label: item.name }))
const aircraftChoices: Choice[] = aircraft.filter(item => item.icao).map(item => ({ code: item.icao, label: item.name }))

export function FlightForm({ ownerId, locale, editId }: { ownerId: string; locale: Locale; editId?: number }) {
  const router = useRouter()
  const feedback = useWriteFeedback(ownerId)
  const ru = locale === 'ru'
  const [operationId, setOperationId] = useState(() => currentFlightOperationId(`next-manual:${ownerId}`))
  const [flight, setFlight] = useState<Flight | null>(null)
  const [loading, setLoading] = useState(!!editId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<Flight | null>(null)
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })
  const { control, register, handleSubmit, watch, setValue, reset, formState } = form
  const [date, origin, destination] = watch(['date', 'origin', 'destination'])
  const receipt = !editId && !busy && pendingFlightCreateOperation(ownerId, operationId)
  const current = (generation: number, controller: AbortController) => !controller.signal.aborted && generation === getAuthGeneration()
  useEffect(() => {
    if (!editId) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    void getFlight(editId, { signal: controller.signal }).then(row => { if (!current(generation, controller)) return; setFlight(row); if (row) { reset({ date: row.date, origin: row.origin, destination: row.destination, airline: row.airline_iata ?? '', aircraft: row.aircraft_icao ?? '', number: row.flight_number ?? '', departure: row.departure_time?.slice(0,5) ?? '', arrival: row.arrival_time?.slice(0,5) ?? '' }); setShowDetails(!!(row.aircraft_icao || row.flight_number || row.departure_time || row.arrival_time)) } }).catch(cause => { if (current(generation, controller)) setError(String(cause)) }).finally(() => { if (current(generation, controller)) setLoading(false) })
    return () => { controller.abort(); release() }
  }, [editId, reset])
  useEffect(() => {
    if (!date || origin?.length !== 3 || destination?.length !== 3) { setDuplicate(null); return }
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    const timer = setTimeout(() => void checkDuplicateFlight(ownerId, date, origin, destination, editId, { signal: controller.signal }).then(row => { if (current(generation, controller)) setDuplicate(row) }).catch(() => { if (current(generation, controller)) setDuplicate(null) }), 300)
    return () => { clearTimeout(timer); controller.abort(); release() }
  }, [ownerId, date, origin, destination, editId])
  async function save(values: Values, original?: object) {
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration(); setBusy(true); setError('')
    try {
      const from = findAirport(values.origin), to = findAirport(values.destination), plane = values.aircraft ? findAircraft(values.aircraft) : undefined
      const distance = from && to ? calculateFlightDistance(from.latitude, from.longitude, to.latitude, to.longitude) : null
      const duration = values.departure && values.arrival ? calculateFlightDuration(values.departure, values.arrival, values.date, from?.timezone, to?.timezone) : distance == null ? null : estimateFlightDuration(distance, plane?.type)
      const body = original ?? { date: values.date, origin: values.origin, destination: values.destination, airline_iata: values.airline || null, aircraft_icao: values.aircraft || null, flight_number: values.number || null, departure_time: values.departure || null, arrival_time: values.arrival || null, distance_km: distance, duration_minutes: duration, origin_tz: from?.timezone || null, dest_tz: to?.timezone || null }
      const ack = flight ? await updateFlight(flight.id, body) : await createFlight({ ...body, source: 'manual', user_id: ownerId } as Parameters<typeof createFlight>[0], operationId)
      if (!current(generation, controller)) return
      if (!flight) setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`))
      feedback.acknowledge(ack); setSaved(true); router.refresh()
    } catch (cause) { if (current(generation, controller)) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (current(generation, controller)) setBusy(false); release() }
  }
  async function remove() {
    if (!flight) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration(); setBusy(true); setError('')
    try { const ack = await deleteFlight(flight.id); if (current(generation, controller)) { feedback.acknowledge(ack); router.push('/journal'); router.refresh() } }
    catch (cause) { if (current(generation, controller)) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (current(generation, controller)) setBusy(false); release() }
  }
  if (loading) return <p role="status">{ru ? 'Загружаем перелёт…' : 'Loading flight…'}</p>
  if (editId && !flight) return <p role="alert">{error || (ru ? 'Перелёт не найден.' : 'Flight not found.')}</p>
  if (saved) return <section className="capture-card" role="status"><h2>{ru ? 'Перелёт сохранён' : 'Flight saved'}</h2><p>{feedback.status === 'ready' ? (ru ? 'Итоги обновлены.' : 'Totals updated.') : feedback.status === 'pending' ? (ru ? 'Итоги обновляются. Перелёт уже в журнале.' : 'Totals are updating. Your flight is in the journal.') : (ru ? 'Итоги ещё не подтвердили обновление. Перелёт уже в журнале.' : 'Totals have not confirmed publication yet. Your flight is in the journal.')}</p><a className="button primary" href="/journal">{ru ? 'Открыть журнал' : 'Open journal'}</a></section>
  return <form className="capture-card" onSubmit={handleSubmit(values => void save(values))}>
    <div className="capture-grid"><label>{ru ? 'Дата' : 'Date'} *<input type="date" {...register('date')} /></label><span />
      <Controller name="origin" control={control} render={({ field }) => <Combo label={ru ? 'Откуда' : 'From'} value={field.value} onChange={field.onChange} choices={airportChoices} required />} />
      <Controller name="destination" control={control} render={({ field }) => <Combo label={ru ? 'Куда' : 'To'} value={field.value} onChange={field.onChange} choices={airportChoices} required />} />
      <button type="button" className="button secondary capture-swap" onClick={() => { setValue('origin', destination); setValue('destination', origin) }}>{ru ? 'Поменять местами' : 'Swap route'}</button>
      <Controller name="airline" control={control} render={({ field }) => <Combo label={ru ? 'Авиакомпания' : 'Airline'} value={field.value} onChange={field.onChange} choices={airlineChoices} />} />
    </div>
    <details open={showDetails} onToggle={event => setShowDetails(event.currentTarget.open)}><summary>{ru ? 'Дополнительные данные' : 'Optional details'}</summary><div className="capture-grid"><Controller name="aircraft" control={control} render={({ field }) => <Combo label={ru ? 'Самолёт' : 'Aircraft'} value={field.value} onChange={field.onChange} choices={aircraftChoices} />} /><label>{ru ? 'Номер рейса' : 'Flight number'}<input {...register('number')} /></label><label>{ru ? 'Вылет' : 'Departure'}<input type="time" {...register('departure')} /></label><label>{ru ? 'Прилёт' : 'Arrival'}<input type="time" {...register('arrival')} /></label></div></details>
    {Object.entries(formState.errors).map(([key, issue]) => <p role="alert" key={key}>{key}: {issue?.message}</p>)}
    {duplicate && <p role="status" className="status-note">{ru ? 'Похожий перелёт уже есть. Сохранить всё равно можно.' : 'A flight with this date and route already exists. You can still save.'} #{duplicate.id}</p>}
    {receipt && <div className="status-note" role="alert"><p>{receipt.expired ? (ru ? 'Срок безопасного повтора истёк. Проверьте журнал.' : 'Safe retry expired. Check the journal before a new save.') : (ru ? 'Предыдущее сохранение не подтверждено. Повторите исходные данные.' : 'The last save is unconfirmed. Retry the original flight.')}</p>{!receipt.expired && <button type="button" disabled={busy} onClick={() => void save(empty, receipt.body)}>{ru ? 'Повторить исходное сохранение' : 'Retry original save'}</button>}<button type="button" disabled={busy} onClick={() => { abandonFlightCreateOperation(ownerId, operationId); setOperationId(rotateFlightOperationId(`next-manual:${ownerId}`)); setError('') }}>{ru ? 'Я проверил(а) журнал — новый перелёт' : 'I checked the journal — start a new save'}</button></div>}
    {error && <p role="alert">{error}</p>}
    <footer className="capture-footer"><a className="button secondary" href="/journal">{ru ? 'Назад' : 'Back'}</a>{flight && <button type="button" ref={deleteTrigger} className="button secondary" onClick={() => setConfirmDelete(true)}>{ru ? 'Удалить' : 'Delete'}</button>}<button className="button primary" disabled={busy || !!receipt} type="submit">{busy ? (ru ? 'Сохраняем…' : 'Saving…') : (ru ? 'Сохранить перелёт' : 'Save flight')}</button></footer>
    <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}><Dialog.Portal><Dialog.Overlay className="read-sheet-overlay" /><Dialog.Content className="capture-confirm" onCloseAutoFocus={event => { event.preventDefault(); deleteTrigger.current?.focus() }}><Dialog.Title>{ru ? 'Удалить перелёт?' : 'Delete flight?'}</Dialog.Title><Dialog.Description>{ru ? 'Этот перелёт будет удалён из журнала.' : 'This flight will be removed from your journal.'}</Dialog.Description><Dialog.Close type="button">{ru ? 'Отмена' : 'Cancel'}</Dialog.Close><button type="button" disabled={busy} onClick={() => void remove()}>{ru ? 'Удалить' : 'Delete'}</button></Dialog.Content></Dialog.Portal></Dialog.Root>
  </form>
}
