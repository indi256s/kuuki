'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { findAirport } from '@kuuki/data/airport-lookup'
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { api, ApiError, getAuthGeneration } from '../../../../web/src/lib/apiClient'
import { type FlightInsert } from '../../../../web/src/lib/flights'
import { createFlights } from '../capture/flight-writes'
import { calculateFlightDistance, calculateFlightDuration, estimateFlightDuration } from '../../../../web/src/lib/geo'
import { abandonFlightCreateOperation, pendingImportFlightOperations } from '../../../../web/src/lib/flightCreateOperations'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import { dismissDraft, listDrafts, loadDraft, MAX_DRAFT_ROWS, saveDraft, type DraftRow, type ImportDraft, type ExtractedFlight } from '../capture/drafts'

type Locale = 'en' | 'ru'
type Step = 'source' | 'parsing' | 'review' | 'saving' | 'done'
type ParseResult = { flights: ExtractedFlight[] }
const schema = z.object({ date: z.iso.date(), origin: z.string().regex(/^[A-Z]{3}$/), destination: z.string().regex(/^[A-Z]{3}$/),
  airline_iata: z.string().regex(/^[A-Z0-9]{2}$/), flight_number: z.string().max(16), aircraft_icao: z.string().max(8),
  departure_time: z.string().max(16), arrival_time: z.string().max(16) }).refine(v => v.origin !== v.destination, { path: ['destination'], message: 'Choose a different airport' })
type FormData = z.infer<typeof schema>
const fromFlight = (f: ExtractedFlight): FormData => ({ date: f.date, origin: f.origin, destination: f.destination,
  airline_iata: f.airline_iata, flight_number: f.flight_number ?? '', aircraft_icao: f.aircraft_icao ?? '',
  departure_time: f.departure_time ?? '', arrival_time: f.arrival_time ?? '' })
function operationId(draftId: string, rowId: string): string {
  return `${draftId}:${BigInt(`0x${rowId.replaceAll('-', '')}`).toString()}`
}
function receiptHasDraftRow(ownerId: string, receiptOperationId: string): boolean {
  const draftId = receiptOperationId.split(':')[0]
  const found = loadDraft(ownerId, draftId)
  return found?.rows.some(row => operationId(draftId, row.id) === receiptOperationId) ?? false
}
function toInput(f: ExtractedFlight): Omit<FlightInsert, 'id' | 'created_at' | 'user_id'> {
  const origin = findAirport(f.origin), destination = findAirport(f.destination)
  const aircraft = f.aircraft_icao ? findAircraft(f.aircraft_icao) : null
  const distance = origin && destination ? calculateFlightDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude) : null
  const actualDuration = origin && destination && f.departure_time && f.arrival_time
    ? calculateFlightDuration(f.departure_time, f.arrival_time, f.date, origin.timezone, destination.timezone) : null
  return { date: f.date, origin: f.origin, destination: f.destination, airline_iata: f.airline_iata,
    flight_number: f.flight_number || null, aircraft_icao: f.aircraft_icao || null,
    departure_time: f.departure_time || null, arrival_time: f.arrival_time || null,
    distance_km: distance, duration_minutes: actualDuration || (distance ? estimateFlightDuration(distance, aircraft?.type) : null),
    origin_tz: origin?.timezone || null, dest_tz: destination?.timezone || null, source: 'ai_import',
    enrichment_status: f.enrichment_status || (f.aircraft_icao ? 'skipped' : 'pending') }
}
function errorCopy(error: unknown, ru: boolean): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return ru ? 'Лимит запросов исчерпан. Повторите позже.' : 'Import limit reached. Try again later.'
    if (error.code === 'PROVIDER_TIMEOUT' || error.status === 504) return ru ? 'Сервис не ответил вовремя. Повторите попытку.' : 'The service timed out. Try again.'
    if (error.code === 'UNKNOWN_AIRPORT') return ru ? 'Проверьте код аэропорта в строке перелёта.' : `Check the airport code: ${error.message}`
    if (error.code === 'UNKNOWN_AIRCRAFT') return ru ? 'Проверьте код самолёта в строке перелёта.' : `Check the aircraft code: ${error.message}`
    if (error.code === 'INVALID_FLIGHT') return ru ? 'Проверьте поля перелёта и исправьте строку.' : error.message
    if (error.status === 400 && error.code) return error.message
    if (error.status === 400 || error.status === 413 || error.status === 415) return ru ? 'Проверьте формат или размер файла.' : 'Check the file format or size.'
    if (error.status >= 500) return ru ? 'Сервис импорта сейчас недоступен.' : 'Import service is unavailable right now.'
    return error.message
  }
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) return ru ? 'Запрос прерван или истёк. Попробуйте ещё раз.' : 'The request stopped or timed out. Try again.'
  return error instanceof Error ? error.message : String(error)
}

