'use client'

import { CircleAlert, X } from '@keyline-icons/react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '../../lib/format'
import { useLocale } from '../preferences'
import { Button } from '../ui/button'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { useMobile } from '../ui/use-mobile'
import { announceShellNotice } from '../shell-notices'
import { useWriteFeedback } from '../write-feedback'
import { useSettingsGuard } from '../account/settings-guard'
import { DraftSaver, type DraftChange, type SaveState } from './draft-saver'
import { fetchPressedCountries, patchDraft } from './import-api'
import { useImportRunsStore } from './import-runs'
import { localToday, withSaved } from './review-model'
import type { DerivedAck } from '@kuuki/client/derivedState'
import type { Draft } from './import-types'
import { newlyPressed } from './flight-input'
import { decisionChange, draftReady, type Decision } from './route-model'
import { R, rcount } from './route-copy'
import { RouteView } from './route-view'
import { LegTicket } from './leg-ticket'
import { SharedQuestions } from './shared-questions'
import { StampStrip } from './stamp-strip'
import { ImportFinish, type Finish } from './import-finish'
import { ImportSources } from './import-sources'
import { buildReview, finishOf, landReason } from './import-review'
import { useFooterInsets } from './use-footer-insets'
import { recordLandVisits } from './land-visits'
import { S, count } from './copy'
import { UnifiedSession, type RetainedEntry } from './unified-session'
import { HistoryImport } from './history-import'
import { HistorySession, isHistoryCsv } from './history-session'
import { laneModel } from './lane/lane-model'
import { SecurityLane } from './lane/security-lane'
import { carriesFiles } from '../welcome/flights/clipboard'

const C = {
  title: { en: 'Import flights', ru: 'Импорт перелётов' },
  saveFailed: {
    en: 'Not every flight was saved',
    ru: 'Сохранились не все перелёты',
  },
  reading: {
    en: 'Still reading',
    ru: 'Ещё распознаём',
  },
  unsentText: {
    en: 'Read or clear the entered text.',
    ru: 'Распознайте или очистите введённый текст.',
  },
  close: { en: 'Close import', ru: 'Закрыть импорт' },
  pending: { en: 'Still sending files', ru: 'Файлы ещё отправляются' },
} as const

function retained(ownerId: string, batchId: string | null): RetainedEntry[] {
  try {
    const stored: RetainedEntry[] = JSON.parse(
      sessionStorage.getItem(`kuuki-import-session:${ownerId}`) ?? '[]',
    )
    if (
      Array.isArray(stored) &&
      stored.every(
        (entry) =>
          typeof entry.id === 'string' &&
          typeof entry.label === 'string' &&
          typeof entry.operationId === 'string' &&
          Array.isArray(entry.batchIds) &&
          entry.batchIds.every((id) => typeof id === 'string'),
      ) &&
      (batchId ? stored.some((entry) => entry.batchIds.includes(batchId)) : stored.length > 0)
    )
      return stored
  } catch {}
  return batchId
    ? [{ id: batchId, label: '', operationId: crypto.randomUUID(), batchIds: [batchId] }]
    : []
}

