'use client'

import { findAirport } from '@kuuki/data/airport-lookup'
import type { Flight } from '@kuuki/client/flights'
import { Check, CircleAlert, ClipboardCheck, Clock, Copy, PenLine } from '@keyline-icons/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { formatCount, formatNumber } from '../../../lib/format'
import { FlightForm } from '../../capture/flight-form'
import { S } from '../../import/copy'
import { routeCountries } from '../../import/flight-input'
import type { ImportSource } from '../../import/import-api'
import type { Failure } from '../../import/import-errors'
import type { Draft } from '../../import/import-types'
import { checkFile, fileToBase64 } from '../../import/source-step'
import {
  defaultBatchApi,
  useImportBatch,
  type BatchApi,
  type BatchState,
} from '../../import/use-import-batch'
import { Button } from '../../ui/button'
import { foundOf } from '../found'
import type { FactFlight, Found, SavedSummary, StepProps } from '../types'
import { MAX_TEXT_CHARS, carriesFiles, hasV2Header, isEditable, readClipboard } from './clipboard'
import { COPY, countryForms, reviewForms, stoppedForms } from './copy'
import './flights.css'

const LIST_ROWS = 4
/** How long a bound read runs before the step offers to carry on elsewhere; the member shell's dock picks it up. */
const KEEP_EXPLORING_MS = 20_000
const ACCEPT = 'application/pdf,image/png,image/jpeg'

type Notice =
  | { kind: 'denied' }
  | { kind: 'empty' }
  | { kind: 'fileType'; name: string }
  | { kind: 'fileSize'; bytes: number }
  | { kind: 'fileRead' }
  | { kind: 'tooLong'; length: number }

type Stop =
  | { kind: 'nothing' }
  | { kind: 'rateLimit' }
  | { kind: 'tooLong' }
  | { kind: 'offline' }
  | { kind: 'file' }
  | { kind: 'truncated' }
  | { kind: 'stopped' }
  | { kind: 'error'; gone: boolean }

/** Why the step stopped on its own, from what the batch hook reports; null while it is reading or untouched. */
function stopOf({ phase, failure, partial, drafts }: BatchState): Stop | null {
  const found = drafts.length > 0
  if (phase === 'ready') {
    if (partial) {
      if (!found) return { kind: 'error', gone: false }
      return failure?.kind === 'truncated' ? { kind: 'truncated' } : { kind: 'stopped' }
    }
    return found ? null : { kind: 'nothing' }
  }
  if (phase === 'cancelled') return { kind: 'error', gone: false }
  if (phase !== 'failed') return null
  if (found) return { kind: 'stopped' }
  return failureStop(failure)
}

function failureStop(failure: Failure | null): Stop {
  switch (failure?.kind) {
    case 'rateLimit':
    case 'quota':
      return { kind: 'rateLimit' }
    case 'offline':
      return { kind: 'offline' }
    case 'nothing':
      return { kind: 'nothing' }
    case 'file':
      return failure.code === 'TEXT_TOO_LONG' ? { kind: 'tooLong' } : { kind: 'file' }
    case 'expired':
    case 'notFound':
      return { kind: 'error', gone: true }
    default:
      return { kind: 'error', gone: false }
  }
}

