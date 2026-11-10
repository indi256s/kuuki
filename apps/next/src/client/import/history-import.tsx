'use client'
// The Flighty CSV import (ADR 0008): one summary of counts, one question per group, the records that still need an
// answer paged from the server, and one Save that the controller walks in server pages. Everything shown comes from
// the server run, so a refresh lands on the same decisions.
import { X } from '@keyline-icons/react'
import { useId, useRef, useState, useSyncExternalStore } from 'react'
import type { HistoryGroup, HistoryRowAnswers, HistoryRowView } from '@kuuki/shared/flightyHistory'
import { formatDateOnly, formatNumber, type Locale } from '../../lib/format'
import { NavigationLink as Link } from '../navigation-link'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { TextShimmer } from '../ui/text-shimmer'
import { historyArchiveHref } from './history-api'
import {
  FIELD,
  FINDING,
  H,
  ISSUE,
  STATE_LABEL,
  failureText,
  groupQuestion,
  hcount,
} from './history-copy'
import type { HistorySession } from './history-session'

const SUMMARY: Array<keyof typeof STATE_LABEL> = [
  'ready',
  'open',
  'created',
  'duplicate',
  'preserved_only',
  'ignored',
  'removed',
]
const TIME_ISSUES = new Set([
  'INVALID_TIME',
  'UNRESOLVED_TIME',
  'INCONSISTENT_TIMES',
  'DURATION_OUT_OF_RANGE',
])

const offsetLabel = (minutes: number) => {
  const sign = minutes < 0 ? '−' : '+'
  const abs = Math.abs(minutes)
  const rest = abs % 60
  return `UTC${sign}${Math.floor(abs / 60)}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`
}