export function UnifiedImport({
  ownerId,
  locale: initialLocale,
  initialBatchId = null,
  initialSource = null,
  initialHistoryId = null,
}: {
  ownerId: string
  locale: Locale
  initialBatchId?: string | null
  initialSource?: 'file' | 'text' | 'pass' | null
  initialHistoryId?: string | null
}) {
  const locale = useLocale(initialLocale)
  const router = useRouter()
  const store = useImportRunsStore()
  const feedback = useWriteFeedback(ownerId)
  const mobile = useMobile() === true
  const [session] = useState(
    () =>
      new UnifiedSession(store?.api, store, (records) => {
        try {
          sessionStorage.setItem(`kuuki-import-session:${ownerId}`, JSON.stringify(records))
        } catch {}
      }),
  )
  const entries = useSyncExternalStore(session.subscribe, session.getEntries, session.getEntries)
  const [history] = useState(() => HistorySession.forOwner(ownerId))
  const [historyOpen, setHistoryOpen] = useState(Boolean(initialHistoryId))
  const historyRunId = useSyncExternalStore(
    history.subscribe,
    () => history.getState().run?.id ?? null,
    () => null,
  )
  const addFiles = useCallback(
    (files: File[]) => {
      const csv = files.find(isHistoryCsv)
      const rest = files.filter((file) => !isHistoryCsv(file))
      if (csv) {
        setHistoryOpen(true)
        void history.choose(csv)
      }
      if (rest.length) session.add(rest)
    },
    [history, session],
  )
  useEffect(() => {
    if (initialHistoryId) void history.resume(initialHistoryId)
  }, [history, initialHistoryId])
  useEffect(() => {
    if (historyRunId)
      window.history.replaceState(
        window.history.state,
        '',
        `/import?history=${encodeURIComponent(historyRunId)}`,
      )
  }, [historyRunId])
  const [states, setStates] = useState<Record<string, SaveState>>({})
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const savingNow = useRef(false)
  const [finish, setFinish] = useState<Finish | null>(null)
  const [deferred, setDeferred] = useState<ReadonlySet<string>>(new Set())
  const [landFailed, setLandFailed] = useState<ReadonlySet<string>>(new Set())
  const routeHeading = useRef<HTMLHeadingElement>(null)
  const baseline = useRef<Promise<ReadonlySet<string> | null> | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const [error, setError] = useState(false)
  const [textOpen, setTextOpen] = useState(initialSource === 'text')
  const [textPending, setTextPending] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const reasonId = useId()
  const closeReasonId = useId()
  const [saver] = useState(
    () =>
      new DraftSaver({
        patch: patchDraft,
        onDraft: session.setDraft,
        onState: (id, state) =>
          setStates((previous) => {
            const next = { ...previous }
            if (state) next[id] = state
            else delete next[id]
            return next
          }),
      }),
  )
  const onDirty = useCallback(
    (id: string, flag: boolean) =>
      setDirty((previous) => {
        if (previous.has(id) === flag) return previous
        const next = new Set(previous)
        if (flag) next.add(id)
        else next.delete(id)
        return next
      }),
    [],
  )

  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    session.enter()
    session.resume(retained(ownerId, initialBatchId))
    return () => {
      mounted.current = false
      session.leave()
      queueMicrotask(() => {
        if (!mounted.current) saver.dispose()
      })
    }
  }, [session, saver, ownerId, initialBatchId])
  useEffect(() => {
    if (!entries.length) return
    const records = session.retained()
    const active = entries
      .flatMap((entry) => entry.runs)
      .findLast(
        (run) =>
          run.getState().phase === 'processing' ||
          run.getState().drafts.some((draft) => draft.status === 'review'),
      )
    const id = active?.batchId() ?? records.flatMap((entry) => entry.batchIds)[0]
    if (id)
      window.history.replaceState(
        window.history.state,
        '',
        `/import?batch=${encodeURIComponent(id)}`,
      )
  }, [entries, session, ownerId])

  const pendingSource = entries.some(
    (entry) =>
      entry.phase === 'queued' ||
      entry.phase === 'local' ||
      (entry.phase === 'online' &&
        !entry.runs.some((run) => run !== entry.barcode && run.batchId())),
  )
  const unsent = dirty.size > 0 || Object.keys(states).length > 0 || textPending
  const unsentReason = textPending ? C.unsentText[locale] : R.unsaved[locale]
  const guard = useSettingsGuard(unsent, pendingSource || saving, locale)
  useEffect(() => {
    const reset = () => {
      session.stop()
      try {
        sessionStorage.removeItem(`kuuki-import-session:${ownerId}`)
      } catch {}
    }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => window.removeEventListener('kuuki:identity-reset', reset)
  }, [session, ownerId])
  useEffect(() => {
    if (historyOpen) return
    const paste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (savingNow.current || target?.closest('input, textarea, [contenteditable="true"]')) return
      const files = [...(event.clipboardData?.files ?? [])]
      if (files.length) {
        event.preventDefault()
        addFiles(files)
      }
    }
    document.addEventListener('paste', paste)
    return () => document.removeEventListener('paste', paste)
  }, [addFiles, historyOpen])

  const today = localToday()
  const review = useMemo(
    () =>
      buildReview({
        drafts: session.drafts(),
        outcomes: session.getOutcomes(),
        states,
        entries,
        requiresSelection: session.requiresSelection(),
        deferred,
        today,
      }),
    [session, entries, states, deferred, today],
  )
  const { legs, chosen, blanks, undecided, visits, landDone } = review
  const outcomes = session.getOutcomes()
  const flights = chosen.length
  const recordable = flights + visits.length
  const reading = entries.some((entry) => ['queued', 'local', 'online'].includes(entry.phase))
  const hasBar = legs.length > 0 && !finish
  useFooterInsets(root, hasBar)
  useEffect(() => {
    if (!finish || finish.stamps !== null || feedback.status !== 'ready') return
    let live = true
    void fetchPressedCountries().then((after) => {
      if (!live) return
      setFinish((current) =>
        current && current.id === finish.id
          ? {
              ...current,
              stamps:
                after && current.before ? newlyPressed(current.before, after, current.touched) : [],
            }
          : current,
      )
    })
    return () => {
      live = false
    }
  }, [finish, feedback.status])
  const finishOnly = recordable === 0 && blanks === 0 && review.recorded
  const blockReason = () => {
    if (unsent) return unsentReason
    if (reading) return C.reading[locale]
    if (recordable > 0 || finishOnly) return undefined
    if (blanks) return rcount(locale, 'notReady', blanks)
    if (review.pendingLand.length)
      return landReason(review.pendingLand) === 'unknown-country'
        ? R.unknownCountry[locale]
        : R.sameCountry[locale]
    return R.nothing[locale]
  }
  const reason = blockReason()
  const closeReason = saving
    ? S.pausedWhileSaving[locale]
    : unsent
      ? unsentReason
      : pendingSource
        ? C.pending[locale]
        : undefined
  const closeInBar = Boolean(closeReason) && closeReason === reason && hasBar
  const summary = [
    flights ? count(locale, 'flightsN', flights) : null,
    visits.length ? rcount(locale, 'land', visits.length) : null,
    blanks ? rcount(locale, 'notReady', blanks) : null,
    undecided ? rcount(locale, 'open', undecided) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const { byId, legById } = review
  const change = useCallback(
    (id: string, next: DraftChange) => {
      const original = byId.get(id)
      if (original) void saver.save(original, next)
    },
    [byId, saver],
  )
  const decide = useCallback(
    (id: string, decision: Decision) => {
      const original = byId.get(id)
      const leg = legById.get(id)
      if (!original || !leg) return
      session.decide(id, decision)
      const next = decisionChange(leg.draft, decision, leg.copyOf !== null)
      if (next) void saver.save(original, next)
    },
    [byId, legById, saver, session],
  )
  const retry = useCallback((id: string) => void saver.retry(id), [saver])
  const discard = useCallback((id: string) => saver.discard(id), [saver])

  const run = async (task: (before: Promise<ReadonlySet<string> | null>) => Promise<void>) => {
    if (savingNow.current || reason) return
    savingNow.current = true
    setSaving(true)
    setError(false)
    baseline.current ??= fetchPressedCountries()
    try {
      await task(baseline.current)
    } catch {
      setError(true)
    } finally {
      savingNow.current = false
      setSaving(false)
    }
  }

  const complete = async (after: Draft[], before: Promise<ReadonlySet<string> | null>) => {
    const result = finishOf({
      drafts: after,
      outcomes: session.getOutcomes(),
      landSaved: session.landDoneIds(),
      legs,
    })
    announceShellNotice(ownerId, {
      message: result.flights
        ? {
            en: count('en', 'savedFlights', result.flights),
            ru: count('ru', 'savedFlights', result.flights),
          }
        : {
            en: rcount('en', 'landSavedNotice', result.land),
            ru: rcount('ru', 'landSavedNotice', result.land),
          },
      kind: 'success',
    })
    try {
      if (!after.some((draft) => draft.status === 'review'))
        sessionStorage.removeItem(`kuuki-import-session:${ownerId}`)
    } catch {}
    window.history.replaceState(window.history.state, '', '/import')
    setFinish({ ...result, before: await before })
  }

  const settle = async (
    before: Promise<ReadonlySet<string> | null>,
    failedLand: ReadonlySet<string>,
  ) => {
    const after = withSaved(session.drafts(), session.getOutcomes())
    const inReview = new Set(
      after.filter((draft) => draft.status === 'review').map((draft) => draft.id),
    )
    const failed = [...session.getOutcomes()].some(
      ([id, outcome]) => outcome.status !== 'saved' && inReview.has(id),
    )
    const waiting = after.some(
      (draft) => inReview.has(draft.id) && draft.selected && !draftReady(draft),
    )
    if (failed || failedLand.size || entries.some((entry) => entry.phase === 'failed'))
      setError(failed || failedLand.size > 0)
    else if (!waiting && !saver.hasUnsaved()) await complete(after, before)
  }

  const save = () =>
    run(async (before) => {
      const [[flightSave], land] = await Promise.all([
        Promise.allSettled([chosen.length ? session.save(chosen) : Promise.resolve([])]),
        recordLandVisits(ownerId, visits, (id) => session.noteLandDone(id)),
      ])
      const failedLand = new Set(
        visits.flatMap((visit, index) => (land[index].status === 'rejected' ? [visit.id] : [])),
      )
      setLandFailed(failedLand)
      if (flightSave.status === 'rejected') throw flightSave.reason
      const acks: DerivedAck[] = [
        ...flightSave.value,
        ...land.flatMap((result) =>
          result.status === 'fulfilled'
            ? [{ derived_state: result.value.derived_state, revision: result.value.revision }]
            : [],
        ),
      ]
      const latest =
        acks
          .filter((ack) => ack.derived_state === 'pending')
          .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0))[0] ?? acks.at(-1)
      if (latest) feedback.acknowledge(latest)
      await settle(before, failedLand)
    })
  const finishImport = () => run((before) => settle(before, new Set()))

  if (historyOpen)
    return (
      <HistoryImport
        session={history}
        locale={locale}
        onClose={() => {
          history.forget()
          setHistoryOpen(false)
          window.history.replaceState(window.history.state, '', '/import')
        }}
      />
    )

  const lane = laneModel({
    entries: entries.map((entry) => ({
      id: entry.id,
      phase: entry.phase,
      problem: entry.problem,
      drafts:
        entry.phase === 'ready'
          ? new Set(
              entry.runs.flatMap((run) =>
                run
                  .getState()
                  .drafts.flatMap((own) => (review.reviewIds.has(own.id) ? [own.id] : [])),
              ),
            ).size
          : 0,
    })),
    dragging,
    history: 'idle',
    finished: Boolean(finish),
  })
  const frozen = saving || reading
  const sourcesShown = entries.length > 0 || Boolean(finish)

  return (
    <div
      ref={root}
      className="import-page unified-import"
      data-layout={sourcesShown ? 'review' : 'empty'}
      onDragEnter={(event) => {
        if (saving || !carriesFiles(event.dataTransfer)) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!carriesFiles(event.dataTransfer)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDragOver={(event) => {
        if (!saving) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (!saving) addFiles([...event.dataTransfer.files])
      }}
    >
      <div className="unified-import-heading">
        <h1>{C.title[locale]}</h1>
        <Button
          variant="ghost"
          aria-label={C.close[locale]}
          disabled={Boolean(closeReason)}
          aria-describedby={closeReason ? (closeInBar ? reasonId : closeReasonId) : undefined}
          onClick={() => router.push('/journal')}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {closeReason && !closeInBar ? (
        <p id={closeReasonId} className="import-hint unified-import-close-reason">
          {closeReason}
        </p>
      ) : null}
      <div className="import-side">
        <SecurityLane model={lane} />
        {finish ? null : (
          <ImportSources
            locale={locale}
            entries={entries}
            session={session}
            saving={saving}
            retryReason={saving ? S.pausedWhileSaving[locale] : unsent ? unsentReason : undefined}
            textOpen={textOpen}
            onTextOpen={setTextOpen}
            onTextPending={setTextPending}
            addFiles={addFiles}
          />
        )}
        {guard.dialog}
        {finish ? null : <StampStrip locale={locale} reach={review.reach} />}
      </div>
      <div className="import-main">
        {finish ? (
          <ImportFinish
            locale={locale}
            finish={finish}
            publication={feedback.status}
            remaining={undecided}
            onReview={() => setFinish(null)}
          />
        ) : (
          <>
            {error ? (
              <p className="import-problem" role="alert">
                <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
                <span>{C.saveFailed[locale]}</span>
              </p>
            ) : null}
            <SharedQuestions
              locale={locale}
              questions={review.shared}
              legs={legById}
              frozen={frozen || dirty.size > 0}
              today={today}
              onAnswer={(answers) => {
                for (const { draft, change: next } of answers) change(draft.id, next)
              }}
              onDefer={(key) => setDeferred((current) => new Set(current).add(key))}
              onDone={() => routeHeading.current?.focus()}
            />
            <RouteView
              locale={locale}
              items={review.route}
              headingRef={routeHeading}
              renderLeg={(leg) => {
                const outcome = outcomes.get(leg.id)
                return (
                  <LegTicket
                    key={leg.id}
                    locale={locale}
                    leg={leg}
                    stored={byId.get(leg.id)!}
                    state={states[leg.id]}
                    outcome={outcome?.status === 'saved' ? undefined : outcome}
                    land={
                      landDone.has(leg.id) && leg.decision === 'land'
                        ? 'saved'
                        : landFailed.has(leg.id)
                          ? 'failed'
                          : undefined
                    }
                    year={review.yearOf.get(leg.id)}
                    airports={review.airportsOf.get(leg.id)}
                    frozen={frozen || outcome?.status === 'uncertain'}
                    today={today}
                    mobile={mobile}
                    onDecide={decide}
                    onChange={change}
                    onDirty={onDirty}
                    onRetry={retry}
                    onDiscard={discard}
                  />
                )
              }}
            />
          </>
        )}
      </div>
      {hasBar ? (
        <FloatingActionBar
          label={S.barLabel[locale]}
          countLabel={
            <span id={reasonId} className="import-hint">
              {reason ?? summary}
            </span>
          }
        >
          <Button
            variant="primary"
            loading={saving}
            loadingLabel={S.saving[locale]}
            disabled={Boolean(reason)}
            aria-describedby={reasonId}
            onClick={() => void (finishOnly ? finishImport() : save())}
          >
            {recordable
              ? rcount(locale, 'addN', recordable)
              : finishOnly
                ? R.done[locale]
                : R.add[locale]}
          </Button>
        </FloatingActionBar>
      ) : null}
    </div>
  )
}