function RowEditor({ row, onSave, locale }: { row: DraftRow; onSave: (flight: ExtractedFlight, yearConfirmed: boolean) => void; locale: Locale }) {
  const ru = locale === 'ru'
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: fromFlight(row.flight) })
  const [yearConfirmed, setYearConfirmed] = useState(row.yearConfirmed)
  return <form className="import-row-editor" onSubmit={handleSubmit(value => onSave({ ...row.flight, ...value }, yearConfirmed))}>
    {(['date', 'origin', 'destination', 'airline_iata', 'flight_number', 'aircraft_icao', 'departure_time', 'arrival_time'] as const).map(field =>
      <label key={field}>{({ date: ru ? 'Дата' : 'Date', origin: ru ? 'Откуда (IATA)' : 'From (IATA)', destination: ru ? 'Куда (IATA)' : 'To (IATA)',
        airline_iata: ru ? 'Авиакомпания' : 'Airline', flight_number: ru ? 'Рейс' : 'Flight number', aircraft_icao: ru ? 'Самолёт' : 'Aircraft',
        departure_time: ru ? 'Вылет' : 'Departure', arrival_time: ru ? 'Прилёт' : 'Arrival' })[field]}
        <input type={field === 'date' ? 'date' : 'text'} {...register(field, { setValueAs: value => ['origin', 'destination', 'airline_iata', 'aircraft_icao'].includes(field) ? String(value).toUpperCase() : value })} />
        {errors[field] && <small role="alert">{errors[field]?.message}</small>}
      </label>)}
    {row.flight.field_confidence?.date_year_explicit === false && <label><input type="checkbox" checked={yearConfirmed} onChange={e => setYearConfirmed(e.target.checked)} />{ru ? 'Я проверил(а) год' : 'I checked the year'}</label>}
    <button className="button primary" type="submit">{ru ? 'Сохранить изменения' : 'Save changes'}</button>
  </form>
}