export function HistoryImport({
  session,
  locale,
  onClose,
}: {
  session: HistorySession
  locale: Locale
  onClose: () => void
}) {
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  const { run, failure } = state
  const reselect = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<'erase' | 'discard' | null>(null)
  const open = run ? run.totals.states.needs_review + run.totals.states.error : 0
  const ready = run?.totals.states.ready ?? 0
  const receiving = run?.status === 'receiving'
  const finished = run?.status === 'completed' || run?.status === 'closed'
  const busyRun = state.reading || Boolean(state.upload) || Boolean(state.saving)
  const deciding = state.busy.size > 0

  return (
    <div className="import-page history-import">
      <div className="unified-import-heading">
        <h1>{state.fileName ?? (locale === 'ru' ? 'Импорт Flighty' : 'Flighty import')}</h1>
        <Button variant="ghost" aria-label={H.close[locale]} disabled={busyRun} onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      <p className="import-privacy">{H.privacy[locale]}</p>

      <div aria-live="polite">
        {state.reading ? (
          <TextShimmer>{run ? H.restoring[locale] : H.reading[locale]}</TextShimmer>
        ) : state.upload ? (
          <p className="import-hint">
            {H.sending[locale]} · {formatNumber(locale, state.upload.sent)}{' '}
            {hcount(locale, 'of', state.upload.total)}
          </p>
        ) : null}
      </div>

      {failure ? (
        <Alert
          variant="danger"
          title={failureText(locale, failure)}
          action={
            failure.kind === 'offline' || failure.kind === 'server' ? (
              <Button onClick={() => void session.retry()}>{H.retry[locale]}</Button>
            ) : undefined
          }
        />
      ) : null}

      {receiving && !state.upload && !state.reading && !session.holdsFile() ? (
        <section className="history-import-reselect">
          <p>{H.reselect[locale]}</p>
          <Button onClick={() => reselect.current?.click()}>{H.chooseAgain[locale]}</Button>
          <input
            ref={reselect}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void session.choose(file)
            }}
          />
        </section>
      ) : null}

      {run && !receiving ? (
        <>
          <section aria-labelledby="history-summary">
            <h2 id="history-summary">{H.summary[locale]}</h2>
            <dl className="history-import-summary">
              {SUMMARY.map((key) => {
                const n = key === 'open' ? open : run.totals.states[key]
                if (!n) return null
                return (
                  <div key={key}>
                    <dt>{STATE_LABEL[key][locale]}</dt>
                    <dd>{formatNumber(locale, n)}</dd>
                  </div>
                )
              })}
            </dl>
            {run.unknownHeaders.length ? (
              <p className="import-hint">
                {H.unknownColumns[locale]} {run.unknownHeaders.join(', ')}
              </p>
            ) : null}
          </section>

          {run.groups.length ? (
            <section aria-labelledby="history-questions">
              <h2 id="history-questions">{H.questions[locale]}</h2>
              <ul className="history-import-list">
                {run.groups.map((group) => (
                  <GroupQuestion
                    key={group.group}
                    group={group}
                    locale={locale}
                    busy={state.busy.has(group.group) || Boolean(state.saving)}
                    onAnswer={(answer) => void session.answerGroup(group, answer)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {state.exceptions.length ? (
            <section aria-labelledby="history-exceptions">
              <h2 id="history-exceptions">{H.exceptions[locale]}</h2>
              <ul className="history-import-list">
                {state.exceptions.map((row) => (
                  <RecordRow
                    key={row.id}
                    row={row}
                    locale={locale}
                    busy={state.busy.has(row.id) || Boolean(state.saving)}
                    onPatch={(change) => void session.patchRow(row, change)}
                  />
                ))}
              </ul>
              {state.nextCursor !== null ? (
                <Button variant="ghost" onClick={() => void session.more()}>
                  {H.more[locale]}
                </Button>
              ) : null}
            </section>
          ) : null}

          {ready && !finished ? (
            <section aria-labelledby="history-ready">
              <h2 id="history-ready">{H.readyTitle[locale]}</h2>
              {state.ready ? (
                <>
                  <ul className="history-import-list">
                    {state.ready.rows.map((row) => (
                      <RecordRow
                        key={row.id}
                        row={row}
                        locale={locale}
                        busy={state.busy.has(row.id) || Boolean(state.saving)}
                        onPatch={(change) => void session.patchRow(row, change)}
                      />
                    ))}
                  </ul>
                  <div className="import-actions">
                    {state.ready.nextCursor !== null ? (
                      <Button variant="ghost" onClick={() => void session.showReady(true)}>
                        {H.more[locale]}
                      </Button>
                    ) : null}
                    <Button variant="ghost" onClick={() => session.hideReady()}>
                      {H.hideReady[locale]}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="import-actions">
                  <Button disabled={busyRun} onClick={() => void session.showReady()}>
                    {H.showReady[locale]}
                  </Button>
                </div>
              )}
            </section>
          ) : null}

          {finished ? (
            <section aria-labelledby="history-finished">
              <h2 id="history-finished">{H.finished[locale]}</h2>
              <div className="import-actions">
                <Link className="ui-button" data-variant="primary" href="/journal">
                  {H.openJournal[locale]}
                </Link>
                {run.sourceErased ? (
                  <p className="import-hint">{H.erased[locale]}</p>
                ) : (
                  <>
                    <a
                      className="ui-button"
                      data-variant="secondary"
                      href={historyArchiveHref(run.id)}
                      download
                    >
                      {H.archive[locale]}
                    </a>
                    <Button variant="ghost" onClick={() => setConfirm('erase')}>
                      {H.erase[locale]}
                    </Button>
                  </>
                )}
              </div>
            </section>
          ) : (
            <FloatingActionBar
              label={H.summary[locale]}
              countLabel={
                state.saving ? (
                  <>
                    {H.saving[locale]} · {formatNumber(locale, state.saving.done)}{' '}
                    {hcount(locale, 'of', state.saving.total)}
                  </>
                ) : ready ? (
                  hcount(locale, 'records', ready)
                ) : (
                  H.nothingReady[locale]
                )
              }
            >
              <Button variant="ghost" disabled={busyRun} onClick={() => setConfirm('discard')}>
                {H.discard[locale]}
              </Button>
              <Button
                variant="primary"
                disabled={!ready || busyRun || deciding}
                onClick={() => void session.save()}
              >
                {hcount(locale, 'save', ready)}
              </Button>
            </FloatingActionBar>
          )}
        </>
      ) : null}

      <DestructiveConfirm
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm === 'erase' ? H.eraseTitle[locale] : H.discardTitle[locale]}
        consequence={
          confirm === 'erase' ? H.eraseConsequence[locale] : H.discardConsequence[locale]
        }
        confirmLabel={confirm === 'erase' ? H.erase[locale] : H.discard[locale]}
        cancelLabel={H.cancel[locale]}
        onConfirm={async () => {
          if (confirm === 'erase') await session.eraseSource()
          else {
            await session.discard()
            onClose()
          }
          setConfirm(null)
        }}
      />
    </div>
  )
}

function GroupQuestion({
  group,
  locale,
  busy,
  onAnswer,
}: {
  group: HistoryGroup
  locale: Locale
  busy: boolean
  onAnswer: (answer: string | boolean | null) => void
}) {
  const [kind] = group.group.split(':')
  return (
    <li className="history-import-item">
      <p className="history-import-question">{groupQuestion(locale, group.group, group.token)}</p>
      <p className="import-hint">{hcount(locale, 'records', group.rows)}</p>
      <div className="import-actions">
        {kind === 'canceled' ? (
          <>
            <Button disabled={busy} onClick={() => onAnswer(false)}>
              {H.flew[locale]}
            </Button>
            <Button disabled={busy} onClick={() => onAnswer(true)}>
              {H.cancelled[locale]}
            </Button>
          </>
        ) : group.group === 'match:new_since_import' ? (
          <Button disabled={busy} onClick={() => onAnswer('new')}>
            {H.addAllNew[locale]}
          </Button>
        ) : group.group === 'match:existing_flight' ? (
          <>
            <Button disabled={busy} onClick={() => onAnswer('link')}>
              {H.keepJournal[locale]}
            </Button>
            <Button disabled={busy} onClick={() => onAnswer('new')}>
              {H.addSeparate[locale]}
            </Button>
          </>
        ) : (
          <>
            {group.candidates.map((candidate) => (
              <Button key={candidate} disabled={busy} onClick={() => onAnswer(candidate)}>
                <span className="import-code">{candidate}</span>
              </Button>
            ))}
            <CodeAnswer
              label={kind === 'airport' ? H.airportCode[locale] : H.airlineCode[locale]}
              pattern={kind === 'airport' ? /^[A-Z]{3}$/ : /^[A-Z0-9]{2}$/}
              maxLength={kind === 'airport' ? 3 : 2}
              locale={locale}
              busy={busy}
              onApply={onAnswer}
            />
            {kind === 'airline' ? (
              <Button variant="ghost" disabled={busy} onClick={() => onAnswer(null)}>
                {H.noAirline[locale]}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </li>
  )
}

function RecordRow({
  row,
  locale,
  busy,
  onPatch,
}: {
  row: HistoryRowView
  locale: Locale
  busy: boolean
  onPatch: (change: { answers?: HistoryRowAnswers; ignore?: boolean }) => void
}) {
  const { projection } = row
  const { answers } = row
  const answer = (change: HistoryRowAnswers) => onPatch({ answers: { ...answers, ...change } })
  const own = row.issues.filter((issue) => !issue.group)
  const has = (code: string) => own.some((issue) => issue.code === code)
  const ambiguous = own.filter(
    (issue) => issue.code === 'AMBIGUOUS_TIME' && issue.header && issue.offsets,
  )
  const timeIssue = own.some((issue) => TIME_ISSUES.has(issue.code))
  const airports = own.filter(
    (issue) =>
      (issue.code === 'MISSING_AIRPORT' || issue.code === 'UNKNOWN_AIRPORT') &&
      (issue.field === 'origin' || issue.field === 'destination' || issue.field === 'diversion'),
  )
  const finding = !row.issues.length && row.finding ? row.finding : null
  const offsets = answers.times && answers.times !== 'drop' ? answers.times.offsets : {}
  const route =
    projection.origin && projection.destination
      ? `${projection.origin} → ${projection.destination}`
      : H.noRoute[locale]
  const flight = [projection.airline, projection.flightNumber].filter(Boolean).join(' ')
  return (
    <li className="history-import-item">
      <p className="history-import-question">
        {projection.date ? formatDateOnly(locale, projection.date) : null}{' '}
        <span className="import-code">{route}</span>{' '}
        {flight ? <span className="import-code">{flight}</span> : null}
      </p>
      <p className="import-hint">
        {H.line[locale]} {row.line}
      </p>
      {row.issues.length || finding ? (
        <ul className="history-import-issues">
          {row.issues.map((issue, index) => (
            <li key={index}>
              {ISSUE[issue.code][locale]} {issue.group ? H.answeredAbove[locale] : null}
            </li>
          ))}
          {finding ? <li>{FINDING[finding.kind][locale]}</li> : null}
        </ul>
      ) : null}
      {has('INVALID_DATE') ? (
        <CodeAnswer
          label={H.date[locale]}
          type="date"
          pattern={/^\d{4}-\d{2}-\d{2}$/}
          locale={locale}
          busy={busy}
          onApply={(date) => answer({ date })}
        />
      ) : null}
      {airports.map((issue) => (
        <CodeAnswer
          key={issue.field}
          label={`${H.airportCode[locale]} · ${FIELD[issue.field as 'origin'][locale]}`}
          pattern={/^[A-Z]{3}$/}
          locale={locale}
          busy={busy}
          onApply={(code) => answer({ [issue.field]: code })}
        />
      ))}
      <div className="import-actions">
        {ambiguous.flatMap((issue) =>
          issue.offsets!.map((offset) => (
            <Button
              key={`${issue.header}:${offset}`}
              disabled={busy}
              aria-pressed={offsets[issue.header!] === offset}
              onClick={() =>
                answer({ times: { offsets: { ...offsets, [issue.header!]: offset } } })
              }
            >
              <span className="import-code">{offsetLabel(offset)}</span>
            </Button>
          )),
        )}
        {timeIssue || ambiguous.length ? (
          <Button disabled={busy} onClick={() => answer({ times: 'drop' })}>
            {H.dropTimes[locale]}
          </Button>
        ) : null}
        {has('INVALID_FLIGHT_NUMBER') ? (
          <Button disabled={busy} onClick={() => answer({ flightNumber: null })}>
            {H.noFlightNumber[locale]}
          </Button>
        ) : null}
        {has('UNKNOWN_AIRLINE') ? (
          <Button disabled={busy} onClick={() => answer({ airline: null })}>
            {H.noAirline[locale]}
          </Button>
        ) : null}
        {has('UNKNOWN_CANCELED') ? (
          <>
            <Button disabled={busy} onClick={() => answer({ canceled: false })}>
              {H.flew[locale]}
            </Button>
            <Button disabled={busy} onClick={() => answer({ canceled: true })}>
              {H.cancelled[locale]}
            </Button>
          </>
        ) : null}
        {finding ? (
          <>
            <Button disabled={busy} onClick={() => answer({ match: 'new' })}>
              {H.addNew[locale]}
            </Button>
            {finding.flightId !== null && finding.kind !== 'previous_deleted' ? (
              <Button disabled={busy} onClick={() => answer({ match: 'link' })}>
                {H.link[locale]}
              </Button>
            ) : null}
          </>
        ) : null}
        <Button variant="ghost" disabled={busy} onClick={() => onPatch({ ignore: true })}>
          {H.skip[locale]}
        </Button>
      </div>
    </li>
  )
}

/** One typed answer (a code or a date) with its own Apply. */
function CodeAnswer({
  label,
  pattern,
  type = 'text',
  maxLength = 3,
  locale,
  busy,
  onApply,
}: {
  label: string
  pattern: RegExp
  type?: 'text' | 'date'
  maxLength?: number
  locale: Locale
  busy: boolean
  onApply: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const inputId = useId()
  const valid = pattern.test(value)
  return (
    <form
      className="history-import-code"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && !busy) onApply(value)
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="ui-field-input import-code"
        type={type}
        value={value}
        autoComplete="off"
        spellCheck={false}
        {...(type === 'text'
          ? { maxLength, autoCapitalize: 'characters', placeholder: 'IATA' }
          : {})}
        onChange={(event) =>
          setValue(type === 'text' ? event.target.value.toUpperCase() : event.target.value)
        }
      />
      <Button type="submit" disabled={!valid || busy}>
        {H.apply[locale]}
      </Button>
    </form>
  )
}
