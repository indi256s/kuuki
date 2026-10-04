'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import countries from '@kuuki/data/countries.json'
import aircraft from '@kuuki/data/aircraft'
import { api, getAuthGeneration } from '../../../../web/src/lib/apiClient'
import { addGroundVisit, claimCountry, deleteGroundVisit, unclaimCountry } from '../../../../web/src/lib/passport'
import { getAllFlights, type Flight } from '../../../../web/src/lib/flights'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import type { Locale } from '../../server/locale'
import './capture.css'

type CountryData = { claims: { country_code: string }[] }
type GroundVisit = { id: string; countryCode: string; visitYear: number | null; entryMethod: string | null; note: string | null }
type BatchResult = { results: ({ id: number; status: 'accepted' } | { id: number; status: 'error'; error: string })[]; derived_state?: 'ready' | 'pending'; revision?: number }

export function PassportManage({ ownerId, locale, initialCountry = '' }: { ownerId: string; locale: Locale; initialCountry?: string }) {
  const ru = locale === 'ru', router = useRouter(), feedback = useWriteFeedback(ownerId)
  const [data, setData] = useState<CountryData | null>(null)
  const [visits, setVisits] = useState<GroundVisit[]>([])
  const [countryStatus, setCountryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [flights, setFlights] = useState<Flight[]>([])
  const [flightStatus, setFlightStatus] = useState<'unloaded' | 'loading' | 'ready' | 'error'>('unloaded')
  const [selected, setSelected] = useState<number[]>([])
  const [country, setCountry] = useState(initialCountry)
  const [year, setYear] = useState('')
  const [entry, setEntry] = useState<'' | 'land' | 'sea'>('')
  const [note, setNote] = useState('')
  const [plane, setPlane] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const confirmTrigger = useRef<HTMLButtonElement | null>(null)
  const [confirm, setConfirm] = useState<null | { kind: 'claim' | 'ground'; id: string }>(null)
  const countryRequest = useRef<{ controller: AbortController; release: () => void } | null>(null)
  const flightRequest = useRef<{ controller: AbortController; release: () => void } | null>(null)
  const current = (controller: AbortController, generation: number) => !controller.signal.aborted && generation === getAuthGeneration()
  function refreshCountries() {
    countryRequest.current?.controller.abort(); countryRequest.current?.release()
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration()
    countryRequest.current = { controller, release }
    setCountryStatus('loading')
    void Promise.all([
      api.get<CountryData>('/api/passport/countries', undefined, { signal: controller.signal }),
      api.get<GroundVisit[]>('/api/passport/ground-visits', undefined, { signal: controller.signal }),
    ]).then(([nextData, nextVisits]) => {
      if (current(controller, generation)) { setData(nextData); setVisits(nextVisits); setCountryStatus('ready') }
    }).catch(() => { if (current(controller, generation)) setCountryStatus('error') }).finally(() => {
      release(); if (countryRequest.current?.controller === controller) countryRequest.current = null
    })
  }
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
  useEffect(() => {
    refreshCountries()
    return () => {
      countryRequest.current?.controller.abort(); countryRequest.current?.release(); countryRequest.current = null
      flightRequest.current?.controller.abort(); flightRequest.current?.release(); flightRequest.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        refreshCountries(); router.refresh()
      }
      if (failures.length) setError(failures.map(item => `${item.id}: ${item.status === 'error' ? item.error : ''}`).join('; '))
      return ack.results ?? []
    } catch (cause) { if (current(controller, generation)) setError(cause instanceof Error ? cause.message : String(cause)); return null }
    finally { if (current(controller, generation)) setBusy(false); release() }
  }
  async function addVisit() {
    const chosen = country
    const result = await mutate(() => addGroundVisit(ownerId, chosen, { visitYear: year ? Number(year) : null, entryMethod: entry || null, note: note || null }))
    if (result && chosen === country) { setYear(''); setEntry(''); setNote('') }
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
  const countryOptions = useMemo(() => {
    const regions = new Intl.DisplayNames([locale], { type: 'region' })
    return Object.entries(countries).sort((a,b) => a[1].name.localeCompare(b[1].name)).map(([code, item]) => <option key={code} value={code}>{regions.of(code) ?? item.name}</option>)
  }, [locale])
  const claimed = data?.claims.some(item => item.country_code === country)
  const countryVisits = visits.filter(item => item.countryCode === country)
  const eligible = flights.filter(row => !row.aircraft_icao)
  return <div className="capture-manage">
    <section className="capture-card"><h2>{ru ? 'Страны' : 'Countries'}</h2><label>{ru ? 'Страна' : 'Country'}<select value={country} disabled={busy} onChange={event => setCountry(event.target.value)}><option value="">{ru ? 'Выберите страну' : 'Select country'}</option>{countryOptions}</select></label>
      {countryStatus === 'loading' && <p role="status">{ru ? 'Загружаем страны…' : 'Loading countries…'}</p>}
      {countryStatus === 'error' && <p role="alert">{ru ? 'Не удалось загрузить страны.' : 'Could not load countries.'} <button type="button" onClick={refreshCountries}>{ru ? 'Повторить' : 'Retry'}</button></p>}
      {country && countryStatus === 'ready' && <><p>{claimed ? (ru ? 'Отмечена в паспорте' : 'Claimed in passport') : (ru ? 'Пока не отмечена' : 'Not claimed')}</p><div className="read-actions">{!claimed && <button className="button primary" disabled={busy} onClick={() => void mutate(() => claimCountry(ownerId, country))}>{ru ? 'Отметить страну' : 'Claim country'}</button>}{claimed && <button className="button secondary" disabled={busy} onClick={event => { confirmTrigger.current = event.currentTarget; setConfirm({ kind: 'claim', id: country }) }}>{ru ? 'Удалить отметку и наземные посещения' : 'Remove claim and ground visits'}</button>}</div><form onSubmit={event => { event.preventDefault(); void addVisit() }}><h3>{ru ? 'Добавить наземное посещение' : 'Add land or sea visit'}</h3><label>{ru ? 'Год (необязательно)' : 'Year (optional)'}<input disabled={busy} type="number" min="1800" max="2200" value={year} onChange={event => setYear(event.target.value)} /></label><label>{ru ? 'Способ' : 'Entry method'}<select disabled={busy} value={entry} onChange={event => setEntry(event.target.value as typeof entry)}><option value="">{ru ? 'Не указан' : 'Unspecified'}</option><option value="land">{ru ? 'По земле' : 'Land'}</option><option value="sea">{ru ? 'По морю' : 'Sea'}</option></select></label><label>{ru ? 'Заметка' : 'Note'}<input disabled={busy} value={note} onChange={event => setNote(event.target.value)} maxLength={200} /></label><button className="button primary" disabled={busy} type="submit">{ru ? 'Добавить посещение' : 'Add visit'}</button></form>{countryVisits.length > 0 && <ul>{countryVisits.map(visit => <li key={visit.id}>{visit.visitYear ?? '—'} · {visit.entryMethod ?? '—'}{visit.note && <> · {visit.note}</>} <button type="button" disabled={busy} onClick={event => { confirmTrigger.current = event.currentTarget; setConfirm({ kind: 'ground', id: visit.id }) }}>{ru ? 'Удалить' : 'Delete'}</button></li>)}</ul>}</>}
    </section>
    <section className="capture-card"><h2>{ru ? 'Самолёты в журнале' : 'Aircraft in journal'}</h2><p>{ru ? 'Выберите до 20 своих перелётов без самолёта и назначьте тип.' : 'Select up to 20 of your flights without aircraft and assign a type.'}</p>
      {flightStatus === 'unloaded' && <button className="button secondary" onClick={loadFlights}>{ru ? 'Загрузить перелёты' : 'Load flights'}</button>}
      {flightStatus === 'loading' && <p role="status">{ru ? 'Загружаем перелёты…' : 'Loading flights…'}</p>}
      {flightStatus === 'error' && <p role="alert">{ru ? 'Не удалось загрузить перелёты.' : 'Could not load flights.'} <button type="button" onClick={loadFlights}>{ru ? 'Повторить' : 'Retry'}</button></p>}
      {flightStatus === 'ready' && <><fieldset disabled={busy}><legend>{ru ? 'Перелёты' : 'Flights'}</legend>{eligible.length === 0 ? <p>{ru ? 'Нет перелётов для обновления.' : 'No flights to update.'}</p> : eligible.map(row => <label key={row.id}><input type="checkbox" checked={selected.includes(row.id)} disabled={!selected.includes(row.id) && selected.length >= 20} onChange={event => setSelected(old => event.target.checked ? [...old, row.id] : old.filter(id => id !== row.id))} />{row.date} · {row.origin} → {row.destination} · {row.flight_number ?? '—'}</label>)}</fieldset><label>{ru ? 'Тип самолёта' : 'Aircraft type'}<select value={plane} disabled={busy} onChange={event => setPlane(event.target.value)}><option value="">{ru ? 'Выберите тип' : 'Select type'}</option>{aircraft.map(item => <option key={item.icao} value={item.icao}>{item.icao} · {item.name}</option>)}</select></label><button className="button primary" disabled={busy || !plane || selected.length === 0} onClick={() => void applyAircraft()}>{ru ? 'Применить к выбранным' : 'Apply to selected'}</button></>}
    </section>
    {message && <p role="status">{message} {feedback.status === 'ready' ? (ru ? 'Итоги обновлены.' : 'Totals updated.') : feedback.status === 'delayed' ? (ru ? 'Публикация итогов пока не подтверждена.' : 'Totals publication is not yet confirmed.') : ''}</p>}{error && <p role="alert">{error}</p>}
    <Dialog.Root open={!!confirm} onOpenChange={open => { if (!open) setConfirm(null) }}><Dialog.Portal><Dialog.Overlay className="capture-confirm-overlay" /><Dialog.Content className="capture-confirm" onCloseAutoFocus={event => { if (confirmTrigger.current?.isConnected) { event.preventDefault(); confirmTrigger.current.focus() } }}><Dialog.Title>{ru ? 'Подтвердить удаление' : 'Confirm deletion'}</Dialog.Title><Dialog.Description>{confirm?.kind === 'claim' ? (ru ? 'Удалить отметку и все наземные посещения этой страны?' : 'Remove this claim and all its ground visits?') : (ru ? 'Удалить это посещение?' : 'Delete this visit?')}</Dialog.Description><button type="button" onClick={() => setConfirm(null)}>{ru ? 'Отмена' : 'Cancel'}</button><button type="button" disabled={busy} onClick={() => { const chosen = confirm; setConfirm(null); if (chosen) void mutate(() => chosen.kind === 'claim' ? unclaimCountry(ownerId, chosen.id) : deleteGroundVisit(ownerId, chosen.id)) }}>{ru ? 'Удалить' : 'Delete'}</button></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>
}
