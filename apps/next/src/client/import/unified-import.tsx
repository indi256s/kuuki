'use client'

import { Camera, Clipboard, Upload, X, CircleAlert } from '@keyline-icons/react'
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '../../lib/format'
import { useLocale } from '../preferences'
import { Button } from '../ui/button'
import { Menu, MenuItem } from '../ui/menu'
import { ChevronIcon } from '../ui/icon-morph'
import { NavigationLink as Link } from '../navigation-link'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { TextShimmer } from '../ui/text-shimmer'
import { announceShellNotice } from '../shell-notices'
import { useWriteFeedback } from '../write-feedback'
import { useSettingsGuard } from '../account/settings-guard'
import { DraftSaver, type DraftChange, type SaveState } from './draft-saver'
import { patchDraft } from './import-api'
import { useImportRunsStore } from './import-runs'
import { ImportTextarea } from './import-textarea'
import {
  localToday,
  readiness,
  toValues,
  validateValues,
  withSaved,
  withUnsent,
  isDuplicate,
} from './review-model'
import { ACCEPT } from './source-step'
import { addGroundVisit } from '@kuuki/client/passport'
import type { DerivedAck } from '@kuuki/client/derivedState'
import type { RowOutcome } from './confirm-runner'
import type { Draft } from './import-types'
import { fetchPressedCountries } from './import-api'
import { newlyPressed, routeCountries, routeKm } from './flight-input'
import {
  buildQuestions,
  questionDrafts,
  type AirportQuestion,
  type YearQuestion,
} from './questions'
import {
  buildRoute,
  decisionChange,
  landVisits,
  legOf,
  stampReach,
  type Decision,
  type Leg,
} from './route-model'
import { R, rcount } from './route-copy'
import { RouteView } from './route-view'
import { LegTicket } from './leg-ticket'
import { SharedQuestions } from './shared-questions'
import { StampStrip } from './stamp-strip'
import { ImportFinish, type Finish } from './import-finish'
import { failureOf } from './batch-run'
import { NOMADS_ACCEPT } from './nomads-json'
import { NomadsNote } from './nomads-note'
import { FAILURE, S, count } from './copy'
import { UnifiedSession, type RetainedEntry, type SessionEntry } from './unified-session'
import { HistoryImport } from './history-import'
import { HistorySession, isHistoryCsv } from './history-session'
import { laneModel } from './lane/lane-model'
import { SecurityLane } from './lane/security-lane'
import { carriesFiles } from '../welcome/flights/clipboard'

const C = {
  title: { en: 'Import flights', ru: 'Импорт перелётов' },
  choose: { en: 'Choose files', ru: 'Выбрать файлы' },
  more: { en: 'Add files', ru: 'Добавить файлы' },
  moreSources: { en: 'Add more', ru: 'Добавить ещё' },
  photo: { en: 'Take a photo', ru: 'Сфотографировать' },
  paste: { en: 'Paste text', ru: 'Вставить текст' },
  flighty: { en: 'Flighty history', ru: 'История из Flighty' },
  nomads: { en: 'Nomads.com trips', ru: 'Поездки из Nomads.com' },
  nomadsBad: {
    en: 'This file does not look like a Nomads.com trips export.',
    ru: 'Этот файл не похож на экспорт поездок из Nomads.com.',
  },
  online: {
    en: 'Documents and text are read online. Flighty and Nomads.com files are read on this device.',
    ru: 'Документы и текст распознаются онлайн. Файлы Flighty и Nomads.com читаются на устройстве.',
  },
  drop: {
    en: 'Drop or paste files here.',
    ru: 'Перетащите или вставьте файлы сюда.',
  },
  tooBig: {
    en: 'The file is over 10 MB. Same as liquids: it stays behind.',
    ru: 'Файл больше 10 МБ. С жидкостями так же: не пронесёте.',
  },
  removeFile: { en: 'Remove file', ru: 'Убрать файл' },
  readText: { en: 'Read text', ru: 'Распознать текст' },
  queued: { en: 'Waiting to read', ru: 'Ожидает чтения' },
  local: { en: 'Reading barcode', ru: 'Чтение штрихкода' },
  onlineReading: { en: 'Reading document online', ru: 'Распознавание документа' },
  ready: { en: 'Ready to review', ru: 'Готово к проверке' },
  empty: { en: 'No flights found', ru: 'Перелёты не найдены' },
  manual: { en: 'Enter manually', ru: 'Ввести вручную' },
  retry: { en: 'Try again', ru: 'Повторить' },
  reselect: {
    en: 'Choose the file or paste the text again.',
    ru: 'Выберите файл или вставьте текст снова.',
  },
  partial: {
    en: 'Reading stopped early. Found flights are kept.',
    ru: 'Чтение прервалось. Найденные перелёты остались.',
  },
  saveFailed: {
    en: 'Couldn’t finish saving. Your remaining flights are kept here.',
    ru: 'Не удалось завершить сохранение. Остальные перелёты остались здесь.',
  },
  reading: {
    en: 'Wait until recognition finishes.',
    ru: 'Дождитесь завершения распознавания.',
  },
  unsentText: {
    en: 'Read or clear the entered text.',
    ru: 'Распознайте или очистите введённый текст.',
  },
  close: { en: 'Close import', ru: 'Закрыть импорт' },
  pending: { en: 'Wait until the files are submitted.', ru: 'Дождитесь отправки файлов.' },
} as const

