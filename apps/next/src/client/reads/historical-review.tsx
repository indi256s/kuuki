'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { api, ApiError } from '@kuuki/client/apiClient'
import type { readTransitReview, ReviewOutcome, ReviewRequest } from '../../../../../functions/api/_services/transitReview'
import { useOnline } from '../awaiting'
import { trackPrivateOperation } from '../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { awaitPublication } from '../publication'
import { Button } from '../ui/button'
import { Disclosure } from '../ui/disclosure'
import type { Locale } from '../../server/locale'

export function HistoricalReview({ locale }: { locale: Locale }) {
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
      {data.candidates.map(row => <label className="connection-row" key={row.flight.id}><input type="checkbox" checked={selected.includes(row.flight.id)} disabled={busy || !!request || !online} {...offline} onChange={event => setSelected(ids => event.target.checked ? [...ids, row.flight.id] : ids.filter(id => id !== row.flight.id))} />{row.flight.origin} → {row.flight.destination} → {row.candidate.leg?.destination} · {row.candidate.label === 'estimated' ? (ru ? 'Оценка по датам' : 'Estimated from dates') : (ru ? 'Определено по времени рейсов' : 'Based on flight times')} · {row.affectedCountries.map(code => `${countryName(code)}: ${data.wouldRemoveStamp[code] ? (ru ? 'отметка будет удалена' : 'stamp will be removed') : (ru ? 'отметка останется' : 'stamp stays')}`).join(', ')}</label>)}
      <Button disabled={busy || !selected.length || !!request || !online} {...offline} onClick={() => void act('apply')}>{ru ? 'Отметить выбранные как транзит' : 'Mark selected as transit'}</Button>
      <Button disabled={busy || !!request || !online} {...offline} onClick={() => void act('dismiss')}>{ru ? 'Оставить как есть' : 'Keep as recorded'}</Button>
      {request && <Button disabled={busy || !online} {...offline} onClick={() => void act(request.action)}>{ru ? 'Повторить сохранение' : 'Retry review save'}</Button>}
    </Disclosure>}
  </div>
}
