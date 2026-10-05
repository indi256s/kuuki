'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { findAirport } from '@kuuki/data/airport-lookup'
import countries from '@kuuki/data/countries.json'
import { api, ApiError, getAuthGeneration } from '../../../../web/src/lib/apiClient'
import type { ConfirmOutcome, ConfirmRequest } from '../../../../../functions/api/_services/confirmation'
import type { readTransitReview, ReviewOutcome, ReviewRequest } from '../../../../../functions/api/_services/transitReview'
import { useAwaiting, useOnline, type AwaitingQueue } from '../awaiting'
import { trackPrivateOperation } from '../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { awaitPublication } from '../publication'
import { DraftLinks } from './draft-links'
import { Ticket } from '../signature/ticket'
import { Stamp } from '../signature/stamp'
import { Button } from '../ui/button'
import { Disclosure } from '../ui/disclosure'
import { formatCount } from '../../lib/format'
import type { Locale } from '../../server/locale'

type Entry = AwaitingQueue['awaitingFlights'][number]
const forms = { en: { one: '{count} draft row', other: '{count} draft rows' }, ru: { one: '{count} строка для проверки', few: '{count} строки для проверки', many: '{count} строк для проверки', other: '{count} строки для проверки' } }

export function JournalQueue({ ownerId, locale, filtered = false, hiddenIds, onEdit, onDelete }: { ownerId: string; locale: Locale; filtered?: boolean; hiddenIds: number[]; onEdit: (id: number) => void; onDelete: (ids: number[]) => void }) {
  const { data, error, reload } = useAwaiting()
  const router = useRouter()
  const online = useOnline()
  const ru = locale === 'ru'
  const offlineId = useId()
  const headingId = useId()
  const [decisions, setDecisions] = useState<Record<number, boolean>>({})
  const [committedIds, setCommittedIds] = useState<number[]>([])
  const [receipt, setReceipt] = useState<{ request: ConfirmRequest; committed: boolean; revision?: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [stamped, setStamped] = useState<{ codes: string[]; event: string } | null>(null)
  const failureRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (failure && !busy) failureRef.current?.focus() }, [failure, busy])
  const statusRef = useRef<HTMLDivElement>(null)
  const operation = useRef<AbortController | null>(null)
  const lock = useRef(false)
  useEffect(() => () => operation.current?.abort(), [])
  const offlineNote = ru ? 'Нет сети. Подключитесь, чтобы изменить перелёты.' : 'Offline. Connect to change flights.'
  const offline = { 'aria-describedby': !online ? offlineId : undefined }
  const countryName = (code: string) => new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  const change = () => { window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT)); router.refresh() }
  async function confirm(entries: Entry[], previous?: { request: ConfirmRequest; committed: boolean; revision?: number }) {
    if (lock.current || !online) return
    lock.current = true
    setBusy(true); setFailure(''); setStamped(null)
    const controller = new AbortController(); operation.current = controller
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    const request = previous?.request ?? { operationId: crypto.randomUUID(), items: entries.map(entry => ({ flightId: entry.flight.id, candidateToken: entry.candidateToken, ...(decisions[entry.flight.id] === undefined ? {} : { arrivalTransit: decisions[entry.flight.id] }) })) }
    let committed = previous?.committed ?? false
    setReceipt({ request, committed })
    try {
      // A committed operation waits for publication; only its exact receipt may then be resolved.
      let result: ConfirmOutcome
      if (committed) {
        setMessage(ru ? 'Перелёты сохранены. Завершаем обновление…' : 'Flights saved. Finishing publication…')
        const queueRevision = previous?.revision ?? data?.revision ?? 0
        if (await awaitPublication(queueRevision, controller.signal, current) !== 'ready') return
        result = await api.post<ConfirmOutcome>('/api/flights/confirm', request, { signal: controller.signal })
      } else result = await api.post<ConfirmOutcome>('/api/flights/confirm', request, { signal: controller.signal })
      if (!current()) return
      committed = true
      setReceipt({ request, committed: true, revision: result.revision })
      setCommittedIds(ids => [...new Set([...ids, ...request.items.map(item => item.flightId)])])
      change()
      if (result.derivedState !== 'ready') {
        setMessage(ru ? 'Перелёты сохранены. Завершаем обновление…' : 'Flights saved. Finishing publication…')
        const publication = await awaitPublication(result.revision, controller.signal, current)
        if (publication !== 'ready') return
        result = await api.post<ConfirmOutcome>('/api/flights/confirm', request, { signal: controller.signal })
      }
      if (!current() || result.derivedState !== 'ready') return
      setReceipt(null)
      const codes = result.newlyStampedCountries ?? []
      const names = codes.map(countryName)
      setMessage(names.length ? `${ru ? 'Новые отметки' : 'New stamps'}: ${names.join(', ')}.` : (ru ? 'Перелёты подтверждены. Новых отметок нет.' : 'Flights confirmed. No new stamps.'))
      setStamped({ codes, event: request.operationId })
      change()
    } catch (cause) {
      if (!current()) return
      if (cause instanceof ApiError && cause.status < 500 && cause.status !== 408) { setReceipt(committed ? { request, committed, revision: previous?.revision } : null); reload() }
      setFailure(committed ? (ru ? 'Перелёты сохранены. Не удалось проверить обновление.' : 'Flights saved. Publication could not be checked.') : (ru ? 'Не удалось подтвердить перелёты. Проверьте соединение или обновите очередь.' : 'Could not confirm flights. Check your connection or refresh the queue.'))
    } finally { release(); lock.current = false; if (current()) { setBusy(false); statusRef.current?.focus() } }
  }
  const entries = data?.awaitingFlights.filter(entry => !hiddenIds.includes(entry.flight.id) && !committedIds.includes(entry.flight.id)) ?? []
  // ponytail: bounded to the C4 page of 100; index the links if that ceiling grows.
  const roots = entries.filter(entry => !entries.some(other => other.candidate.legId === entry.flight.id))
  const grouped = new Set<number>()
  const chains: Entry[][] = []
  for (const entry of [...roots, ...entries]) {
    if (grouped.has(entry.flight.id)) continue
    const chain: Entry[] = []
    let next: Entry | undefined = entry
    while (next && !grouped.has(next.flight.id)) { grouped.add(next.flight.id); chain.push(next); const legId: number | null = next.candidate.legId; next = entries.find(row => row.flight.id === legId) }
    chains.push(chain)
  }
  const card = (entry: Entry) => <div key={entry.flight.id} className="awaiting-card">
    <Ticket locale={locale} state="awaiting" origin={{ iata: entry.flight.origin, city: findAirport(entry.flight.origin)?.city ?? entry.flight.origin }} destination={{ iata: entry.flight.destination, city: findAirport(entry.flight.destination)?.city ?? entry.flight.destination }} date={entry.flight.date} flightNumber={entry.flight.flight_number ?? undefined} prompt={ru ? 'Вы долетели?' : 'Did you arrive?'} actions={<>
      <Button variant="primary" data-confirm-flight={entry.flight.id} disabled={busy || !!receipt || !online} {...offline} onClick={() => void confirm([entry])}>{ru ? 'Подтвердить прилёт' : 'Confirm arrival'}</Button>
      <Button disabled={busy || !!receipt || !online} {...offline} onClick={() => onEdit(entry.flight.id)}>{ru ? 'Изменить' : 'Change'}</Button>
      <Button disabled={busy || !!receipt || !online} {...offline} onClick={() => onDelete([entry.flight.id])}>{ru ? 'Не летали' : 'Did not fly'}</Button>
    </>} />
    {entry.candidate.kind !== 'none' && <div className="connection-row"><p>{ru ? 'Пересадка' : 'Connection'}: {entry.flight.destination} {entry.candidate.leg && <>→ {entry.candidate.leg.destination}</>} · {entry.candidate.label === 'estimated' ? (ru ? 'Оценка по датам' : 'Estimated from dates') : entry.candidate.label === 'ambiguous' ? (ru ? 'Неоднозначная пересадка: страна будет засчитана, пока вы её не измените' : 'Ambiguous: the country will count unless you change it') : (ru ? 'Определено по времени рейсов' : 'Based on flight times')}</p>{entry.candidate.kind === 'link' && <label><input type="checkbox" checked={!(decisions[entry.flight.id] ?? entry.effectiveDefault.transit)} disabled={!online || busy || !!receipt} {...offline} onChange={event => setDecisions(value => ({ ...value, [entry.flight.id]: !event.target.checked }))} />{ru ? 'Выходил в город' : 'Left the airport'}</label>}</div>}
  </div>
  return <section id="awaiting-queue" aria-labelledby={headingId} className="read-section">
    <h2 id={headingId}>{ru ? 'Ждут действия' : 'Awaiting action'}</h2>
    {filtered && <p className="muted">{ru ? 'Фильтры списка на них не действуют.' : 'Not affected by your filters.'}</p>}
    {!online && <p id={offlineId} className="status-note">{offlineNote}</p>}
    {error && <p role="alert">{ru ? 'Не удалось обновить очередь.' : 'Could not refresh the queue.'} <Button dense onClick={reload}>{ru ? 'Повторить' : 'Retry queue'}</Button></p>}
    {!data && !error && <p role="status">{ru ? 'Загружаем очередь…' : 'Loading queue…'}</p>}
    {data && <>
      <p className="muted">{ru ? 'Перелёты подтверждаются автоматически через семь дней после завершения. Черновики требуют проверки.' : 'Flights confirm automatically seven days after completion. Draft rows need your review.'}</p>
      {[...new Set(data.drafts.map(draft => draft.sourceType))].map(source => <section className="read-panel" key={source}><h3>{({ text: ru ? 'Текст' : 'Text', pdf: 'PDF', image: ru ? 'Изображения' : 'Images' } as Record<string, string>)[source] ?? (ru ? 'Другой источник' : 'Other source')}</h3><ul>{data.drafts.filter(draft => draft.sourceType === source).map(draft => <li key={draft.batchId}><a href={`/import?batch=${draft.batchId}`}>{draft.sourceLabel ?? (ru ? 'Продолжить импорт' : 'Continue import')}</a> · {draft.status === 'processing' ? (ru ? 'Обрабатывается' : 'Processing') : formatCount(locale, draft.reviewRowCount, forms)}</li>)}</ul></section>)}
      {entries.length >= 3 && <Button variant="primary" disabled={busy || !!receipt || !online} {...offline} onClick={() => void confirm(entries)}>{ru ? 'Подтвердить все показанные' : 'Confirm all shown'}</Button>}
      {chains.map(chain => chain.length >= 3 ? <Disclosure key={chain[0].flight.id} defaultOpen summary={`${ru ? 'Цепочка перелётов' : 'Flight chain'}: ${chain.map(entry => entry.flight.origin).join(' → ')} → ${chain.at(-1)!.flight.destination}`}>{chain.map(card)}</Disclosure> : chain.map(card))}
      {data.actionableCount === 0 && !entries.length && !data.drafts.length && <p>{ru ? 'Всё проверено.' : 'Everything is reviewed.'}</p>}
      {data.awaitingFlightCount > data.awaitingFlights.length && <p>{ru ? 'Показаны первые 100 перелётов. После подтверждения загрузится следующая часть.' : 'Showing the first 100 flights. Confirm them to load the next batch.'}</p>}
    </>}
    <DraftLinks ownerId={ownerId} locale={locale} />
    <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite">{message}</div>
    {failure && <p ref={failureRef} tabIndex={-1} role="alert">{failure}</p>}
    {receipt && !busy && <Button disabled={!online} {...offline} onClick={() => void confirm([], receipt)}>{receipt.committed ? (ru ? 'Проверить обновление' : 'Check publication') : (ru ? 'Повторить подтверждение' : 'Retry confirmation')}</Button>}
    {stamped && <div className="stamp-grid">{stamped.codes.map((code, index) => { const country = countries[code as keyof typeof countries]; return <Stamp key={code} countryCode={code} nativeName={country?.nativeName ?? code} name={new Intl.DisplayNames([locale], { type: 'region' }).of(code)} locale={locale} theme={document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'} kind="air" color={country?.dominantColor} pressEventId={`${stamped.event}:${code}`} static={index >= 8} /> })}</div>}
    <TransitReview locale={locale} />
  </section>
}

function TransitReview({ locale }: { locale: Locale }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof readTransitReview>> | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [request, setRequest] = useState<ReviewRequest | null>(null)
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const online = useOnline(); const ru = locale === 'ru'
  const offlineId = useId()
  const offline = { 'aria-describedby': !online ? offlineId : undefined }
  const countryName = (code: string) => new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  useEffect(() => {
    const read = new AbortController(); controller.current = read
    const release = trackPrivateOperation(read)
    void api.get<NonNullable<typeof data>>('/api/me/transit-review', undefined, { signal: read.signal }).then(value => { if (!read.signal.aborted) { setData(value); setError(false) } }).catch(() => { if (!read.signal.aborted) setError(true) }).finally(release)
    return () => { read.abort(); controller.current?.abort(); release() }
  }, [version])
  async function act(action: 'apply' | 'dismiss') {
    if (busy || !online || !data) return
    setBusy(true); setError(false)
    const op = request ?? { operationId: crypto.randomUUID(), action, items: action === 'dismiss' ? [] : data.candidates.filter(row => selected.includes(row.flight.id)).map(row => ({ flightId: row.flight.id, candidateToken: row.candidateToken })) }
    setRequest(op)
    const write = new AbortController(); controller.current = write; const release = trackPrivateOperation(write)
    try {
      let result = await api.post<ReviewOutcome>('/api/me/transit-review', op, { signal: write.signal })
      if (write.signal.aborted) return
      if (result.derivedState !== 'ready') {
        setNotice(ru ? 'Решения сохранены. Итоги обновляются.' : 'Decisions saved. Totals are updating.')
        if (await awaitPublication(result.revision, write.signal, () => !write.signal.aborted) !== 'ready') return
        result = await api.post<ReviewOutcome>('/api/me/transit-review', op, { signal: write.signal })
        if (write.signal.aborted || result.derivedState !== 'ready') return
      }
      setNotice(result.removedCountries?.length ? `${ru ? 'Удалены отметки' : 'Removed stamps'}: ${result.removedCountries.map(countryName).join(', ')}` : (ru ? 'Проверка сохранена.' : 'Review saved.'))
      setRequest(null); setVersion(value => value + 1); window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
    } catch (cause) { if (!write.signal.aborted) { if (cause instanceof ApiError && cause.status < 500 && cause.status !== 408) { setRequest(null); setVersion(value => value + 1) } setError(true) } } finally { release(); if (!write.signal.aborted) setBusy(false) }
  }
  return <div>
    {error && <p role="alert">{ru ? 'Не удалось загрузить или сохранить проверку пересадок.' : 'Connection review could not be loaded or saved.'} <Button dense onClick={() => setVersion(value => value + 1)}>{ru ? 'Повторить' : 'Retry review'}</Button></p>}
    <p role="status" aria-live="polite">{notice}</p>
    {data && data.candidates.length > 0 && !data.marker?.matchesCandidates && <Disclosure summary={ru ? 'Проверить старые пересадки' : 'Review historical connections'}>
      {!online && <p id={offlineId} className="status-note">{ru ? 'Нет сети. Подключитесь, чтобы сохранить проверку.' : 'Offline. Connect to save this review.'}</p>}
      <p>{ru ? 'Изменения применяются только к выбранным пересадкам. Прогноз отметок показан для всех предложенных пересадок.' : 'Changes apply only to selected connections. The stamp preview assumes all suggestions are selected.'}</p>
      {data.candidates.map(row => <label className="connection-row" key={row.flight.id}><input type="checkbox" checked={selected.includes(row.flight.id)} disabled={busy || !!request || !online} {...offline} onChange={event => setSelected(ids => event.target.checked ? [...ids, row.flight.id] : ids.filter(id => id !== row.flight.id))} />{row.flight.origin} → {row.flight.destination} → {row.candidate.leg?.destination} · {row.candidate.label === 'estimated' ? (ru ? 'Оценка по датам' : 'Estimated from dates') : (ru ? 'По времени рейсов' : 'Flight times')} · {row.affectedCountries.map(code => `${countryName(code)}: ${data.wouldRemoveStamp[code] ? (ru ? 'отметка будет удалена' : 'stamp will be removed') : (ru ? 'отметка останется' : 'stamp stays')}`).join(', ')}</label>)}
      <Button disabled={busy || !selected.length || !!request || !online} {...offline} onClick={() => void act('apply')}>{ru ? 'Отметить выбранные как транзит' : 'Mark selected as transit'}</Button>
      <Button disabled={busy || !!request || !online} {...offline} onClick={() => void act('dismiss')}>{ru ? 'Оставить как есть' : 'Keep as recorded'}</Button>
      {request && <Button disabled={busy || !online} {...offline} onClick={() => void act(request.action)}>{ru ? 'Повторить сохранение' : 'Retry review save'}</Button>}
    </Disclosure>}
  </div>
}