const entryFailure = (entry: SessionEntry) =>
  entry.runs.map((run) => failureOf(run.getState())).find((failure) => failure !== null)

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
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false)
  const [text, setText] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const sourceActions = useRef<HTMLDivElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  const hadSources = useRef(false)
  const reasonId = useId()
  const closeReasonId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const nomadsInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const flightyInput = useRef<HTMLInputElement>(null)
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
  const unsent = dirty.size > 0 || Object.keys(states).length > 0 || text.trim().length > 0
  const unsentReason = text.trim() ? C.unsentText[locale] : R.unsaved[locale]
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
  const outcomes = session.getOutcomes()
  const drafts = withSaved(session.drafts(), outcomes)
  const landIds = session.landIds()
  const landDone = session.landDoneIds()
  const shown = drafts.map((draft) => {
    const updated = withUnsent(draft, states[draft.id]?.unsent)
    return {
      ...updated,
      fields: {
        ...updated.fields,
        flown_confirmed: true as const,
        airline_was_placeholder: undefined,
      },
    }
  })
  const identities = new Map<string, (typeof shown)[number]>()
  const presented = shown
    .filter(
      (draft) =>
        draft.status === 'review' ||
        draft.status === 'converted' ||
        (draft.status === 'dismissed' && !session.isSuppressed(draft.id)),
    )
    .map((draft) => {
      if (
        draft.status !== 'review' ||
        !draft.fields.date ||
        !draft.fields.origin ||
        !draft.fields.destination
      )
        return draft
      const key = `${draft.fields.date}:${draft.fields.origin}:${draft.fields.destination}`
      const prior = identities.get(key)
      if (!prior) {
        identities.set(key, draft)
        return draft
      }
      return {
        ...draft,
        duplicateFlightId: draft.duplicateFlightId ?? -1,
        selected: draft.selected && draft.duplicateAcknowledged,
      }
    })
  const review = presented.filter((draft) => draft.status === 'review')
  const safe = (draft: Draft) =>
    readiness(draft).length === 0 &&
    Object.keys(validateValues(toValues(draft.fields))).length === 0 &&
    (!isDuplicate(draft) || draft.duplicateAcknowledged)
  const implicitSingleton =
    review.length === 1 &&
    !isDuplicate(review[0]) &&
    !session.requiresSelection() &&
    !session.isExcluded(review[0].id)
  const legs = presented.map((draft) =>
    legOf(draft, landIds, implicitSingleton && draft.id === review[0].id),
  )
  const legById = new Map(legs.map((leg) => [leg.id, leg]))
  const chosen = review.filter((draft) => legById.get(draft.id)?.decision === 'flew' && safe(draft))
  const visits = landVisits(legs).filter((visit) => !landDone.has(visit.id))
  const blanks = legs.filter(
    (leg) =>
      leg.decision === 'flew' && !leg.saved && leg.draft.status === 'review' && !safe(leg.draft),
  ).length
  const undecided = legs.filter((leg) => !leg.saved && leg.decision === null).length
  const flights = chosen.length
  const recordable = flights + visits.length
  const questions = buildQuestions(review, today).filter(
    (question): question is YearQuestion | AirportQuestion =>
      question.kind === 'year' || question.kind === 'airport',
  )
  const shared = questions.filter(
    (question) => questionDrafts(question).length >= 2 && !deferred.has(question.key),
  )
  const sharedKeys = new Set(shared.map((question) => question.key))
  const own = questions.filter((question) => !sharedKeys.has(question.key))
  const yearFor = (id: string) =>
    own.find(
      (question): question is YearQuestion =>
        question.kind === 'year' && question.drafts.some((draft) => draft.id === id),
    )
  const airportsFor = (id: string) =>
    own.filter(
      (question): question is AirportQuestion =>
        question.kind === 'airport' && question.items.some((item) => item.draft.id === id),
    )
  const route = buildRoute(legs)
  const reach = stampReach(legs)
  const reading = entries.some((entry) => ['queued', 'local', 'online'].includes(entry.phase))
  useEffect(() => {
    if (entries.length && !hadSources.current) {
      const active = document.activeElement
      if (active === document.body || sourceActions.current?.contains(active)) {
        moreButton.current?.focus()
      }
    }
    hadSources.current = entries.length > 0
  }, [entries.length])
  const hasBar = legs.length > 0 && !finish
  useEffect(() => {
    const bar = root.current?.querySelector<HTMLElement>('.ui-action-bar')
    if (!bar) return
    const property = '--import-footer-height'
    const keyboard = '--import-keyboard-inset'
    const viewport = window.visualViewport
    const update = () => {
      document.documentElement.style.setProperty(
        property,
        `${bar.getBoundingClientRect().height}px`,
      )
      const inset =
        viewport && viewport.scale === 1
          ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
          : 0
      document.documentElement.style.setProperty(keyboard, `${inset}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      observer.disconnect()
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      document.documentElement.style.removeProperty(property)
      document.documentElement.style.removeProperty(keyboard)
    }
  }, [hasBar])
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
  const recorded =
    [...outcomes.values()].some((outcome) => outcome.status === 'saved') || landDone.size > 0
  const finishOnly = recordable === 0 && blanks === 0 && recorded
  const reason = unsent
    ? unsentReason
    : reading
      ? C.reading[locale]
      : recordable === 0 && !finishOnly
        ? blanks
          ? rcount(locale, 'notReady', blanks)
          : legs.some((leg) => leg.decision === 'land' && !landDone.has(leg.id) && !leg.saved)
            ? R.sameCountry[locale]
            : R.nothing[locale]
        : undefined
  const closeReason = saving
    ? S.pausedWhileSaving[locale]
    : unsent
      ? unsentReason
      : pendingSource
        ? C.pending[locale]
        : undefined
  const summary = [
    flights ? rcount(locale, 'flights', flights) : null,
    visits.length ? rcount(locale, 'land', visits.length) : null,
    blanks ? rcount(locale, 'notReady', blanks) : null,
    undecided ? rcount(locale, 'open', undecided) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const change = (id: string, next: DraftChange) => {
    const original = drafts.find((item) => item.id === id)
    if (!original) return
    void saver.save(original, next)
  }
  const decide = (leg: Leg, decision: Decision) => {
    const original = drafts.find((item) => item.id === leg.id)
    if (!original) return
    session.noteLand(leg.id, decision === 'land')
    session.noteSelection(leg.id, decision === 'flew')
    const next = decisionChange(leg.draft, decision)
    if (next) void saver.save(original, next)
  }

  const save = async () => {
    if (savingNow.current || reason) return
    savingNow.current = true
    setSaving(true)
    setError(false)
    baseline.current ??= fetchPressedCountries()
    const before = baseline.current
    const pending = visits
    try {
      const acks: DerivedAck[] = chosen.length
        ? await session.save(chosen.map((draft) => draft.id))
        : []
      const failedLand = new Set<string>()
      for (const visit of pending) {
        try {
          const result = await addGroundVisit(
            ownerId,
            visit.countryCode,
            { visitYear: visit.visitYear, entryMethod: 'land' },
            visit.id,
          )
          session.noteLandDone(visit.id)
          acks.push({ derived_state: result.derived_state, revision: result.revision })
        } catch {
          failedLand.add(visit.id)
        }
      }
      setLandFailed(failedLand)
      const latest =
        acks
          .filter((ack) => ack.derived_state === 'pending')
          .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0))[0] ?? acks.at(-1)
      if (latest) feedback.acknowledge(latest)
      const after = withSaved(session.drafts(), session.getOutcomes())
      const savedOutcomes = [...session.getOutcomes()].filter(
        (entry): entry is [string, Extract<RowOutcome, { status: 'saved' }>] =>
          entry[1].status === 'saved',
      )
      const failed = [...session.getOutcomes()].some(
        ([id, outcome]) =>
          outcome.status !== 'saved' &&
          after.some((draft) => draft.id === id && draft.status === 'review'),
      )
      const waiting = after.some(
        (draft) =>
          draft.status === 'review' &&
          draft.selected &&
          !safe({ ...draft, fields: { ...draft.fields, flown_confirmed: true } }),
      )
      const sources = entries.some((entry) => entry.phase === 'failed')
      if (failed || failedLand.size || sources) setError(failed || failedLand.size > 0)
      else if (!waiting && !saver.hasUnsaved()) {
        const landSaved = session.landDoneIds()
        const savedDrafts = after.filter((draft) => savedOutcomes.some(([id]) => id === draft.id))
        const touched = [
          ...new Set([
            ...savedDrafts.flatMap((draft) =>
              routeCountries(draft.fields.origin, draft.fields.destination),
            ),
            ...legs.flatMap((leg) =>
              landSaved.has(leg.id) && leg.destination.country ? [leg.destination.country] : [],
            ),
          ]),
        ]
        const flightCount = savedOutcomes.length
        const landCount = landSaved.size
        announceShellNotice(ownerId, {
          message: flightCount
            ? {
                en: count('en', 'savedFlights', flightCount),
                ru: count('ru', 'savedFlights', flightCount),
              }
            : {
                en: rcount('en', 'landSavedNotice', landCount),
                ru: rcount('ru', 'landSavedNotice', landCount),
              },
          kind: 'success',
        })
        try {
          if (!after.some((draft) => draft.status === 'review'))
            sessionStorage.removeItem(`kuuki-import-session:${ownerId}`)
        } catch {}
        window.history.replaceState(window.history.state, '', '/import')
        setFinish({
          id: crypto.randomUUID(),
          flights: flightCount,
          km: savedDrafts.reduce(
            (total, draft) => total + routeKm(draft.fields.origin, draft.fields.destination),
            0,
          ),
          land: landCount,
          firstFlightId: savedOutcomes[0]?.[1].flightId ?? null,
          touched,
          before: await before,
          stamps: touched.length ? null : [],
        })
      }
    } catch {
      setError(true)
    } finally {
      savingNow.current = false
      setSaving(false)
    }
  }

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

  const reviewIds = new Set(review.map((draft) => draft.id))
  const laneInput = {
    entries: entries.map((entry) => ({
      id: entry.id,
      phase: entry.phase,
      problem: entry.problem,
      drafts:
        entry.phase === 'ready'
          ? new Set(
              entry.runs.flatMap((run) =>
                run.getState().drafts.flatMap((own) => (reviewIds.has(own.id) ? [own.id] : [])),
              ),
            ).size
          : 0,
    })),
    dragging,
    history: 'idle' as const,
    saved: Boolean(finish),
    finished: Boolean(finish),
  }
  const lane = laneModel(laneInput)
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
          aria-describedby={
            closeReason ? (closeReason === reason && hasBar ? reasonId : closeReasonId) : undefined
          }
          onClick={() => router.push('/journal')}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {closeReason && !(closeReason === reason && hasBar) ? (
        <p id={closeReasonId} className="import-hint unified-import-close-reason">
          {closeReason}
        </p>
      ) : null}
      <div className="import-side">
        <SecurityLane model={lane} />
        {finish ? null : (
          <div ref={sourceActions} className="unified-import-sources">
            {entries.length ? (
              <Menu
                open={sourceMenuOpen && !saving}
                onOpenChange={(open) => setSourceMenuOpen(open && !saving)}
                trigger={
                  <Button ref={moreButton} variant="ghost" disabled={saving}>
                    {C.moreSources[locale]} <ChevronIcon size={16} aria-hidden="true" />
                  </Button>
                }
              >
                <MenuItem disabled={saving} onSelect={() => fileInput.current?.click()}>
                  <Upload size={18} aria-hidden="true" />
                  {C.more[locale]}
                </MenuItem>
                <MenuItem disabled={saving} onSelect={() => cameraInput.current?.click()}>
                  <Camera className="unified-import-camera" size={18} aria-hidden="true" />
                  {C.photo[locale]}
                </MenuItem>
                <MenuItem disabled={saving} onSelect={() => setTextOpen(true)}>
                  <Clipboard size={18} aria-hidden="true" />
                  {C.paste[locale]}
                </MenuItem>
              </Menu>
            ) : (
              <div className="import-actions unified-import-source-actions">
                <Button
                  variant="primary"
                  icon={<Upload size={18} aria-hidden="true" />}
                  disabled={saving}
                  onClick={() => fileInput.current?.click()}
                >
                  {C.choose[locale]}
                </Button>
                <Button
                  className="unified-import-camera"
                  icon={<Camera size={18} aria-hidden="true" />}
                  disabled={saving}
                  onClick={() => cameraInput.current?.click()}
                >
                  {C.photo[locale]}
                </Button>
                <Button variant="ghost" disabled={saving} onClick={() => setTextOpen(!textOpen)}>
                  {C.paste[locale]}
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => flightyInput.current?.click()}
                >
                  {C.flighty[locale]}
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => nomadsInput.current?.click()}
                >
                  {C.nomads[locale]}
                </Button>
              </div>
            )}
            <input
              ref={nomadsInput}
              className="sr-only"
              type="file"
              accept={NOMADS_ACCEPT}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                session.add([...(event.target.files ?? [])])
                event.target.value = ''
              }}
            />
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept={`${ACCEPT},.csv,text/csv,${NOMADS_ACCEPT}`}
              multiple
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                addFiles([...(event.target.files ?? [])])
                event.target.value = ''
              }}
            />
            <input
              ref={cameraInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                session.add([...(event.target.files ?? [])])
                event.target.value = ''
              }}
            />
            <input
              ref={flightyInput}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                addFiles([...(event.target.files ?? [])])
                event.target.value = ''
              }}
            />
            <div className="unified-import-notes" data-empty={entries.length ? undefined : true}>
              <p className="import-privacy">{C.online[locale]}</p>
              {entries.length ? null : (
                <p className="import-privacy unified-import-drop">{C.drop[locale]}</p>
              )}
            </div>
          </div>
        )}
        {guard.dialog}
        {textOpen && !finish ? (
          <form
            className="unified-import-text"
            onSubmit={(event) => {
              event.preventDefault()
              if (!text.trim() || saving) return
              session.addText(text.trim(), C.paste[locale])
              setText('')
              setTextOpen(false)
            }}
          >
            <ImportTextarea
              label={C.paste[locale]}
              value={text}
              maxLength={100000}
              disabled={saving}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit" disabled={!text.trim() || saving}>
              {C.readText[locale]}
            </Button>
          </form>
        ) : null}
        {finish ? null : (
          <ul className="unified-import-files" aria-live="polite">
            {entries.map((entry) => {
              const failure = entryFailure(entry)
              return (
                <li key={entry.id}>
                  <span className="unified-import-file-name" title={entry.label || S.title[locale]}>
                    <span>
                      {(entry.label || S.title[locale]).replace(/\.(pdf|png|jpe?g)$/i, '')}
                    </span>
                    <span>{entry.label.match(/\.(pdf|png|jpe?g)$/i)?.[0]}</span>
                  </span>
                  {entry.nomads && (entry.phase === 'ready' || entry.phase === 'empty') ? (
                    <NomadsNote
                      locale={locale}
                      summary={entry.nomads}
                      empty={entry.phase === 'empty'}
                    />
                  ) : (
                    <span className="import-hint">
                      {entry.phase === 'queued' ||
                      entry.phase === 'local' ||
                      entry.phase === 'online' ? (
                        <TextShimmer>
                          {entry.phase === 'online'
                            ? C.onlineReading[locale]
                            : C[entry.phase][locale]}
                        </TextShimmer>
                      ) : entry.phase === 'failed' ? (
                        entry.problem === 'type' ? (
                          S.fileBad[locale]
                        ) : entry.problem === 'nomads' ? (
                          C.nomadsBad[locale]
                        ) : entry.problem === 'size' ? (
                          C.tooBig[locale]
                        ) : entry.problem === 'partial' ? (
                          C.partial[locale]
                        ) : entry.problem === 'reselect' ? (
                          C.reselect[locale]
                        ) : failure ? (
                          FAILURE[failure.kind][locale].title
                        ) : (
                          S.fileRead[locale]
                        )
                      ) : (
                        C[entry.phase][locale]
                      )}
                    </span>
                  )}
                  {entry.phase === 'failed' &&
                  entry.problem !== 'type' &&
                  entry.problem !== 'size' ? (
                    <Button
                      dense
                      disabledReason={
                        saving ? S.pausedWhileSaving[locale] : unsent ? unsentReason : undefined
                      }
                      onClick={() => session.retry(entry)}
                    >
                      {C.retry[locale]}
                    </Button>
                  ) : null}
                  {entry.phase === 'failed' && !entry.runs.length ? (
                    <Button
                      dense
                      variant="ghost"
                      disabled={saving}
                      onClick={() => session.remove(entry)}
                    >
                      {C.removeFile[locale]}
                    </Button>
                  ) : null}
                  {entry.phase === 'empty' ? (
                    <Link className="ui-button" data-dense="true" href="/add">
                      {C.manual[locale]}
                    </Link>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {finish ? null : <StampStrip locale={locale} reach={reach} />}
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
              questions={shared}
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
              items={route}
              headingRef={routeHeading}
              renderLeg={(leg) => {
                const outcome = outcomes.get(leg.id)
                const original = drafts.find((item) => item.id === leg.id)!
                return (
                  <LegTicket
                    key={leg.id}
                    locale={locale}
                    leg={leg}
                    stored={original}
                    state={states[leg.id]}
                    outcome={outcome?.status === 'saved' ? undefined : outcome}
                    land={
                      landDone.has(leg.id) && leg.decision === 'land'
                        ? 'saved'
                        : landFailed.has(leg.id)
                          ? 'failed'
                          : undefined
                    }
                    year={leg.draft.status === 'review' ? yearFor(leg.id) : undefined}
                    airports={leg.draft.status === 'review' ? airportsFor(leg.id) : []}
                    frozen={frozen || outcome?.status === 'uncertain'}
                    today={today}
                    onDecide={(decision) => decide(leg, decision)}
                    onChange={(next) => change(leg.id, next)}
                    onDirty={onDirty}
                    onRetry={() => {
                      void saver.retry(leg.id)
                    }}
                    onDiscard={() => saver.discard(leg.id)}
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
            onClick={() => void save()}
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
