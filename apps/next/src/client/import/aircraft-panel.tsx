'use client'

import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { useEffect, useMemo, useState } from 'react'
import { formatDateOnly, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import {
  acceptAircraft,
  AIRCRAFT_BATCH,
  countAircraftRun,
  diagnose,
  retryableAircraft,
  summarizeAircraftRun,
  toggleAll,
  type AircraftAccept,
  type AircraftRunCounts,
  type AircraftRun,
  type AircraftTarget,
  type EnrichResult,
  type Suggested,
  type Unidentified,
} from './aircraft-review'
import { FAILURE, S, count } from './copy'
import { classifyRequestFailure, type Failure } from './import-errors'
import { acceptAircraftBatch, enrichAircraft, type EnrichFlight } from './import-api'
import { airlineName } from './reference'

export interface AircraftApi {
  enrich: (
    flights: EnrichFlight[],
  ) => Promise<{ results: EnrichResult[]; search_suggestions_html?: string }>
  accept: (items: Array<{ id: number; aircraft_icao: string }>) => Promise<AircraftAccept>
}
const defaultApi: AircraftApi = {
  enrich: (flights) => enrichAircraft(flights),
  accept: acceptAircraftBatch,
}

type Phase = 'idle' | 'searching' | 'results' | 'failed'

const safeSourceUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * Suggestions, then one accept per selected flight through the batch endpoint, 20 at a time and never in parallel.
 * Each flight keeps its own outcome: saved, failed, or uncertain when the answer was lost.
 */
export function AircraftPanel({
  locale,
  targets,
  onSaved,
  onWorkChange,
  api = defaultApi,
}: {
  locale: Locale
  targets: AircraftTarget[]
  /** Called after any confirmed write, including a partial one, so every freshness owner refreshes. */
  onSaved: (run: AircraftRun, unresolved: boolean) => void
  onWorkChange?: (work: { busy: boolean; dirty: boolean }) => void
  api?: AircraftApi
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<EnrichResult[]>([])
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [failure, setFailure] = useState<Failure | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [outcomes, setOutcomes] = useState<AircraftRun['rows']>(new Map())
  const [applying, setApplying] = useState(false)
  const [asked, setAsked] = useState<number[]>([])
  // Counts for the submission that just finished only; cleared when the next one starts so an identical result is announced again.
  const [last, setLast] = useState<AircraftRunCounts | null>(null)

  const view = useMemo(() => diagnose(asked, results), [asked, results])
  const byId = useMemo(() => new Map(targets.map((target) => [target.id, target])), [targets])
  const suggestedById = useMemo(
    () => new Map(view.suggested.map((item) => [item.flightId, item])),
    [view.suggested],
  )
  const open = view.suggested.filter((item) => outcomes.get(item.flightId)?.status !== 'saved')
  useEffect(() => {
    onWorkChange?.({ busy: phase === 'searching' || applying, dirty: open.length > 0 })
  }, [phase, applying, open.length, onWorkChange])
  const allSelected = open.length > 0 && open.every((item) => selected.has(item.flightId))

  const search = async () => {
    setPhase('searching')
    setFailure(null)
    setOutcomes(new Map())
    setLast(null)
    setSearchSuggestions([])
    const ids = targets.map((target) => target.id)
    const gathered: EnrichResult[] = []
    const suggestions: string[] = []
    try {
      for (let start = 0; start < targets.length; start += AIRCRAFT_BATCH) {
        const chunk = targets.slice(start, start + AIRCRAFT_BATCH)
        const answer = await api.enrich(
          chunk.map((target) => ({
            id: String(target.id),
            flight_number: target.flight_number,
            airline_iata: target.airline_iata,
            airline_name: target.airline_iata ? (airlineName(target.airline_iata) ?? null) : null,
            date: target.date,
            origin: target.origin,
            destination: target.destination,
          })),
        )
        gathered.push(...answer.results)
        if (answer.search_suggestions_html) suggestions.push(answer.search_suggestions_html)
      }
    } catch (error) {
      setFailure(classifyRequestFailure(error))
      if (gathered.length === 0) {
        setPhase('failed')
        return
      }
    }
    setAsked(ids)
    setResults(gathered)
    setSearchSuggestions(suggestions)
    // Older responses omit basis and keep their previous selection behavior.
    setSelected(
      new Set(
        diagnose(ids, gathered)
          .suggested.filter(
            (item) => item.equipmentBasis === 'actual' || item.equipmentBasis === undefined,
          )
          .map((item) => item.flightId),
      ),
    )
    setPhase('results')
  }

  const accept = async (ids: number[]) => {
    const items = ids.flatMap((id) => {
      const item = suggestedById.get(id)
      return item ? [{ id, aircraft_icao: item.icao }] : []
    })
    if (items.length === 0) return
    setApplying(true)
    setLast(null)
    const run = await acceptAircraft(items, api.accept)
    setApplying(false)
    setLast(countAircraftRun(run.rows.values()))
    setOutcomes((previous) => {
      const next = new Map(previous)
      for (const [id, outcome] of run.rows) next.set(id, outcome)
      return next
    })
    // Anything that is not saved stays selected so one press retries exactly those.
    setSelected(
      new Set([...run.rows].filter(([, outcome]) => outcome.status !== 'saved').map(([id]) => id)),
    )
    if ([...run.rows.values()].some((outcome) => outcome.status === 'saved'))
      onSaved(
        run,
        view.suggested.some(
          (item) =>
            (run.rows.get(item.flightId) ?? outcomes.get(item.flightId))?.status !== 'saved',
        ),
      )
  }

  const retryIds = retryableAircraft({ rows: outcomes, acks: [], uncertain: false })
  // Nothing saved is a problem, so it is assertive; anything saved is polite. Both regions stay mounted so a change is announced.
  const summary = summarizeAircraftRun(locale, last)

  const flightLine = (id: number) => {
    const target = byId.get(id)
    if (!target) return String(id)
    return `${target.origin} → ${target.destination} · ${formatDateOnly(locale, target.date, 'medium')}${target.flight_number ? ` · ${target.airline_iata ?? ''}${target.flight_number}` : ''}`
  }
  const tag = (id: number) => {
    const outcome = outcomes.get(id)
    if (!outcome) return null
    if (outcome.status === 'saved')
      return (
        <span className="import-chip" data-tone="success">
          {S.aircraftSavedTag[locale]}
        </span>
      )
    if (outcome.status === 'uncertain')
      return (
        <>
          <span className="import-chip" data-tone="warning">
            {S.aircraftUncertainTag[locale]}
          </span>
          <p className="import-note">{S.aircraftUncertainNote[locale]}</p>
        </>
      )
    if (outcome.status === 'failed')
      return (
        <span className="import-chip" data-tone="danger">
          {S.aircraftFailedTag[locale]}
          {outcome.code ? ` · ${outcome.code}` : ''}
        </span>
      )
    return null
  }
  const reason = (item: Unidentified) =>
    item.reason === 'none'
      ? S.aircraftReasonNone[locale]
      : item.reason === 'low'
        ? S.aircraftReasonLow[locale]
        : S.aircraftReasonMissing[locale]

  if (phase === 'idle')
    return (
      <div className="import-actions">
        <Button onClick={() => void search()} disabled={targets.length === 0}>
          {S.identify[locale]}
        </Button>
      </div>
    )
  if (phase === 'searching')
    return (
      <p className="import-hint" role="status">
        {S.aircraftSearching[locale]}
      </p>
    )
  if (phase === 'failed')
    return (
      <div className="import-failure-inline" role="alert">
        <p>
          {S.aircraftSearchFailed[locale]}{' '}
          {failure ? FAILURE[failure.kind][locale].title + '.' : ''}
        </p>
        <Button onClick={() => void search()}>{S.aircraftSearchRetry[locale]}</Button>
      </div>
    )

  const row = (item: Suggested) => {
    const outcome = outcomes.get(item.flightId)
    const done = outcome?.status === 'saved'
    const model = findAircraft(item.icao)?.model ?? item.name ?? ''
    const sources = item.sources.flatMap((source) => {
      const href = safeSourceUrl(source.url)
      return href ? [{ href, title: source.title }] : []
    })
    return (
      <li
        key={item.flightId}
        className="import-row import-aircraft-row"
        data-state={outcome?.status}
      >
        <label className="import-check">
          <input
            type="checkbox"
            checked={!done && selected.has(item.flightId)}
            disabled={done || applying}
            onChange={(event) =>
              setSelected((previous) => {
                const next = new Set(previous)
                if (event.target.checked) next.add(item.flightId)
                else next.delete(item.flightId)
                return next
              })
            }
          />
          <span>{flightLine(item.flightId)}</span>
        </label>
        <p className="import-row-meta">
          <span className="import-code">{item.icao}</span>
          <span>{model}</span>
          <span className="import-chip">
            {S.confidence[locale]} {Math.round(item.confidence * 100)}%
          </span>
        </p>
        {item.equipmentBasis ? (
          <p className="import-note">
            {
              S[
                item.equipmentBasis === 'actual'
                  ? 'aircraftActual'
                  : item.equipmentBasis === 'scheduled'
                    ? 'aircraftScheduled'
                    : 'aircraftBasisUnknown'
              ][locale]
            }
          </p>
        ) : null}
        {item.evidenceDate ? (
          <p className="import-note">
            <strong>{S.aircraftRecordDate[locale]}:</strong>{' '}
            {formatDateOnly(locale, item.evidenceDate)}
          </p>
        ) : null}
        {item.registration ? (
          <p className="import-note">
            <strong>{S.aircraftRegistration[locale]}:</strong> {item.registration}
          </p>
        ) : null}
        {item.operatingAirline ? (
          <p className="import-note">
            <strong>{S.aircraftOperator[locale]}:</strong> {item.operatingAirline}
          </p>
        ) : null}
        {item.evidence ? (
          <p className="import-note">
            <strong>{S.aircraftEvidence[locale]}:</strong> {item.evidence}
          </p>
        ) : null}
        {item.uncertainty ? (
          <p className="import-note">
            <strong>{S.aircraftUnsure[locale]}:</strong> {item.uncertainty}
          </p>
        ) : null}
        {sources.length > 0 ? (
          <p className="import-note">
            <strong>{S.aircraftSources[locale]}:</strong>{' '}
            {sources.map((source, index) => (
              <span key={index}>
                {index > 0 ? ' · ' : ' '}
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.title || source.href}
                </a>
              </span>
            ))}
          </p>
        ) : null}
        {tag(item.flightId)}
      </li>
    )
  }

  return (
    <section className="import-aircraft" aria-labelledby="import-aircraft-title">
      <h3 id="import-aircraft-title">{S.aircraftTitle[locale]}</h3>
      <p className="import-hint">{S.aircraftIntro[locale]}</p>
      {searchSuggestions.map((html, index) => (
        <iframe
          key={index}
          className="import-search-suggestions"
          title={S.aircraftSearchSuggestions[locale]}
          srcDoc={html}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
        />
      ))}
      {failure ? (
        <p className="import-problem" role="alert">
          {S.aircraftSearchFailed[locale]} {FAILURE[failure.kind][locale].title}.
        </p>
      ) : null}
      {view.suggested.length > 0 ? (
        <>
          <div className="import-select-head">
            <label className="import-check">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={open.length === 0 || applying}
                onChange={() =>
                  setSelected(
                    toggleAll(
                      selected,
                      open.map((item) => item.flightId),
                    ),
                  )
                }
              />
              <span>
                {allSelected ? S.aircraftDeselectAll[locale] : S.aircraftSelectAll[locale]}
              </span>
            </label>
            <span className="import-count" aria-live="polite">
              {count(locale, 'selected', open.filter((item) => selected.has(item.flightId)).length)}{' '}
              · {count(locale, 'aircraftOffered', view.suggested.length)}
            </span>
          </div>
          <ul className="import-rows">{view.suggested.map(row)}</ul>
          <div className="import-actions">
            <Button
              variant="primary"
              morphText
              loading={applying}
              loadingLabel={S.aircraftAccepting[locale]}
              disabledReason={
                open.filter((item) => selected.has(item.flightId)).length === 0
                  ? S.nothingChosen[locale]
                  : undefined
              }
              onClick={() =>
                void accept(
                  open.filter((item) => selected.has(item.flightId)).map((item) => item.flightId),
                )
              }
            >
              {count(
                locale,
                'aircraftSaveN',
                open.filter((item) => selected.has(item.flightId)).length,
              )}
            </Button>
            {retryIds.length > 0 ? (
              <Button disabled={applying} onClick={() => void accept(retryIds)}>
                {S.aircraftRetry[locale]}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="import-empty">{S.aircraftNone[locale]}</p>
      )}
      <p className="import-hint" role="status">
        {last && last.saved > 0 ? summary : ''}
      </p>
      <p className="import-problem" role="alert">
        {last && last.saved === 0 ? summary : ''}
      </p>
      {view.unidentified.length > 0 ? (
        <>
          <h4>{S.aircraftUnidentified[locale]}</h4>
          <ul className="import-rows">
            {view.unidentified.map((item) => (
              <li key={item.flightId} className="import-row">
                <p className="import-row-meta">
                  <span>{flightLine(item.flightId)}</span>
                  {item.icao ? <span className="import-code">{item.icao}</span> : null}
                  {item.confidence !== null ? (
                    <span className="import-chip">
                      {S.confidence[locale]} {Math.round(item.confidence * 100)}%
                    </span>
                  ) : null}
                </p>
                <p className="import-note">{reason(item)}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