export function ImportClient({ ownerId, locale, initialDraftId }: { ownerId: string; locale: Locale; initialDraftId?: string }) {
  const ru = locale === 'ru'
  const [step, setStep] = useState<Step>('source')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const draftRef = useRef<ImportDraft | null>(null)
  const [summaries, setSummaries] = useState<ReturnType<typeof listDrafts>>([])
  const [storageIssue, setStorageIssue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicateState, setDuplicateState] = useState<'checking' | 'ready' | 'error'>('checking')
  const [counts, setCounts] = useState({ saved: 0, failed: 0 })
  const [failedRows, setFailedRows] = useState<string[]>([])
  const [failureMessages, setFailureMessages] = useState<string[]>([])
  const [receipts, setReceipts] = useState<ReturnType<typeof pendingImportFlightOperations>>([])
  const controller = useRef<AbortController | null>(null)
  const feedback = useWriteFeedback(ownerId)

  useEffect(() => {
    setSummaries(listDrafts(ownerId))
    setReceipts(pendingImportFlightOperations(ownerId))
    const recovered = initialDraftId ? loadDraft(ownerId, initialDraftId) : null
    if (recovered) { draftRef.current = recovered; setDraft(recovered); setStep('review') }
    return () => controller.current?.abort()
  }, [ownerId, initialDraftId])

  function updateDraft(next: ImportDraft) {
    draftRef.current = next
    setDraft(next)
    const result = saveDraft(next)
    setStorageIssue(result.ok ? null : result.reason === 'quota'
      ? (ru ? 'Хранилище заполнено. Изменения останутся только до закрытия страницы.' : 'Storage is full. Changes will last only until this page closes.')
      : result.reason === 'limit' ? (ru ? 'Лимит черновиков или строк достигнут.' : 'Draft or row limit reached.')
      : (ru ? 'Локальное хранилище недоступно. Изменения останутся только до закрытия страницы.' : 'Local storage is unavailable. Changes will last only until this page closes.'))
    if (result.ok) setSummaries(listDrafts(ownerId))
  }
  function startNewSaveForRow(row: DraftRow) {
    if (!draft || row.saved) return
    const oldOperationId = operationId(draft.id, row.id)
    if (!pendingImportFlightOperations(ownerId).some(item => item.operationId === oldOperationId)) return
    const nextId = crypto.randomUUID()
    const next = { ...draft, rows: draft.rows.map(current => current.id === row.id
      ? { ...current, id: nextId, selected: false, saved: false } : current) }
    // Commit the new, unselected row identity before discarding its old receipt.
    const stored = saveDraft(next)
    if (!stored.ok) {
      setStorageIssue(ru ? 'Не удалось сохранить новый черновик. Исходный запрос сохранён.' : 'Could not store the new draft. The original request remains available.')
      return
    }
    abandonFlightCreateOperation(ownerId, oldOperationId)
    draftRef.current = next; setDraft(next)
    setReceipts(pendingImportFlightOperations(ownerId)); setSummaries(listDrafts(ownerId))
    setFailedRows(previous => previous.filter(id => id !== row.id))
    setStorageIssue(null)
  }
  function abandonOrphanReceipt(operation: string) {
    const item = pendingImportFlightOperations(ownerId).find(receipt => receipt.operationId === operation)
    if (!item || receiptHasDraftRow(ownerId, operation)) return
    abandonFlightCreateOperation(ownerId, operation)
    setReceipts(pendingImportFlightOperations(ownerId))
  }
  function chooseFile(candidate: File | null) {
    if (!candidate) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(candidate.type)) { setError(ru ? 'Нужен PDF, PNG или JPEG.' : 'Choose a PDF, PNG, or JPEG.'); return }
    if (candidate.size > 10 * 1024 * 1024) { setError(ru ? 'Файл больше 10 МБ.' : 'File is larger than 10 MB.'); return }
    setFile(candidate); setError(null)
  }
  async function parse() {
    if (!file && (!text.trim() || text.length > 100_000)) { setError(ru ? 'Введите текст до 100 000 символов.' : 'Enter text of up to 100,000 characters.'); return }
    const c = new AbortController(); controller.current = c
    const untrack = trackPrivateOperation(c), generation = getAuthGeneration()
    setStep('parsing'); setError(null)
    try {
      const content = file ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read file'))
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.readAsDataURL(file)
      }) : text
      if (c.signal.aborted || generation !== getAuthGeneration()) return
      const result = await api.post<ParseResult>('/api/import/parse', { type: file ? file.type === 'application/pdf' ? 'pdf' : 'image' : 'text', content }, { signal: c.signal, timeoutMs: 120_000 })
      if (c.signal.aborted || generation !== getAuthGeneration()) return
      if (result.flights.length > MAX_DRAFT_ROWS) {
        setStep('source'); setError(ru ? 'Найдено больше 100 перелётов. Разделите источник на части.' : 'More than 100 flights were found. Split the source into smaller parts.'); return
      }
      const flights = result.flights
      if (!flights.length) { setStep('source'); setError(ru ? 'Перелёты не найдены. Попробуйте другой источник.' : 'No flights found. Try another source.'); return }
      const now = Date.now()
      const next: ImportDraft = { schema: 1, id: crypto.randomUUID(), ownerId, createdAt: now, updatedAt: now,
        rows: flights.map(flight => ({ id: crypto.randomUUID(), flight, selected: flight.airline_iata !== 'ZZ' && flight.field_confidence?.date_year_explicit !== false,
          yearConfirmed: flight.field_confidence?.date_year_explicit !== false, duplicate: false, edited: false, saved: false })) }
      setText(''); setFile(null); updateDraft(next); setStep('review')
    } catch (e) {
      if (!c.signal.aborted && generation === getAuthGeneration()) { setError(errorCopy(e, ru)); setStep('source') }
    } finally { untrack(); if (controller.current === c) controller.current = null }
  }
  useEffect(() => {
    if (!draft || step !== 'review') return
    const c = new AbortController(), untrack = trackPrivateOperation(c), generation = getAuthGeneration()
    const signature = draft.rows.map(r => `${r.id}:${r.flight.date}:${r.flight.origin}:${r.flight.destination}`).join('|')
    setDuplicateState('checking')
    const timer = setTimeout(() => { void (async () => {
      try {
        const candidates = draft.rows.map((row, index) => ({ row, index })).filter(({ row }) => z.iso.date().safeParse(row.flight.date).success && /^[A-Z]{3}$/.test(row.flight.origin) && /^[A-Z]{3}$/.test(row.flight.destination))
        const matches = new Set<string>()
        for (let start = 0; start < candidates.length; start += 100) {
          const chunk = candidates.slice(start, start + 100)
          const reply = await api.post<{ matches: { candidateIndex: number }[] }>('/api/flights/duplicate-candidates', { candidates: chunk.map(({ row }) => ({ date: row.flight.date, origin: row.flight.origin, destination: row.flight.destination })) }, { signal: c.signal })
          for (const match of reply.matches) matches.add(chunk[match.candidateIndex].row.id)
        }
        if (c.signal.aborted || generation !== getAuthGeneration()) return
        const current = draftRef.current
        if (!current || current.id !== draft.id || current.rows.map(r => `${r.id}:${r.flight.date}:${r.flight.origin}:${r.flight.destination}`).join('|') !== signature) return
        const next = { ...current, rows: current.rows.map(row => ({ ...row, duplicate: matches.has(row.id), selected: row.saved || (matches.has(row.id) && !row.duplicate) ? false : row.selected })) }
        updateDraft(next); setDuplicateState('ready')
      } catch { if (!c.signal.aborted && generation === getAuthGeneration()) setDuplicateState('error') }
      finally { untrack() }
    })() }, 250)
    return () => { clearTimeout(timer); c.abort(); untrack() }
  // Recheck only when airport/date values change or a draft is first loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.rows.map(r => `${r.id}:${r.flight.date}:${r.flight.origin}:${r.flight.destination}`).join('|'), step === 'review'])

  async function save(rows: DraftRow[], retry = false) {
    if (!draft || !rows.length) return
    if (rows.some(row => draft.rows.find(current => current.id === row.id)?.saved)) return
    const c = new AbortController(), untrack = trackPrivateOperation(c), generation = getAuthGeneration()
    controller.current = c; setStep('saving'); setError(null)
    try {
      const entries = rows.map(row => ({ operationId: operationId(draft.id, row.id), flight: toInput(row.flight) }))
      const outcomes = await createFlights(ownerId, entries, ack => { if (!c.signal.aborted && generation === getAuthGeneration()) feedback.acknowledge(ack) })
      if (c.signal.aborted || generation !== getAuthGeneration()) return
      const failed = rows.filter((_, index) => outcomes[index] !== null).map(row => row.id)
      setFailureMessages(outcomes.filter((result): result is Error => result !== null).map(result => errorCopy(result, ru)))
      const saved = rows.length - failed.length
      setCounts(previous => retry ? { saved: previous.saved + saved, failed: failed.length } : { saved, failed: failed.length })
      setFailedRows(failed); setReceipts(pendingImportFlightOperations(ownerId)); setStep('done')
      const next = { ...draft, rows: draft.rows.map(row => ({ ...row,
        saved: row.saved || (rows.some(attempted => attempted.id === row.id) && !failed.includes(row.id)),
        selected: failed.includes(row.id) })) }
      if (next.rows.every(row => row.saved)) { dismissDraft(ownerId, draft.id); draftRef.current = null; setDraft(null); setSummaries(listDrafts(ownerId)) }
      else updateDraft(next)
    } catch (e) { if (!c.signal.aborted && generation === getAuthGeneration()) { setError(errorCopy(e, ru)); setStep('review') } }
    finally { untrack(); if (controller.current === c) controller.current = null }
  }

  async function recoverReceipts() {
    const pending = pendingImportFlightOperations(ownerId).filter(item => !item.expired && item.key)
    if (!pending.length) return
    const c = new AbortController(), untrack = trackPrivateOperation(c), generation = getAuthGeneration()
    controller.current = c; setStep('saving'); setError(null)
    try {
      const outcomes = await createFlights(ownerId, pending.map(item => ({ operationId: item.operationId, flight: item.body as Omit<FlightInsert, 'id' | 'created_at' | 'user_id'> })), ack => {
        if (!c.signal.aborted && generation === getAuthGeneration()) feedback.acknowledge(ack)
      })
      if (c.signal.aborted || generation !== getAuthGeneration()) return
      const saved = outcomes.filter(result => result === null).length
      for (const [index, result] of outcomes.entries()) {
        if (result !== null) continue
        const item = pending[index]
        const draftId = item.operationId.split(':')[0]
        const persisted = loadDraft(ownerId, draftId)
        if (!persisted) continue
        const next = { ...persisted, rows: persisted.rows.map(row => operationId(draftId, row.id) === item.operationId ? { ...row, saved: true, selected: false } : row) }
        if (next.rows.every(row => row.saved)) {
          dismissDraft(ownerId, draftId)
          if (draftRef.current?.id === draftId) { draftRef.current = null; setDraft(null) }
        }
        else updateDraft(next)
      }
      setFailureMessages(outcomes.filter((result): result is Error => result !== null).map(result => errorCopy(result, ru)))
      if (outcomes.every(result => result === null)) setFailedRows([])
      setCounts({ saved, failed: outcomes.length - saved }); setReceipts(pendingImportFlightOperations(ownerId)); setStep('done')
    } catch (e) { if (!c.signal.aborted && generation === getAuthGeneration()) { setError(errorCopy(e, ru)); setStep('source') } }
    finally { untrack(); if (controller.current === c) controller.current = null }
  }

  return <main className="import-page"><p className="eyebrow">{ru ? 'Источник → Проверка → Готово' : 'Source → Review → Done'}</p>
    <h1>{ru ? 'Импорт перелётов' : 'Import flights'}</h1>
    {storageIssue && <p role="alert" className="status-note">{storageIssue}</p>}
    {error && <p role="alert" className="status-note">{error}</p>}
    {step === 'source' && <section><h2>{ru ? 'Добавьте документ или текст' : 'Add a document or text'}</h2>
      <p>{ru ? 'PDF, PNG или JPEG до 10 МБ. Данные документа нужны только для обработки.' : 'PDF, PNG, or JPEG up to 10 MB. The document is used only for parsing.'}</p>
      <div role="button" tabIndex={0} aria-label={ru ? 'Выбрать или перетащить файл' : 'Choose or drop a file'}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('import-file')?.click() } }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0] ?? null) }}
        className={`import-dropzone ${dragging ? 'is-dragging' : ''}`}>
        <label htmlFor="import-file">{file?.name ?? (ru ? 'Выберите файл или перетащите его сюда' : 'Choose a file or drop it here')}</label>
        <input id="import-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => chooseFile(e.target.files?.[0] ?? null)} />
      </div>
      <label>{ru ? 'Или вставьте текст' : 'Or paste text'}<textarea value={text} maxLength={100_000} rows={7} onChange={e => { setText(e.target.value); if (e.target.value) setFile(null) }} /></label>
      <button className="button primary" disabled={!file && !text.trim()} onClick={() => void parse()}>{ru ? 'Найти перелёты' : 'Find flights'}</button>
      {summaries.length > 0 && <section><h2>{ru ? 'Черновики на этом устройстве' : 'Drafts on this device'}</h2><ul>{summaries.map(summary => <li key={summary.id}>
        <button onClick={() => { const recovered = loadDraft(ownerId, summary.id); if (recovered) { draftRef.current = recovered; setDraft(recovered); setStep('review') } }}>{new Date(summary.updatedAt).toLocaleDateString(locale)} · {summary.count} {ru ? 'перелётов' : 'flights'}</button>
        <button onClick={() => { dismissDraft(ownerId, summary.id); setSummaries(listDrafts(ownerId)) }}>{ru ? 'Удалить' : 'Dismiss'}</button></li>)}</ul></section>}
      {receipts.length > 0 && <div role="status"><p>{ru ? `Неподтверждённых сохранений: ${receipts.length}.` : `Unconfirmed saves: ${receipts.length}.`}</p>
        {receipts.some(item => item.expired) && <p>{ru ? 'Старые запросы нельзя безопасно повторять. Сначала проверьте Журнал.' : 'Old requests cannot be retried safely. Check Journal first.'}</p>}
        {receipts.some(item => !item.expired && item.key) && <button className="button" onClick={() => void recoverReceipts()}>{ru ? 'Повторить исходные запросы' : 'Retry original requests'}</button>}
        <a href="/journal">{ru ? 'Проверить Журнал' : 'Check Journal'}</a>
        <ul>{receipts.filter(item => !receiptHasDraftRow(ownerId, item.operationId)).map(item => <li key={item.operationId}>
          {item.body && typeof item.body === 'object' ? `${String((item.body as { origin?: string }).origin ?? '')} → ${String((item.body as { destination?: string }).destination ?? '')}` : ''}
          {item.expired ? (ru ? ' · Срок безопасного повтора истёк' : ' · Safe retry period expired') : ''}
          <button className="button" onClick={() => abandonOrphanReceipt(item.operationId)}>{ru ? 'Я проверил(а) Журнал — забыть этот запрос' : 'I checked Journal — discard this request'}</button>
        </li>)}</ul></div>}
    </section>}
    {step === 'parsing' && <p role="status">{ru ? 'Обрабатываем источник… Это может занять до двух минут.' : 'Parsing source… This can take up to two minutes.'}</p>}
    {step === 'review' && draft && <section><h2>{ru ? 'Проверьте перелёты' : 'Review flights'}</h2>
      <p>{ru ? 'Проверьте даты, аэропорты и выбранные строки. Возможные повторы сняты с выбора.' : 'Check dates, airports, and selected rows. Possible duplicates start unselected.'}</p>
      {duplicateState !== 'ready' && <p role="status">{duplicateState === 'checking' ? (ru ? 'Проверяем повторы…' : 'Checking duplicates…') : (ru ? 'Не удалось проверить повторы. Повторите попытку.' : 'Could not check duplicates. Try again.')}</p>}
      <ul className="import-rows">{draft.rows.map(row => <li key={row.id} className="import-row">
        <label><input type="checkbox" checked={row.selected} disabled={row.saved} onChange={e => updateDraft({ ...draft, rows: draft.rows.map(r => r.id === row.id ? { ...r, selected: e.target.checked } : r) })} />
          {row.flight.origin} → {row.flight.destination} · {row.flight.date}</label>
        <p>{row.saved ? (ru ? 'Сохранён' : 'Saved') : row.duplicate ? (ru ? 'Возможный повтор' : 'Possible duplicate') : ''} {row.flight.field_confidence?.date_year_explicit === false && !row.yearConfirmed ? (ru ? '· Проверьте год' : '· Check year') : ''}</p>
        <details><summary>{ru ? 'Изменить и посмотреть уверенность' : 'Edit and view confidence'} · {Math.round(row.flight.confidence * 100)}%</summary>
          {row.flight.field_confidence && <p>{Object.entries(row.flight.field_confidence).filter(([key]) => key !== 'date_year_explicit').map(([key, value]) => `${key}: ${Math.round(Number(value) * 100)}%`).join(' · ')}</p>}
          {!row.saved && <RowEditor key={`${row.id}:${row.edited}`} row={row} locale={locale} onSave={(flight, yearConfirmed) => updateDraft({ ...draft, rows: draft.rows.map(r => r.id === row.id ? { ...r, flight, yearConfirmed, edited: true } : r) })} />}
          {!row.saved && receipts.some(item => item.operationId === operationId(draft.id, row.id)) && <div><p>{ru ? 'Для этой строки сохранён исходный запрос. Изменённые поля нельзя отправить с прежним ключом.' : 'This row has an original save request. Edited fields cannot use its existing key.'}</p>
            <a href="/journal">{ru ? 'Проверить Журнал' : 'Check Journal'}</a>
            <button className="button" onClick={() => startNewSaveForRow(row)}>{ru ? 'Я проверил(а) Журнал — новое сохранение этой строки' : 'I checked Journal — start a new save for this row'}</button></div>}
        </details></li>)}</ul>
      <button className="button primary" disabled={duplicateState !== 'ready' || !draft.rows.some(row => row.selected) || draft.rows.some(row => row.selected && (!row.yearConfirmed || !schema.safeParse(fromFlight(row.flight)).success))}
        onClick={() => void save(draft.rows.filter(row => row.selected))}>{ru ? 'Сохранить выбранные' : 'Save selected'} ({draft.rows.filter(row => row.selected).length})</button>
      <button className="button" onClick={() => setStep('source')}>{ru ? 'Позже' : 'Later'}</button>
    </section>}
    {step === 'saving' && <p role="status">{ru ? 'Сохраняем перелёты…' : 'Saving flights…'}</p>}
    {step === 'done' && <section><h2>{ru ? 'Результат импорта' : 'Import result'}</h2><p role="status">{ru ? `Сохранено: ${counts.saved}. Не удалось подтвердить: ${counts.failed}.` : `Saved: ${counts.saved}. Unconfirmed or failed: ${counts.failed}.`}</p>
      {failureMessages.length > 0 && <ul>{failureMessages.map((message, index) => <li key={index}>{message}</li>)}</ul>}
      {(feedback.status === 'pending' || feedback.status === 'delayed') && <p role="status">{feedback.status === 'pending' ? (ru ? 'Итоги обновляются.' : 'Totals are updating.') : (ru ? 'Итоги обновляются дольше обычного.' : 'Totals are taking longer to update.')}</p>}
      {receipts.some(item => !item.expired && item.key) && <button className="button" onClick={() => void recoverReceipts()}>{ru ? 'Повторить неподтверждённые запросы' : 'Retry unconfirmed requests'}</button>}
      {failedRows.length > 0 && draft && !failedRows.some(id => receipts.some(item => item.expired && draft.rows.some(row => row.id === id && item.operationId === operationId(draft.id, row.id)))) && <button className="button primary" onClick={() => void save(draft.rows.filter(row => failedRows.includes(row.id)), true)}>{ru ? 'Повторить неудачные' : 'Retry failed'}</button>}
      {failedRows.length > 0 && draft && <button className="button" onClick={() => setStep('review')}>{ru ? 'Исправить строки' : 'Edit failed rows'}</button>}
      {draft?.rows.some(row => !row.saved && !failedRows.includes(row.id)) && <button className="button" onClick={() => setStep('review')}>{ru ? 'Проверить оставшиеся' : 'Review remaining rows'}</button>}
      <a className="button" href="/journal">{ru ? 'Открыть Журнал' : 'Open Journal'}</a>
      <button className="button" onClick={() => { setStep('source'); draftRef.current = null; setDraft(null); setCounts({ saved: 0, failed: 0 }); setFailedRows([]) }}>{ru ? 'Новый импорт' : 'New import'}</button>
    </section>}
  </main>
}
