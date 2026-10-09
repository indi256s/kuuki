'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardPaste, PencilLine, Upload } from 'lucide-react'
import type { Flight } from '@kuuki/client/flights'
import { getFlight } from '@kuuki/client/flights'
import type { DerivedAck } from '@kuuki/client/derivedState'
import { getAuthGeneration } from '@kuuki/client/apiClient'
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

type CanonicalReads = { key: string; rows: Flight[]; pending: number[]; failed: number[] }
type Publication = 'idle' | 'ready' | 'pending' | 'delayed'
export function OnboardingFlow({
  ownerId,
  locale,
  step,
  batchId,
  source,
}: {
  ownerId: string
  locale: Locale
  step: Exclude<OnboardingStep, 'name'>
  batchId: string | null
  source: 'file' | 'text' | null
}) {
  const ru = locale === 'ru'
  const router = useRouter()
  const [choice, setChoice] = useState<'file' | 'text' | 'manual' | null>(() =>
    batchId ? (source ?? 'file') : source,
  )
  const [manual, setManual] = useState<{
    flight: Flight & DerivedAck
    publication: Publication
  } | null>(null)
  const generation = getAuthGeneration()
  const [receipt, setReceipt] = useState<{
    ownerId: string
    generation: number
    result: ImportResult
  } | null>(null)
  const imported =
    receipt?.ownerId === ownerId && receipt.generation === generation ? receipt.result : null
  const [reads, setReads] = useState<CanonicalReads | null>(null)
  const readStore = useRef<CanonicalReads | null>(null)
  const consumedRetry = useRef<object | null>(null)
  const [retry, setRetry] = useState<{ key: string; ids: number[] } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [baselineLoaded, setBaselineLoaded] = useState(false)
  const baseline = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (choice !== 'manual') return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    void fetchPressedCountries(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted && generation === getAuthGeneration()) {
          baseline.current = value
          setBaselineLoaded(true)
        }
      })
      .finally(release)
    return () => {
      controller.abort()
      release()
    }
  }, [choice])
  const onSaved = useCallback(
    (flight: Flight & DerivedAck, publication: Publication) => setManual({ flight, publication }),
    [],
  )
  const onResult = useCallback(
    (result: ImportResult) => {
      if (generation === getAuthGeneration()) setReceipt({ ownerId, generation, result })
    },
    [ownerId, generation],
  )
  const onBatchId = useCallback((id: string | null) => {
    setReceipt(null)
    const url = new URL(window.location.href)
    url.pathname = '/onboarding'
    url.searchParams.set('step', 'capture')
    if (id) url.searchParams.set('batch', id)
    else url.searchParams.delete('batch')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }, [])
  // Bulk manual imports already return canonical DTOs; read only missing IDs.
  const suppliedIds = new Set((imported?.flights ?? []).map((flight) => flight.id))
  const importedIds = [...new Set(imported?.flightIds ?? [])]
    .filter((id) => !suppliedIds.has(id))
    .join(',')
  const readKey = `${ownerId}:${generation}:${imported?.eventId ?? ''}`
  const currentReads = reads?.key === readKey ? reads : null
  useEffect(() => {
    if (!importedIds) return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const previous = readStore.current?.key === readKey ? readStore.current : null
    const explicitRetry = retry?.key === readKey && retry !== consumedRetry.current ? retry.ids : []
    if (explicitRetry.length) consumedRetry.current = retry
    const ids = importedIds
      .split(',')
      .map(Number)
      .filter(
        (id) =>
          !previous?.rows.some((flight) => flight.id === id) &&
          (!previous?.failed.includes(id) || explicitRetry.includes(id)),
      )
    const active = () => !controller.signal.aborted && generation === getAuthGeneration()
    const update = (change: (previous: CanonicalReads) => CanonicalReads) => {
      if (!active()) return
      const previous = readStore.current
      const next = change(
        previous?.key === readKey ? previous : { key: readKey, rows: [], pending: [], failed: [] },
      )
      readStore.current = next
      setReads(next)
    }
    void (async () => {
      await Promise.resolve()
      update((previous) => ({
        ...previous,
        pending: ids,
        failed: previous.failed.filter((id) => !ids.includes(id)),
      }))
      for (let offset = 0; offset < ids.length && active(); offset += 8) {
        await Promise.allSettled(
          ids.slice(offset, offset + 8).map(async (id) => {
            let row: Flight | null = null
            try {
              row = await getFlight(id, { signal: controller.signal })
            } catch {
              /* The saved write remains successful; details can be retried. */
            }
            update((previous) => ({
              ...previous,
              rows: row
                ? [
                    ...previous.rows.filter((flight) => flight.id !== id),
                    { ...row, user_id: ownerId },
                  ]
                : previous.rows,
              pending: previous.pending.filter((pendingId) => pendingId !== id),
              failed: row ? previous.failed : [...previous.failed, id],
            }))
          }),
        )
      }
    })().finally(release)
    return () => {
      controller.abort()
      release()
    }
  }, [importedIds, readKey, ownerId, generation, retry])
  useEffect(() => {
    if (!manual || manual.publication !== 'ready') return
    const flight = manual.flight
    if (flight.is_upcoming) {
      queueMicrotask(() => setCodes([]))
      return
    }
    if (!baseline.current) return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    void fetchPressedCountries(controller.signal)
      .then((after) => {
        if (!controller.signal.aborted && generation === getAuthGeneration() && after)
          setCodes(
            newlyPressed(
              baseline.current!,
              after,
              routeCountries(flight.origin, flight.destination),
            ),
          )
      })
      .finally(release)
    return () => {
      controller.abort()
      release()
    }
  }, [manual])
  const flights = manual
    ? [manual.flight]
    : [
        ...new Map(
          [
            ...(imported?.flights ?? []),
            ...(currentReads?.rows.filter((flight) => imported?.flightIds.includes(flight.id)) ??
              []),
          ].map((flight) => [flight.id, flight]),
        ).values(),
      ]
  const detailsLoading =
    !!importedIds &&
    (!currentReads ||
      currentReads.pending.length > 0 ||
      importedIds
        .split(',')
        .map(Number)
        .some(
          (id) =>
            !currentReads.rows.some((flight) => flight.id === id) &&
            !currentReads.failed.includes(id),
        ))
  const detailsIncomplete = !!imported && flights.length < imported.savedCount
  const publication = manual?.publication ?? imported?.publication
  const futureOnly =
    flights.length > 0 &&
    flights.length === (manual ? 1 : imported?.savedCount) &&
    flights.every((flight) => flight.is_upcoming)
  const newCodes = futureOnly ? [] : manual ? codes : (imported?.newCodes ?? null)
  const savedCount = manual ? 1 : imported?.savedCount
  const eventId = manual ? `onboarding:${ownerId}:flight:${manual.flight.id}` : imported?.eventId
  const result = !!manual || !!imported
  const continueToReveal = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('step', 'reveal')
    router.push(`${url.pathname}${url.search}`)
  }
  return (
    <>
      <div hidden={step === 'reveal'}>
        <h1>{ru ? 'Добавьте первый перелёт' : 'Add your first flight'}</h1>
        {!choice && (
          <div className="onboarding-choices">
            {(
              [
                [
                  'file',
                  Upload,
                  ru ? 'Загрузить посадочные или PDF' : 'Upload boarding passes or PDFs',
                ],
                [
                  'text',
                  ClipboardPaste,
                  ru ? 'Вставить текст из письма' : 'Paste text from an email',
                ],
                ['manual', PencilLine, ru ? 'Ввести вручную' : 'Enter manually'],
              ] as const
            ).map(([value, Icon, label]) => (
              <Button
                key={value}
                variant="secondary"
                className="onboarding-choice"
                static
                onClick={() => setChoice(value)}
              >
                <span className="onboarding-choice-row">
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </span>
              </Button>
            ))}
          </div>
        )}
        {choice === 'manual' &&
          (baselineLoaded ? (
            <FlightForm
              ownerId={ownerId}
              locale={locale}
              onSaved={onSaved}
              onOpenJournal={continueToReveal}
            />
          ) : (
            <p role="status">{ru ? 'Готовим журнал…' : 'Preparing your journal…'}</p>
          ))}
        {(choice === 'file' || choice === 'text') && (
          <ImportClient
            ownerId={ownerId}
            locale={locale}
            initialBatchId={batchId}
            initialSource={choice}
            onBatchId={onBatchId}
            onResult={onResult}
          />
        )}
        {result && (
          <Button onClick={continueToReveal}>
            {ru ? 'Посмотреть результат' : 'See your result'}
          </Button>
        )}
        <p>
          <Link href="/overview" className="onboarding-skip">
            {ru ? 'Сделаю позже' : 'Do this later'}
          </Link>
        </p>
      </div>
      {step === 'reveal' && (
        <section className="onboarding-reveal">
          <h1>
            {futureOnly
              ? ru
                ? 'Ваш перелёт запланирован'
                : 'Your flight is booked'
              : ru
                ? 'Ваш журнал открыт'
                : 'Your journal is open'}
          </h1>
          <p>
            {savedCount
              ? ru
                ? `Сохранено перелётов: ${savedCount}.`
                : `Flights saved: ${savedCount}.`
              : ru
                ? 'Сохранённые перелёты уже в вашем журнале.'
                : 'Your saved flights are in your journal.'}
          </p>
          {detailsLoading && (
            <p role="status">
              {ru ? 'Загружаем сведения о сохранённых перелётах…' : 'Loading saved flight details…'}
            </p>
          )}
          {!detailsLoading && detailsIncomplete && (
            <p role="alert">
              {ru
                ? 'Не удалось загрузить часть сведений о перелётах. Перелёты сохранены.'
                : 'Some flight details could not be loaded. Your flights are saved.'}
            </p>
          )}
          {!detailsLoading && !!currentReads?.failed.length && (
            <Button
              variant="secondary"
              onClick={() => setRetry({ key: readKey, ids: currentReads.failed })}
            >
              {ru ? 'Повторить загрузку сведений' : 'Retry flight details'}
            </Button>
          )}
          {publication && publication !== 'ready' && (
            <p role="status">
              {ru
                ? 'Перелёт сохранён. Итоги ещё обновляются; отметки появятся после публикации.'
                : 'Your flight is saved. Totals are still updating; stamps appear after publication.'}
            </p>
          )}
          {flights.slice(0, 8).map((flight) => (
            <Ticket
              key={flight.id}
              locale={locale}
              state={
                flight.is_upcoming
                  ? 'upcoming'
                  : 'lifecycle_state' in flight && flight.lifecycle_state === 'awaiting'
                    ? 'awaiting'
                    : 'logged'
              }
              origin={{
                iata: flight.origin,
                city: findAirport(flight.origin)?.city ?? flight.origin,
              }}
              destination={{
                iata: flight.destination,
                city: findAirport(flight.destination)?.city ?? flight.destination,
              }}
              date={flight.date}
              flightNumber={flight.flight_number ?? undefined}
              airline={flight.airline_iata ?? undefined}
              distanceKm={flight.distance_km ?? undefined}
            />
          ))}
          {publication === 'ready' && newCodes !== null && newCodes.length === 0 && (
            <p>
              {ru
                ? 'Новых отметок стран пока нет. Перелёт сохранён.'
                : 'No new country stamps this time. Your flight is saved.'}
            </p>
          )}
          {publication === 'ready' && newCodes === null && (
            <p>
              {ru
                ? 'Итоги обновлены. Откройте Паспорт, чтобы увидеть свои места.'
                : 'Totals updated. Open Passport to see your places.'}
            </p>
          )}
          {publication === 'ready' && newCodes !== null && newCodes.length > 0 && (
            <p>
              {formatCount(locale, newCodes.length, {
                en: {
                  one: '{count} new country or territory',
                  other: '{count} new countries and territories',
                },
                ru: {
                  one: '{count} новая страна или территория',
                  few: '{count} новые страны и территории',
                  many: '{count} новых стран и территорий',
                  other: '{count} новой страны или территории',
                },
              })}{' '}
              · <Link href="/passport">{ru ? 'Открыть Паспорт' : 'Open Passport'}</Link>
            </p>
          )}
          {publication === 'ready' && eventId && (
            <div className="onboarding-stamps">
              {(newCodes ?? []).slice(0, 8).map((code, index) => {
                const country = catalogCountry(code)
                return (
                  <div
                    key={code}
                    style={{ '--onboarding-stamp-delay': `${index * 80}ms` } as CSSProperties}
                  >
                    <Stamp
                      countryCode={code}
                      nativeName={country?.nativeName ?? code}
                      name={new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code}
                      kind="air"
                      locale={locale}
                      pressEventId={`${eventId}:${code}`}
                    />
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/overview" className="ui-button" data-variant="primary">
            {ru ? 'Перейти к обзору' : 'Go to Overview'}
          </Link>
        </section>
      )}
    </>
  )
}
