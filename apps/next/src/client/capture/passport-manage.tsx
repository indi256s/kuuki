'use client'

import { CircleAlert, TriangleAlert } from '@keyline-icons/react'
import { useLocale } from '../preferences'

import { useEffect, useRef, useState } from 'react'
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { Button } from '../ui/button'
import { Combobox } from '../ui/combobox'
import { aircraftChoices } from './reference-choices'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { getAllFlights, type Flight } from '@kuuki/client/flights'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import {
  acceptAircraft,
  AIRCRAFT_BATCH,
  countAircraftRun,
  retryableAircraft,
  type AircraftOutcome,
  type AircraftRunCounts,
} from '../import/aircraft-review'
import { AIRCRAFT_RESULT as S } from '../import/aircraft-result-copy'
import { acceptAircraftBatch } from '../import/import-api'
import { AircraftAnnouncement } from '../import/aircraft-announcement'
import { formatDateOnly } from '../../lib/format'
import type { Locale } from '../../server/locale'
import './capture.css'
import './passport-manage.css'

export function PassportManage({
  ownerId,
  locale: initialLocale,
}: {
  ownerId: string
  locale: Locale
}) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru',
    feedback = useWriteFeedback(ownerId)
  const [flights, setFlights] = useState<Flight[]>([])
  const [flightStatus, setFlightStatus] = useState<'unloaded' | 'loading' | 'ready' | 'error'>(
    'unloaded',
  )
  const [selected, setSelected] = useState<number[]>([])
  const [plane, setPlane] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const message = savedNotice
    ? ru
      ? 'Сохранено. Итоги могут обновиться позже.'
      : 'Saved. Totals may update later.'
    : ''
  const [outcomes, setOutcomes] = useState<Map<number, AircraftOutcome>>(new Map())
  // Counts for the submission that just finished only; cleared when the next one starts so every completion is announced.
  const [last, setLast] = useState<AircraftRunCounts | null>(null)
  // Flights seen so far and the type sent for each, so a saved row keeps its label after the reload and a retry resends the same type.
  const [seen, setSeen] = useState(() => new Map<number, Flight>())
  const [sent, setSent] = useState(() => new Map<number, string>())
  const flightRequest = useRef<{ controller: AbortController; release: () => void } | null>(null)
  const current = (controller: AbortController, generation: number) =>
    !controller.signal.aborted && generation === getAuthGeneration()
  function loadFlights(quiet = false) {
    flightRequest.current?.controller.abort()
    flightRequest.current?.release()
    const controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    flightRequest.current = { controller, release }
    if (!quiet) setFlightStatus('loading')
    void getAllFlights({ signal: controller.signal })
      .then((rows) => {
        if (current(controller, generation)) {
          setSeen((old) => {
            const next = new Map(old)
            for (const row of rows) next.set(row.id, row)
            return next
          })
          setFlights(rows)
          setFlightStatus('ready')
        }
      })
      .catch(() => {
        if (current(controller, generation)) setFlightStatus('error')
      })
      .finally(() => {
        release()
        if (flightRequest.current?.controller === controller) flightRequest.current = null
      })
  }
  useEffect(
    () => () => {
      flightRequest.current?.controller.abort()
      flightRequest.current?.release()
      flightRequest.current = null
    },
    [ownerId],
  )
  async function accept(items: Array<{ id: number; aircraft_icao: string }>) {
    if (items.length === 0) return
    const controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    setBusy(true)
    setSavedNotice(false)
    setLast(null)
    setSent((old) => {
      const next = new Map(old)
      for (const item of items) next.set(item.id, item.aircraft_icao)
      return next
    })
    try {
      const run = await acceptAircraft(items, acceptAircraftBatch)
      if (!current(controller, generation)) return
      setOutcomes((old) => {
        const next = new Map(old)
        for (const [id, outcome] of run.rows) next.set(id, outcome)
        return next
      })
      setLast(countAircraftRun(run.rows.values()))
      // Anything not saved stays selected, so one press retries exactly those.
      setSelected(items.map((item) => item.id).filter((id) => run.rows.get(id)?.status !== 'saved'))
      const ack = run.acks.filter((item) => item.derived_state).at(-1)
      if ([...run.rows.values()].some((outcome) => outcome.status === 'saved') && ack) {
        feedback.acknowledge(ack)
        setSavedNotice(true)
      }
      // Saved rows leave the eligible set; an uncertain row may or may not have, so the list is read again after every outcome.
      loadFlights(true)
    } finally {
      if (current(controller, generation)) setBusy(false)
      release()
    }
  }
  const validPlane = !!findAircraft(plane)
  const eligible = flights.filter((row) => !row.aircraft_icao)
  const chosen = selected.filter((id) => eligible.some((row) => row.id === id))
  const retryIds = retryableAircraft({ rows: outcomes, acks: [], uncertain: false })
  const label = (id: number) => {
    const row = seen.get(id)
    return row
      ? `${formatDateOnly(locale, row.date, 'medium')} · ${row.origin} → ${row.destination} · ${row.flight_number ?? '—'}`
      : String(id)
  }
  const tag = (outcome: AircraftOutcome, id: number) => {
    if (outcome.status === 'saved')
      return (
        <>
          <span>{S.aircraftSavedTag[locale]}</span> · <span>{sent.get(id) ?? outcome.icao}</span>
        </>
      )
    if (outcome.status === 'uncertain')
      return (
        <>
          <span>{S.aircraftUncertainTag[locale]}</span>
          <p>{S.aircraftUncertainNote[locale]}</p>
        </>
      )
    if (outcome.status === 'failed')
      return (
        <span>
          {S.aircraftFailedTag[locale]}
          {outcome.code ? ` · ${outcome.code}` : ''}
        </span>
      )
    return null
  }
  const reported = [...outcomes].filter(([, outcome]) => outcome.status !== 'unsent')
  return (
    <div className="capture-manage">
      <section className="capture-card">
        <p>
          {ru
            ? 'Выберите до 20 своих перелётов без самолёта и назначьте тип.'
            : 'Select up to 20 of your flights without aircraft and assign a type.'}
        </p>
        {flightStatus === 'unloaded' && (
          <Button onClick={() => loadFlights()}>
            {ru ? 'Загрузить перелёты' : 'Load flights'}
          </Button>
        )}
        {flightStatus === 'loading' && (
          <p role="status">{ru ? 'Загружаем перелёты…' : 'Loading flights…'}</p>
        )}
        {flightStatus === 'error' && (
          <p role="alert">
            {ru ? 'Не удалось загрузить перелёты.' : 'Could not load flights.'}{' '}
            <Button dense onClick={() => loadFlights()}>
              {ru ? 'Повторить' : 'Retry'}
            </Button>
          </p>
        )}
        {flightStatus === 'ready' && (
          <>
            <fieldset disabled={busy}>
              <legend>{ru ? 'Перелёты' : 'Flights'}</legend>
              {eligible.length === 0 ? (
                <p>{ru ? 'Нет перелётов для обновления.' : 'No flights to update.'}</p>
              ) : (
                eligible.map((row) => (
                  <label key={row.id}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(row.id)}
                      disabled={!chosen.includes(row.id) && chosen.length >= AIRCRAFT_BATCH}
                      onChange={(event) =>
                        setSelected((old) =>
                          event.target.checked
                            ? [...old, row.id]
                            : old.filter((id) => id !== row.id),
                        )
                      }
                    />
                    {label(row.id)}
                  </label>
                ))
              )}
            </fieldset>
            <Combobox
              label={ru ? 'Тип самолёта' : 'Aircraft type'}
              value={plane}
              onChange={setPlane}
              choices={aircraftChoices}
              locale={locale}
              disabled={busy}
              error={
                plane && !validPlane
                  ? ru
                    ? 'Выберите самолёт из списка.'
                    : 'Choose an aircraft from the list.'
                  : undefined
              }
            />
            <Button
              variant="primary"
              disabled={busy || !validPlane || chosen.length === 0}
              onClick={() => void accept(chosen.map((id) => ({ id, aircraft_icao: plane })))}
            >
              {ru ? 'Применить к выбранным' : 'Apply to selected'}
            </Button>
          </>
        )}
        {reported.length > 0 && (
          <>
            <ul className="capture-outcomes" aria-label={ru ? 'Результат' : 'Result'}>
              {reported.map(([id, outcome]) => (
                <li key={id} data-state={outcome.status}>
                  {outcome.status === 'uncertain' ? (
                    <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
                  ) : outcome.status === 'failed' ? (
                    <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
                  ) : null}
                  <span>
                    {label(id)} — {tag(outcome, id)}
                  </span>
                </li>
              ))}
            </ul>
            {retryIds.length > 0 && (
              <Button
                disabled={busy}
                onClick={() =>
                  void accept(
                    retryIds.flatMap((id) => {
                      const icao = sent.get(id)
                      return icao ? [{ id, aircraft_icao: icao }] : []
                    }),
                  )
                }
              >
                {S.aircraftRetry[locale]}
              </Button>
            )}
          </>
        )}
      </section>
      <AircraftAnnouncement
        locale={locale}
        counts={last}
        status={[
          message,
          message
            ? feedback.status === 'ready'
              ? ru
                ? 'Итоги обновлены.'
                : 'Totals updated.'
              : feedback.status === 'delayed'
                ? ru
                  ? 'Публикация итогов пока не подтверждена.'
                  : 'Totals publication is not yet confirmed.'
                : ''
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    </div>
  )
}
