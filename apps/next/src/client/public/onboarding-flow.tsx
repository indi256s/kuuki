'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Flight } from '../../../../web/src/lib/flights'
import { getFlight } from '../../../../web/src/lib/flights'
import type { DerivedAck } from '../../../../web/src/lib/derivedState'
import { getAuthGeneration } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import { FlightForm } from '../capture/flight-form'
import { ImportClient, type ImportResult } from '../import/import-client'
import { fetchPressedCountries } from '../import/import-api'
import { newlyPressed, routeCountries } from '../import/flight-input'
import { Ticket } from '../signature/ticket'
import { Stamp } from '../signature/stamp'
import { Button } from '../ui/button'
import { findAirport } from '@kuuki/data/airport-lookup'
import { catalogCountry } from '../passport/model'
import { formatCount, type Locale } from '../../lib/format'
import type { OnboardingStep } from '../../lib/url-state'
import './onboarding.css'

type Publication = 'idle' | 'ready' | 'pending' | 'delayed'
export function OnboardingFlow({ ownerId, locale, step, batchId, source }: { ownerId: string; locale: Locale; step: Exclude<OnboardingStep, 'name'>; batchId: string | null; source: 'file' | 'text' | null }) {
  const ru = locale === 'ru'; const router = useRouter()
  const [choice, setChoice] = useState<'file' | 'text' | 'manual' | null>(() => batchId ? source ?? 'file' : source)
  const [manual, setManual] = useState<{ flight: Flight & DerivedAck; publication: Publication } | null>(null)
  const [imported, setImported] = useState<ImportResult | null>(null)
  const [importFlights, setImportFlights] = useState<Flight[]>([])
  const [codes, setCodes] = useState<string[] | null>(null)
  const [baselineLoaded, setBaselineLoaded] = useState(false)
  const baseline = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (choice !== 'manual') return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    void fetchPressedCountries(controller.signal).then(value => { if (!controller.signal.aborted && generation === getAuthGeneration()) { baseline.current = value; setBaselineLoaded(true) } }).finally(release)
    return () => { controller.abort(); release() }
  }, [choice])
  const onSaved = useCallback((flight: Flight & DerivedAck, publication: Publication) => setManual({ flight, publication }), [])
  const onResult = useCallback((result: ImportResult) => setImported(result), [])
  const onBatchId = useCallback((id: string | null) => {
    setImported(null); setImportFlights([])
    const url = new URL(window.location.href); url.pathname = '/onboarding'; url.searchParams.set('step', 'capture')
    if (id) url.searchParams.set('batch', id); else url.searchParams.delete('batch')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }, [])
  const importedIds = imported?.flightIds.join(',') ?? ''
  useEffect(() => {
    if (!importedIds) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    void (async () => {
      const ids = [...new Set(importedIds.split(',').map(Number))]
      const rows: Array<Flight | null> = []
      for (let offset = 0; offset < ids.length && !controller.signal.aborted; offset += 8) rows.push(...await Promise.all(ids.slice(offset, offset + 8).map(id => getFlight(id, { signal: controller.signal }))))
      return rows
    })().then(rows => {
      if (!controller.signal.aborted && generation === getAuthGeneration()) setImportFlights(rows.filter((row): row is Flight => !!row).map(row => ({ ...row, user_id: ownerId })))
    }).catch(() => {}).finally(release)
    return () => { controller.abort(); release() }
  }, [importedIds, ownerId])
  useEffect(() => {
    if (!manual || manual.publication !== 'ready') return
    const flight = manual.flight
    if (flight.is_upcoming) { queueMicrotask(() => setCodes([])); return }
    if (!baseline.current) return
    const controller = new AbortController(); const release = trackPrivateOperation(controller); const generation = getAuthGeneration()
    void fetchPressedCountries(controller.signal).then(after => { if (!controller.signal.aborted && generation === getAuthGeneration() && after) setCodes(newlyPressed(baseline.current!, after, routeCountries(flight.origin, flight.destination))) }).finally(release)
    return () => { controller.abort(); release() }
  }, [manual])
  const flights = manual ? [manual.flight] : [...new Map([...(imported?.flights ?? []), ...importFlights].map(flight => [flight.id, flight])).values()]
  const publication = manual?.publication ?? imported?.publication
  const futureOnly = flights.length > 0 && flights.length === (manual ? 1 : imported?.savedCount) && flights.every(flight => flight.is_upcoming)
  const newCodes = futureOnly ? [] : manual ? codes : imported?.newCodes ?? null
  const savedCount = manual ? 1 : imported?.savedCount
  const eventId = manual ? `onboarding:${ownerId}:flight:${manual.flight.id}` : imported?.eventId
  const result = !!manual || !!imported
  const continueToReveal = () => { const url = new URL(window.location.href); url.searchParams.set('step', 'reveal'); router.push(`${url.pathname}${url.search}`) }
  return <>
    <div hidden={step === 'reveal'}>
      <h1>{ru ? 'Добавьте первый перелёт' : 'Add your first flight'}</h1>
      {!choice && <div className="onboarding-choices">{([
        ['file', ru ? 'Загрузить посадочные или PDF' : 'Upload boarding passes or PDFs'],
        ['text', ru ? 'Вставить текст из письма' : 'Paste text from an email'],
        ['manual', ru ? 'Ввести вручную' : 'Enter manually'],
      ] as const).map(([value, label]) => <Button key={value} variant="secondary" onClick={() => setChoice(value)}>{label}</Button>)}</div>}
      {choice === 'manual' && (baselineLoaded ? <FlightForm ownerId={ownerId} locale={locale} onSaved={onSaved} onOpenJournal={continueToReveal} /> : <p role="status">{ru ? 'Готовим журнал…' : 'Preparing your journal…'}</p>)}
      {(choice === 'file' || choice === 'text') && <ImportClient ownerId={ownerId} locale={locale} initialBatchId={batchId} initialSource={choice} onBatchId={onBatchId} onResult={onResult} />}
      {result && <Button onClick={continueToReveal}>{ru ? 'Посмотреть результат' : 'See your result'}</Button>}
      <p><Link href="/overview" className="onboarding-skip">{ru ? 'Сделаю позже' : 'Do this later'}</Link></p>
    </div>
    {step === 'reveal' && <section className="onboarding-reveal">
      <h1>{flights.length > 0 && flights.every(flight => flight.is_upcoming) ? ru ? 'Ваш перелёт запланирован' : 'Your flight is booked' : ru ? 'Ваш журнал открыт' : 'Your journal is open'}</h1>
      <p>{savedCount ? ru ? `Сохранено перелётов: ${savedCount}.` : `Flights saved: ${savedCount}.` : ru ? 'Сохранённые перелёты уже в вашем журнале.' : 'Your saved flights are in your journal.'}</p>
      {publication && publication !== 'ready' && <p role="status">{ru ? 'Перелёт сохранён. Итоги ещё обновляются; отметки появятся после публикации.' : 'Your flight is saved. Totals are still updating; stamps appear after publication.'}</p>}
      {flights.slice(0, 8).map(flight => <Ticket key={flight.id} locale={locale} state={flight.is_upcoming ? 'upcoming' : 'lifecycle_state' in flight && flight.lifecycle_state === 'awaiting' ? 'awaiting' : 'logged'} origin={{ iata: flight.origin, city: findAirport(flight.origin)?.city ?? flight.origin }} destination={{ iata: flight.destination, city: findAirport(flight.destination)?.city ?? flight.destination }} date={flight.date} flightNumber={flight.flight_number ?? undefined} airline={flight.airline_iata ?? undefined} distanceKm={flight.distance_km ?? undefined} />)}
      {publication === 'ready' && newCodes !== null && newCodes.length === 0 && <p>{ru ? 'Новых отметок стран пока нет. Перелёт сохранён.' : 'No new country stamps this time. Your flight is saved.'}</p>}
      {publication === 'ready' && newCodes === null && <p>{ru ? 'Итоги обновлены. Откройте Паспорт, чтобы увидеть свои места.' : 'Totals updated. Open Passport to see your places.'}</p>}
      {publication === 'ready' && newCodes !== null && newCodes.length > 0 && <p>{formatCount(locale, newCodes.length, { en: { one: '{count} new country or territory', other: '{count} new countries and territories' }, ru: { one: '{count} новая страна или территория', few: '{count} новые страны и территории', many: '{count} новых стран и территорий', other: '{count} новой страны или территории' } })} · <Link href="/passport">{ru ? 'Открыть Паспорт' : 'Open Passport'}</Link></p>}
      {publication === 'ready' && eventId && <div className="onboarding-stamps">{(newCodes ?? []).slice(0, 8).map(code => { const country = catalogCountry(code); return <Stamp key={code} countryCode={code} nativeName={country?.nativeName ?? code} name={new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code} kind="air" locale={locale} pressEventId={`${eventId}:${code}`} /> })}</div>}
      <Link href="/overview" className="button primary">{ru ? 'Перейти к обзору' : 'Go to Overview'}</Link>
    </section>}
  </>
}