const subscribeNothing = () => () => {}
function subscribeCoarse(callback: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(pointer: coarse)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const readCoarse = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
const readKey = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘V' : 'Ctrl+V')

function formatKey(template: string, key: string) {
  return template.replace('{key}', key)
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function factOf(draft: Draft): FactFlight {
  const { date, origin, destination } = draft.fields
  return { date, origin, destination, upcoming: date > todayIso() }
}

function countriesOf(drafts: Draft[]): number {
  const codes = new Set<string>()
  for (const draft of drafts)
    for (const code of routeCountries(draft.fields.origin, draft.fields.destination))
      codes.add(code)
  return codes.size
}

function snippetOf(content: string) {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat
}

function routeOf(draft: Draft) {
  const { origin, destination } = draft.fields
  const label = (code: string) => findAirport(code)?.iata ?? code
  return `${label(origin)} → ${label(destination)}`
}

function NoticeBox({
  children,
  detail,
  snippet,
}: {
  children: ReactNode
  detail?: string
  snippet?: string
}) {
  return (
    <div className="flights-notice" role="alert">
      <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
      <div className="flights-notice-text">
        <p>{children}</p>
        {snippet ? <p className="flights-notice-snippet">{snippet}</p> : null}
        {detail ? <p className="flights-notice-detail">{detail}</p> : null}
      </div>
    </div>
  )
}

export function FlightsStep({
  locale,
  ownerId,
  headingRef,
  name,
  jobs = false,
  batch,
  manual,
  onBatch,
  onManual,
  onReview,
  onManualSaved,
  onFound,
  onSkip,
}: StepProps & {
  /** The name saved on the previous step; the heading uses its first word. */
  name?: string
  /** The job worker is bound in this deployment (a resumed batch is then safe to leave). */
  jobs?: boolean
  /** The batch being read, from `?batch=` (resume, Back, reload). */
  batch: string | null
  /** `?manual=1`: the one-flight form. */
  manual: boolean
  /** A submission was accepted: keep its batch ID in the URL (replace). */
  onBatch: (batch: string | null) => void
  onManual: (open: boolean) => void
  /** Drafts are ready: go to the review step. */
  onReview: (batch: string) => void
  /** The one-flight form saved: straight to the reveal. */
  onManualSaved: (summary: SavedSummary) => void
  /** What has been found so far (countries of the drafts that would be saved), for the passport. */
  onFound: (found: Found) => void
  /** "I'll do this later": record onboarding as done and dissolve. Rejects when recording fails. */
  onSkip: () => Promise<void>
}) {
  const t = (entry: { en: string; ru: string }) => entry[locale]
  const first = name?.trim().split(/\s+/)[0] ?? ''
  const key = useSyncExternalStore(subscribeNothing, readKey, () => 'Ctrl+V')
  const coarse = useSyncExternalStore(subscribeCoarse, readCoarse, () => false)

  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [kept, setKept] = useState<ImportSource | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [dropping, setDropping] = useState(false)
  // Keyboard clipboard chips (Gboard, SwiftKey) insert text without a paste event, so the box needs its own submit.
  const [boxText, setBoxText] = useState('')
  // The job worker accepted the batch (202), or we are resuming one it already holds. The unbound fallback is false.
  const [bound, setBound] = useState(Boolean(batch) && jobs)
  const [skip, setSkip] = useState<'idle' | 'busy' | 'failed'>('idle')
  const operation = useRef<string | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reviewed = useRef(false)
  // This mount saw the batch being read (or sent it): only then does ready move on by itself. A batch that is already
  // ready on arrival (Back from review, a reload) waits for the member (17.13).
  const [observed, setObserved] = useState(false)
  // Each submission counts its own 20 s; `lingered` names the submission that reached them.
  const [submission, setSubmission] = useState(0)
  const [lingered, setLingered] = useState<number | null>(null)

  const api = useMemo<BatchApi>(
    () => ({
      ...defaultBatchApi,
      submit: async (...args) => {
        const answer = await defaultBatchApi.submit(...args)
        setBound('batchId' in answer)
        return answer
      },
    }),
    [],
  )
  const state = useImportBatch({ api, initialBatchId: batch, onBatchId: onBatch })
  const { phase, drafts, start } = state
  const reading = phase === 'starting' || phase === 'processing'
  const stop = stopOf(state)
  const prompt = S.prompt[locale]

  const run = (source: ImportSource, id: string = crypto.randomUUID()) => {
    operation.current = id
    setKept(source)
    setNotice(null)
    setBound(false)
    setObserved(true)
    setSubmission((value) => value + 1)
    void start(source, id)
  }
  const submitText = (value: string) => {
    if (value.length > MAX_TEXT_CHARS) {
      setKept({ type: 'text', content: value })
      setNotice({ kind: 'tooLong', length: value.length })
      return
    }
    run({ type: 'text', content: value })
  }
  const submitFile = async (file: File) => {
    const problem = checkFile(file)
    if (problem) {
      setNotice(
        problem === 'type'
          ? { kind: 'fileType', name: file.name }
          : { kind: 'fileSize', bytes: file.size },
      )
      return
    }
    let content: string
    try {
      content = await fileToBase64(file)
    } catch {
      setNotice({ kind: 'fileRead' })
      return
    }
    run({
      type: file.type === 'application/pdf' ? 'pdf' : 'image',
      content,
      sourceLabel: file.name,
    })
  }
  const resend = () => {
    if (kept && operation.current) {
      setObserved(true)
      setSubmission((value) => value + 1)
      void start(kept, operation.current)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied('ok')
      setNotice(null)
    } catch {
      setCopied('failed')
    }
  }
  async function pasteFromClipboard() {
    if (reading) return
    const result = await readClipboard()
    if (result.kind === 'file') void submitFile(result.file)
    else if (result.kind === 'text') submitText(result.text)
    else if (result.kind === 'empty') setNotice({ kind: 'empty' })
    else {
      setBlocked(true)
      setNotice({ kind: 'denied' })
    }
  }
  async function later() {
    if (skip === 'busy') return
    setSkip('busy')
    try {
      await onSkip()
    } catch {
      setSkip('failed')
      return
    }
    setSkip('idle')
  }

  useEffect(() => {
    if (!reading || !bound) return
    const timer = window.setTimeout(() => setLingered(submission), KEEP_EXPLORING_MS)
    return () => window.clearTimeout(timer)
  }, [reading, bound, submission])
  const keepExploring = reading && bound && lingered === submission

  // The prompt text is selected for manual copying whenever the write failed.
  useEffect(() => {
    if (copied !== 'failed') return
    promptRef.current?.focus()
    promptRef.current?.select()
  }, [copied])

  // The latest closures for the document listeners, so they never re-subscribe while the member pastes.
  const live = useRef({ submitText, submitFile, resend, reading })
  useEffect(() => {
    live.current = { submitText, submitFile, resend, reading }
  })
  const lastText = useRef<string | null>(null)
  useEffect(() => {
    lastText.current = kept?.type === 'text' ? kept.content : null
  }, [kept])

  // O14: paste anywhere, except into another field; drop anywhere.
  useEffect(() => {
    if (manual) return
    const onPaste = (event: ClipboardEvent) => {
      if (live.current.reading) return
      if (isEditable(event.target) && event.target !== boxRef.current) return
      const files = Array.from(event.clipboardData?.files ?? [])
      const file = files.find((candidate) => checkFile(candidate) === null) ?? files[0]
      if (file) {
        event.preventDefault()
        void live.current.submitFile(file)
        return
      }
      const pasted = event.clipboardData?.getData('text/plain') ?? ''
      event.preventDefault()
      if (pasted.trim()) live.current.submitText(pasted)
      else setNotice({ kind: 'empty' })
    }
    const onDragOver = (event: DragEvent) => {
      if (!carriesFiles(event.dataTransfer)) return
      event.preventDefault()
      if (!live.current.reading) setDropping(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setDropping(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event.dataTransfer)) return
      // Always claim the drop: an unclaimed file would navigate the tab away from the step.
      event.preventDefault()
      setDropping(false)
      const file = event.dataTransfer?.files?.[0]
      if (file && !live.current.reading) void live.current.submitFile(file)
    }
    document.addEventListener('paste', onPaste)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [manual])

  // O16: on return to the tab, read silently where the browser already allows it; act only on the v2 header.
  useEffect(() => {
    if (manual) return
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || live.current.reading) return
      try {
        const status = await navigator.permissions.query({
          name: 'clipboard-read' as PermissionName,
        })
        if (status.state !== 'granted') return
        const value = await navigator.clipboard.readText()
        if (live.current.reading || value === lastText.current || !hasV2Header(value)) return
        live.current.submitText(value)
      } catch {
        // No permissions API, no clipboard, or a refusal: nothing happens and nothing is asked.
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [manual])

  // 17.11: a submission that never reached the server goes out once the connection is back.
  const offline = stop?.kind === 'offline' && kept !== null
  useEffect(() => {
    if (!offline) return
    const onOnline = () => live.current.resend()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [offline])

  // The passport follows the drafts as they arrive.
  const foundSent = useRef(false)
  useEffect(() => {
    if (drafts.length === 0 && !foundSent.current) return
    foundSent.current = true
    onFound(foundOf(drafts.map(factOf)))
  }, [drafts, onFound])

  if (phase === 'processing' && !observed) setObserved(true)

  // Ready with rows after this mount watched the batch: straight to review.
  const arrived =
    phase === 'ready' && !state.partial && drafts.length > 0 && state.batch !== null && !observed
  useEffect(() => {
    if (phase !== 'ready' || state.partial || drafts.length === 0 || !state.batch) return
    if (!observed || reviewed.current) return
    reviewed.current = true
    onReview(state.batch.id)
  }, [phase, state.partial, state.batch, drafts.length, observed, onReview])

  // A batch that is gone must not stay in the URL.
  const gone = stop?.kind === 'error' && stop.gone
  useEffect(() => {
    if (gone) onBatch(null)
  }, [gone, onBatch])

  const manualSaved = useRef(false)
  const saved = useCallback(
    (flight: Flight) => {
      if (manualSaved.current) return
      manualSaved.current = true
      onManualSaved({
        flights: [
          {
            date: flight.date,
            origin: flight.origin,
            destination: flight.destination,
            upcoming: flight.is_upcoming,
          },
        ],
        leftOut: 0,
      })
    },
    [onManualSaved],
  )

  if (manual) {
    return (
      <div className="flights-step">
        <button type="button" className="flights-link" onClick={() => onManual(false)}>
          {t(COPY.back)}
        </button>
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            {t(COPY.manualTitle)}
          </h1>
        </div>
        <FlightForm ownerId={ownerId} locale={locale} onSaved={saved} />
      </div>
    )
  }

  const rows = drafts.slice(-LIST_ROWS).reverse()
  const count = drafts.length
  const countries = countriesOf(drafts)
  const showList = reading || stop?.kind === 'stopped' || stop?.kind === 'truncated'
  const attempted = kept !== null || copied === 'ok' || pasteOpen || stop !== null
  const textSource = kept?.type === 'text' ? kept.content : null

  const noticeText = (): { text: string; detail?: string; snippet?: string } | null => {
    if (notice) {
      switch (notice.kind) {
        case 'denied':
          return { text: formatKey(t(coarse ? COPY.deniedTouch : COPY.denied), key) }
        case 'empty':
          return { text: t(COPY.empty) }
        case 'fileType':
          return { text: t(COPY.fileType), detail: notice.name }
        case 'fileSize':
          return {
            text: t(COPY.fileSize).replace(
              '{mb}',
              formatNumber(locale, Math.max(1, Math.round(notice.bytes / 1_048_576))),
            ),
          }
        case 'fileRead':
          return { text: t(COPY.fileRead) }
        case 'tooLong':
          return { text: t(COPY.tooLong), detail: tooLongDetail(notice.length) }
      }
    }
    switch (stop?.kind) {
      case 'nothing':
        if (textSource === null) return { text: t(kept ? COPY.notFlightsFile : COPY.notFlights) }
        return hasV2Header(textSource)
          ? { text: t(COPY.nothingKnown) }
          : { text: t(COPY.notFlights), snippet: snippetOf(textSource) }
      case 'tooLong':
        return {
          text: t(COPY.tooLong),
          detail: textSource === null ? undefined : tooLongDetail(textSource.length),
        }
      case 'rateLimit':
        return { text: t(COPY.rateLimit) }
      case 'file':
        return { text: t(COPY.fileServer) }
      case 'error':
        return { text: t(stop.gone ? COPY.gone : COPY.error) }
      default:
        return null
    }
  }
  const tooLongDetail = (length: number) =>
    t(COPY.tooLongCount)
      .replace('{count}', formatNumber(locale, length))
      .replace('{limit}', formatNumber(locale, MAX_TEXT_CHARS))
  const shown = noticeText()

  const links = (extra?: ReactNode) => (
    <div className="flights-links">
      {extra}
      <button
        type="button"
        className="flights-link"
        data-tone="muted"
        aria-busy={skip === 'busy' ? true : undefined}
        onClick={() => void later()}
      >
        {t(COPY.later)}
      </button>
    </div>
  )
  const skipError =
    skip === 'failed' ? (
      <p className="flights-skip-error" role="alert">
        {t(COPY.laterFailed)}
      </p>
    ) : null
  const copyAgain = (
    <button type="button" className="flights-link" onClick={() => void copy()}>
      {t(COPY.copyAgain)}
    </button>
  )
  const copyFailedNote =
    copied === 'failed' ? (
      <p className="flights-hint" role="status">
        {t(COPY.copyFailed)}
      </p>
    ) : null
  const tray = (
    <div className="flights-tray">
      <div className="flights-tray-window">
        <textarea
          ref={promptRef}
          className="flights-prompt"
          readOnly
          rows={5}
          aria-label={t(COPY.promptLabel)}
          value={prompt}
        />
        <div className="flights-tray-fade" aria-hidden="true" />
      </div>
      <div className="flights-tray-foot">
        <Button variant="primary" className="auth-primary" onClick={() => void copy()}>
          <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
          {t(COPY.copyPrompt)}
        </Button>
      </div>
    </div>
  )
  const addFile = (
    <>
      <input
        ref={fileRef}
        className="flights-file"
        type="file"
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void submitFile(file)
        }}
      />
      <Button className="flights-outline" onClick={() => fileRef.current?.click()}>
        {t(COPY.addPass)}
      </Button>
    </>
  )

  let body: ReactNode
  if (showList) {
    const stopped = stop?.kind === 'stopped'
    const truncated = stop?.kind === 'truncated'
    const reviewId = state.batch?.id
    body = (
      <>
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            {t(COPY.readingTitle)}
          </h1>
        </div>
        <div className="flights-live">
          <p className="flights-count" aria-live="polite">
            <span className="flights-count-n">{formatNumber(locale, count)}</span>{' '}
            {countLine(locale, count, countries, truncated ? 'read' : 'found')}
          </p>
          <ol className="flights-list" aria-label={t(COPY.listLabel)}>
            {rows.length > 0
              ? rows.map((draft) => (
                  <li key={draft.id}>
                    <span>{draft.fields.date || draft.fields.date_month_day || '—'}</span>
                    <span className="flights-list-route">{routeOf(draft)}</span>
                    <span>
                      {[draft.fields.airline_iata, draft.fields.flight_number]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </li>
                ))
              : [92, 120, 56].map((width, index) => (
                  <li
                    key={width}
                    className="flights-skeleton"
                    style={{ opacity: [1, 0.7, 0.4][index] }}
                  >
                    <span style={{ inlineSize: width }} />
                  </li>
                ))}
          </ol>
        </div>
        {reading && bound ? (
          <p className="flights-safe">
            <Clock size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{t(COPY.safe)}</span>
          </p>
        ) : null}
        {keepExploring ? (
          <Button
            className="flights-outline"
            aria-busy={skip === 'busy' ? true : undefined}
            onClick={() => void later()}
          >
            {t(COPY.keepExploring)}
          </Button>
        ) : null}
        {truncated && reviewId ? (
          <>
            <NoticeBox>
              {t(COPY.truncated).replace('{count}', formatNumber(locale, count))}
            </NoticeBox>
            <Button variant="primary" className="auth-primary" onClick={() => onReview(reviewId)}>
              {formatCount(locale, count, reviewForms)}
            </Button>
          </>
        ) : null}
        {stopped ? (
          <>
            <NoticeBox detail={kept ? undefined : t(COPY.stoppedNoSource)}>
              {formatCount(locale, count, stoppedForms)}
            </NoticeBox>
            {kept ? (
              <Button variant="primary" className="auth-primary" onClick={() => run(kept)}>
                {t(COPY.readRest)}
              </Button>
            ) : null}
            {reviewId ? (
              <button type="button" className="flights-link" onClick={() => onReview(reviewId)}>
                {formatCount(locale, count, reviewForms)}
              </button>
            ) : null}
          </>
        ) : null}
        {stop ? links(copyAgain) : links()}
        {skipError}
      </>
    )
  } else if (stop?.kind === 'offline') {
    body = (
      <>
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            {t(COPY.offlineTitle)}
          </h1>
        </div>
        <p className="flights-count" aria-live="polite">
          <span className="flights-count-n">0</span> {t(COPY.offlineCount)}
        </p>
        <NoticeBox>{t(COPY.offlineNote)}</NoticeBox>
        <div className="flights-links">
          <Button className="flights-outline" onClick={resend}>
            {t(COPY.tryNow)}
          </Button>
          {links()}
        </div>
        {skipError}
      </>
    )
  } else if (!attempted) {
    body = (
      <>
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            {arrived
              ? t(COPY.readyTitle)
              : first
                ? t(COPY.titleNamed).replace('{name}', first)
                : t(COPY.title)}
          </h1>
          {arrived ? null : <p>{t(COPY.sub)}</p>}
        </div>
        {arrived && state.batch ? (
          <Button
            variant="primary"
            className="auth-primary"
            onClick={() => onReview(state.batch!.id)}
          >
            {formatCount(locale, count, reviewForms)}
          </Button>
        ) : null}
        {shown ? (
          <NoticeBox detail={shown.detail} snippet={shown.snippet}>
            {shown.text}
          </NoticeBox>
        ) : null}
        {tray}
        {copyFailedNote}
        {coarse ? (
          <Button className="flights-outline" onClick={() => setPasteOpen(true)}>
            {t(COPY.orPaste)}
          </Button>
        ) : null}
        <div className="flights-links">
          <button type="button" className="flights-link" onClick={() => onManual(true)}>
            <PenLine size={16} strokeWidth={1.75} aria-hidden="true" />
            {t(COPY.typeIn)}
          </button>
          {links()}
        </div>
        {skipError}
      </>
    )
  } else {
    const limited = stop?.kind === 'rateLimit'
    const compact = shown !== null
    body = (
      <>
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            {t(COPY.pasteTitle)}
          </h1>
          <p>{t(coarse ? COPY.pasteSubTouch : COPY.pasteSub)}</p>
        </div>
        {shown ? (
          <NoticeBox detail={shown.detail} snippet={shown.snippet}>
            {shown.text}
          </NoticeBox>
        ) : null}
        {copied === 'failed' ? tray : null}
        {copyFailedNote}
        <div className="flights-target" data-compact={compact ? 'true' : undefined}>
          {limited ? (
            <>
              <Button disabled className="flights-pill">
                {t(COPY.rateLimitPill)}
              </Button>
              {kept ? <p className="flights-hint">{t(COPY.rateLimitKept)}</p> : null}
            </>
          ) : (
            <>
              {!compact && !blocked ? (
                <ClipboardCheck size={28} strokeWidth={1.5} aria-hidden="true" />
              ) : null}
              {!blocked ? (
                <Button variant="primary" onClick={() => void pasteFromClipboard()}>
                  {t(COPY.pasteButton)}
                </Button>
              ) : null}
              {coarse ? (
                <textarea
                  ref={boxRef}
                  className="flights-box"
                  rows={2}
                  aria-label={t(COPY.boxLabel)}
                  placeholder={t(COPY.boxHint)}
                  value={boxText}
                  onChange={(event) => setBoxText(event.target.value)}
                />
              ) : blocked ? (
                <>
                  <kbd className="flights-key">{key}</kbd>
                  <p className="flights-hint">{t(COPY.hintBlocked)}</p>
                </>
              ) : (
                <p className="flights-hint">{formatKey(t(COPY.hint), key)}</p>
              )}
            </>
          )}
        </div>
        {coarse && boxText.trim() && !limited ? (
          <Button variant="primary" className="flights-read" onClick={() => submitText(boxText)}>
            {t(COPY.readBox)}
          </Button>
        ) : null}
        {coarse ? addFile : null}
        <div className="flights-status">
          {copied === 'ok' ? (
            <p className="flights-copied">
              <Check size={16} strokeWidth={2} aria-hidden="true" />
              {t(COPY.copied)}
            </p>
          ) : (
            <span />
          )}
          {links(copyAgain)}
        </div>
        {limited ? (
          <button type="button" className="flights-link" onClick={() => onManual(true)}>
            <PenLine size={16} strokeWidth={1.75} aria-hidden="true" />
            {t(COPY.typeIn)}
          </button>
        ) : null}
        {skipError}
      </>
    )
  }

  return (
    <div className="flights-step" data-dropping={dropping ? 'true' : undefined}>
      {body}
      <div className="flights-drop" aria-hidden="true">
        <span>{t(COPY.drop)}</span>
      </div>
    </div>
  )
}

/** "found so far, 6 countries" (or "read, …"); no country part until there is one. */
function countLine(
  locale: 'en' | 'ru',
  flights: number,
  countries: number,
  verb: 'found' | 'read',
) {
  const label = COPY[verb][locale]
  if (flights === 0) return label
  return countries > 0 ? `${label}, ${formatCount(locale, countries, countryForms)}` : label
}
