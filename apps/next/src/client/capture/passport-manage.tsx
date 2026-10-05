'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import aircraft from '@kuuki/data/aircraft'
import { api, getAuthGeneration } from '../../../../web/src/lib/apiClient'
import { getAllFlights, type Flight } from '../../../../web/src/lib/flights'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import type { Locale } from '../../server/locale'
import './capture.css'

type BatchResult = { results: ({ id: number; status: 'accepted' } | { id: number; status: 'error'; error: string })[]; derived_state?: 'ready' | 'pending'; revision?: number }

export function PassportManage({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const ru = locale === 'ru', router = useRouter(), feedback = useWriteFeedback(ownerId)
  const [flights, setFlights] = useState<Flight[]>([])
  const [flightStatus, setFlightStatus] = useState<'unloaded' | 'loading' | 'ready' | 'error'>('unloaded')
  const [selected, setSelected] = useState<number[]>([])
  const [plane, setPlane] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const flightRequest = useRef<{ controller: AbortController; release: () => void } | null>(null)
  const current = (controller: AbortController, generation: number) => !controller.signal.aborted && generation === getAuthGeneration()
  function loadFlights() {
    flightRequest.current?.controller.abort(); flightRequest.current?.release()
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration()
    flightRequest.current = { controller, release }
    setFlightStatus('loading')
    void getAllFlights(ownerId, { signal: controller.signal }).then(rows => {
      if (current(controller, generation)) { setFlights(rows); setFlightStatus('ready') }
    }).catch(() => { if (current(controller, generation)) setFlightStatus('error') }).finally(() => {
      release(); if (flightRequest.current?.controller === controller) flightRequest.current = null
    })
  }
  useEffect(() => () => {
    flightRequest.current?.controller.abort(); flightRequest.current?.release(); flightRequest.current = null
  }, [ownerId])
  async function mutate(run: () => Promise<{ derived_state?: 'ready'|'pending'; revision?: number; results?: BatchResult['results'] }>): Promise<BatchResult['results'] | null> {
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration(); setBusy(true); setError(''); setMessage('')
    try {
      const ack = await run()
      if (!current(controller, generation)) return null
      const failures = ack.results?.filter(item => item.status === 'error') ?? []
      const accepted = ack.results?.filter(item => item.status === 'accepted') ?? []
      if (!ack.results || accepted.length) {
        feedback.acknowledge(ack); setMessage(ru ? 'Сохранено. Итоги могут обновиться позже.' : 'Saved. Totals may update later.')
        router.refresh()
      }
      if (failures.length) setError(failures.map(item => `${item.id}: ${item.status === 'error' ? item.error : ''}`).join('; '))
      return ack.results ?? []
    } catch (cause) { if (current(controller, generation)) setError(cause instanceof Error ? cause.message : String(cause)); return null }
    finally { if (current(controller, generation)) setBusy(false); release() }
  }
  async function applyAircraft() {
    const ids = [...selected]
    const result = await mutate(() => api.post<BatchResult>('/api/flights/aircraft-batch', { items: ids.map(id => ({ id, aircraft_icao: plane })) }))
    if (result) {
      const failed = new Set(result.filter(item => item.status === 'error').map(item => item.id))
      setSelected(ids.filter(id => failed.has(id)))
      if (result.some(item => item.status === 'accepted')) loadFlights()
    }
  }
  const eligible = flights.filter(row => !row.aircraft_icao)
  return <div className="capture-manage">
    <section className="capture-card"><h2>{ru ? 'Самолёты в журнале' : 'Aircraft in journal'}</h2><p>{ru ? 'Выберите до 20 своих перелётов без самолёта и назначьте тип.' : 'Select up to 20 of your flights without aircraft and assign a type.'}</p>
      {flightStatus === 'unloaded' && <button className="button secondary" onClick={loadFlights}>{ru ? 'Загрузить перелёты' : 'Load flights'}</button>}
      {flightStatus === 'loading' && <p role="status">{ru ? 'Загружаем перелёты…' : 'Loading flights…'}</p>}
      {flightStatus === 'error' && <p role="alert">{ru ? 'Не удалось загрузить перелёты.' : 'Could not load flights.'} <button type="button" onClick={loadFlights}>{ru ? 'Повторить' : 'Retry'}</button></p>}
      {flightStatus === 'ready' && <><fieldset disabled={busy}><legend>{ru ? 'Перелёты' : 'Flights'}</legend>{eligible.length === 0 ? <p>{ru ? 'Нет перелётов для обновления.' : 'No flights to update.'}</p> : eligible.map(row => <label key={row.id}><input type="checkbox" checked={selected.includes(row.id)} disabled={!selected.includes(row.id) && selected.length >= 20} onChange={event => setSelected(old => event.target.checked ? [...old, row.id] : old.filter(id => id !== row.id))} />{row.date} · {row.origin} → {row.destination} · {row.flight_number ?? '—'}</label>)}</fieldset><label>{ru ? 'Тип самолёта' : 'Aircraft type'}<select value={plane} disabled={busy} onChange={event => setPlane(event.target.value)}><option value="">{ru ? 'Выберите тип' : 'Select type'}</option>{aircraft.map(item => <option key={item.icao} value={item.icao}>{item.icao} · {item.name}</option>)}</select></label><button className="button primary" disabled={busy || !plane || selected.length === 0} onClick={() => void applyAircraft()}>{ru ? 'Применить к выбранным' : 'Apply to selected'}</button></>}
    </section>
    {message && <p role="status">{message} {feedback.status === 'ready' ? (ru ? 'Итоги обновлены.' : 'Totals updated.') : feedback.status === 'delayed' ? (ru ? 'Публикация итогов пока не подтверждена.' : 'Totals publication is not yet confirmed.') : ''}</p>}{error && <p role="alert">{error}</p>}
  </div>
}
