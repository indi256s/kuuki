'use client'

import { useEffect, useRef, useState } from 'react'
import aircraft from '@kuuki/data/aircraft'
import { getAuthGeneration } from '../../../../web/src/lib/apiClient'
import { getAllFlights, type Flight } from '../../../../web/src/lib/flights'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import { acceptAircraft, AIRCRAFT_BATCH, countAircraftRun, retryableAircraft, summarizeAircraftRun, type AircraftOutcome, type AircraftRunCounts } from '../import/aircraft-review'
import { S } from '../import/copy'
import { acceptAircraftBatch } from '../import/import-api'
import { formatDateOnly } from '../../lib/format'
import type { Locale } from '../../server/locale'
import './capture.css'

export function PassportManage({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const ru = locale === 'ru', feedback = useWriteFeedback(ownerId)
  const [flights, setFlights] = useState<Flight[]>([])
  const [flightStatus, setFlightStatus] = useState<'unloaded' | 'loading' | 'ready' | 'error'>('unloaded')
  const [selected, setSelected] = useState<number[]>([])
  const [plane, setPlane] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [outcomes, setOutcomes] = useState<Map<number, AircraftOutcome>>(new Map())
  // Counts for the submission that just finished only; cleared when the next one starts so every completion is announced.
  const [last, setLast] = useState<AircraftRunCounts | null>(null)
  // Flights seen so far and the type sent for each, so a saved row keeps its label after the reload and a retry resends the same type.
  const seen = useRef(new Map<number, Flight>())
  const sent = useRef(new Map<number, string>())
  const flightRequest = useRef<{ controller: AbortController; release: () => void } | null>(null)
  const current = (controller: AbortController, generation: number) => !controller.signal.aborted && generation === getAuthGeneration()
  function loadFlights(quiet = false) {
    flightRequest.current?.controller.abort(); flightRequest.current?.release()
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration()
    flightRequest.current = { controller, release }
    if (!quiet) setFlightStatus('loading')
    void getAllFlights(ownerId, { signal: controller.signal }).then(rows => {
      if (current(controller, generation)) { for (const row of rows) seen.current.set(row.id, row); setFlights(rows); setFlightStatus('ready') }
    }).catch(() => { if (current(controller, generation)) setFlightStatus('error') }).finally(() => {
      release(); if (flightRequest.current?.controller === controller) flightRequest.current = null
    })
  }
  useEffect(() => () => {
    flightRequest.current?.controller.abort(); flightRequest.current?.release(); flightRequest.current = null
  }, [ownerId])
  async function accept(items: Array<{ id: number; aircraft_icao: string }>) {
    if (items.length === 0) return
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration()
    setBusy(true); setMessage(''); setLast(null)
    for (const item of items) sent.current.set(item.id, item.aircraft_icao)
    try {
      const run = await acceptAircraft(items, acceptAircraftBatch)
      if (!current(controller, generation)) return
      setOutcomes(old => { const next = new Map(old); for (const [id, outcome] of run.rows) next.set(id, outcome); return next })
      setLast(countAircraftRun(run.rows.values()))
      // Anything not saved stays selected, so one press retries exactly those.
      setSelected(items.map(item => item.id).filter(id => run.rows.get(id)?.status !== 'saved'))
      const ack = run.acks.filter(item => item.derived_state).at(-1)
      if ([...run.rows.values()].some(outcome => outcome.status === 'saved') && ack) {
        feedback.acknowledge(ack); setMessage(ru ? 'Сохранено. Итоги могут обновиться позже.' : 'Saved. Totals may update later.')
      }
      // Saved rows leave the eligible set; an uncertain row may or may not have, so the list is read again after every outcome.
      loadFlights(true)
    } finally { if (current(controller, generation)) setBusy(false); release() }
  }
  const eligible = flights.filter(row => !row.aircraft_icao)
  const chosen = selected.filter(id => eligible.some(row => row.id === id))
  const retryIds = retryableAircraft({ rows: outcomes, acks: [], uncertain: false })
  const label = (id: number) => { const row = seen.current.get(id); return row ? `${formatDateOnly(locale, row.date, 'medium')} · ${row.origin} → ${row.destination} · ${row.flight_number ?? '—'}` : String(id) }
  const tag = (outcome: AircraftOutcome, id: number) => {
    if (outcome.status === 'saved') return <><span>{S.aircraftSavedTag[locale]}</span> · <span>{sent.current.get(id) ?? outcome.icao}</span></>
    if (outcome.status === 'uncertain') return <><span>{S.aircraftUncertainTag[locale]}</span><p>{S.aircraftUncertainNote[locale]}</p></>
    if (outcome.status === 'failed') return <span>{S.aircraftFailedTag[locale]}{outcome.code ? ` · ${outcome.code}` : ''}</span>
    return null
  }
  const reported = [...outcomes].filter(([, outcome]) => outcome.status !== 'unsent')
  const savedN = last?.saved ?? 0
  // The announcement covers the submission that just finished. Nothing saved is a problem, so it is assertive; anything saved is polite.
  const summary = summarizeAircraftRun(locale, last)
  return <div className="capture-manage">
    <section className="capture-card"><p>{ru ? 'Выберите до 20 своих перелётов без самолёта и назначьте тип.' : 'Select up to 20 of your flights without aircraft and assign a type.'}</p>
      {flightStatus === 'unloaded' && <button className="button secondary" onClick={() => loadFlights()}>{ru ? 'Загрузить перелёты' : 'Load flights'}</button>}
      {flightStatus === 'loading' && <p role="status">{ru ? 'Загружаем перелёты…' : 'Loading flights…'}</p>}
      {flightStatus === 'error' && <p role="alert">{ru ? 'Не удалось загрузить перелёты.' : 'Could not load flights.'} <button type="button" onClick={() => loadFlights()}>{ru ? 'Повторить' : 'Retry'}</button></p>}
      {flightStatus === 'ready' && <><fieldset disabled={busy}><legend>{ru ? 'Перелёты' : 'Flights'}</legend>{eligible.length === 0 ? <p>{ru ? 'Нет перелётов для обновления.' : 'No flights to update.'}</p> : eligible.map(row => <label key={row.id}><input type="checkbox" checked={chosen.includes(row.id)} disabled={!chosen.includes(row.id) && chosen.length >= AIRCRAFT_BATCH} onChange={event => setSelected(old => event.target.checked ? [...old, row.id] : old.filter(id => id !== row.id))} />{label(row.id)}</label>)}</fieldset><label>{ru ? 'Тип самолёта' : 'Aircraft type'}<select value={plane} disabled={busy} onChange={event => setPlane(event.target.value)}><option value="">{ru ? 'Выберите тип' : 'Select type'}</option>{aircraft.map(item => <option key={item.icao} value={item.icao}>{item.icao} · {item.name}</option>)}</select></label><button className="button primary" disabled={busy || !plane || chosen.length === 0} onClick={() => void accept(chosen.map(id => ({ id, aircraft_icao: plane })))}>{ru ? 'Применить к выбранным' : 'Apply to selected'}</button></>}
      {reported.length > 0 && <><ul className="capture-outcomes" aria-label={ru ? 'Результат' : 'Result'}>{reported.map(([id, outcome]) => <li key={id} data-state={outcome.status}>{label(id)} — {tag(outcome, id)}</li>)}</ul>
        {retryIds.length > 0 && <button type="button" className="button secondary" disabled={busy} onClick={() => void accept(retryIds.flatMap(id => { const icao = sent.current.get(id); return icao ? [{ id, aircraft_icao: icao }] : [] }))}>{S.aircraftRetry[locale]}</button>}</>}
    </section>
    <p role="status">{[savedN > 0 ? summary : '', message, message ? (feedback.status === 'ready' ? (ru ? 'Итоги обновлены.' : 'Totals updated.') : feedback.status === 'delayed' ? (ru ? 'Публикация итогов пока не подтверждена.' : 'Totals publication is not yet confirmed.') : '') : ''].filter(Boolean).join(' ')}</p>
    <p role="alert">{savedN === 0 ? summary : ''}</p>
  </div>
}
