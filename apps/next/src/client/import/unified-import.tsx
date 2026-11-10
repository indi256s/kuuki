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
import { DraftSaver, type SaveState } from './draft-saver'
import { patchDraft } from './import-api'
import { useImportRunsStore } from './import-runs'
import { ImportTextarea } from './import-textarea'
import { QuestionDeck } from './question-deck'
import { ReviewRow } from './review-row'
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
import { failureOf } from './batch-run'
import { FAILURE, ROW_FAILURE, S, count } from './copy'
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
  online: {
    en: 'Documents and text are read online. A Flighty file is read on this device.',
    ru: 'Документы и текст распознаются онлайн. Файл Flighty читается на устройстве.',
  },
  drop: {
    en: 'You can also drop or paste files here.',
    ru: 'Файлы можно перетащить или вставить сюда.',
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
    en: 'Choose the file or paste the text again to continue.',
    ru: 'Выберите файл или вставьте текст снова, чтобы продолжить.',
  },
  partial: {
    en: 'Recognition stopped early. Found flights remain for review. Try recognition again.',
    ru: 'Распознавание прервано. Найденные перелёты остались для проверки. Повторите распознавание.',
  },
  saveFailed: {
    en: 'Couldn’t finish saving. Your remaining flights are kept here.',
    ru: 'Не удалось завершить сохранение. Остальные перелёты остались здесь.',
  },
  confirm: {
    en: 'Saving confirms that you took the past flights. Future flights are saved as bookings.',
    ru: 'Сохраняя, вы подтверждаете прошлые перелёты. Будущие сохраняются как брони.',
  },
  confirmPast: {
    en: 'Saving confirms you took these flights.',
    ru: 'Сохраняя, вы подтверждаете, что летели этими рейсами.',
  },
  confirmFuture: { en: 'Saved as bookings.', ru: 'Сохранятся как брони.' },
  reading: {
    en: 'Wait until recognition finishes.',
    ru: 'Дождитесь завершения распознавания.',
  },
  unsentText: {
    en: 'Read or clear the entered text.',
    ru: 'Распознайте или очистите введённый текст.',
  },
  save: { en: 'Save flights', ru: 'Сохранить перелёты' },
  saveOne: { en: 'Save flight', ru: 'Сохранить перелёт' },
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
  } catch {
    /* The server batch remains resumable when browser storage is unavailable. */
  }
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
  /** A Flighty CSV import to restore from the server (`/import?history=`). */
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
        } catch {
          /* The server queue remains available. */
        }
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
  /** CSV files go to the history import (first one only); every other file to the document session. */
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
  /** Everything was saved and the Journal is opening: the lane clears its trays. */
  const [saved, setSaved] = useState(false)
  // The figure shrinks to its band with the first source and keeps that height until the screen is left, even when that source is removed.
  const [banded, setBanded] = useState(false)
  if (entries.length && !banded) setBanded(true)
  /** A file is held over the page. Enter and leave fire for every child, so depth counts them. */
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
  const unsentReason = text.trim() ? C.unsentText[locale] : S.unsavedBlock[locale]
  const guard = useSettingsGuard(unsent, pendingSource || saving, locale)
  useEffect(() => {
    const reset = () => {
      session.stop()
      try {
        sessionStorage.removeItem(`kuuki-import-session:${ownerId}`)
      } catch {
        /* Storage may be unavailable. */
      }
    }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => window.removeEventListener('kuuki:identity-reset', reset)
  }, [session, ownerId])
  useEffect(() => {
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
  }, [addFiles])

  const drafts = withSaved(session.drafts(), session.getOutcomes())
  // The final save carries the owner confirmation. This presentation suppresses only that repeated question.
  const shown = drafts.map((draft) => {
    const updated = withUnsent(draft, states[draft.id]?.unsent)
    return { ...updated, fields: { ...updated.fields, flown_confirmed: true as const } }
  })
  const identities = new Map<string, (typeof shown)[number]>()
  const review = shown
    .filter((draft) => draft.status === 'review')
    .map((draft) => {
      if (!draft.fields.date || !draft.fields.origin || !draft.fields.destination) return draft
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
  const safe = (draft: (typeof review)[number]) =>
    readiness(draft).length === 0 &&
    Object.keys(validateValues(toValues(draft.fields))).length === 0 &&
    (!isDuplicate(draft) || draft.duplicateAcknowledged)
  const implicitSingleton =
    review.length === 1 &&
    !isDuplicate(review[0]) &&
    !session.requiresSelection() &&
    !session.isExcluded(review[0].id)
  const chosen = review.filter((draft) => safe(draft) && (draft.selected || implicitSingleton))
  const selectedIds = new Set(chosen.map((draft) => draft.id))
  const selectable = review.filter(
    (draft) => safe(draft) && session.getOutcomes().get(draft.id)?.status !== 'uncertain',
  )
  const allSelected =
    selectable.length > 0 && selectable.every((draft) => selectedIds.has(draft.id))
  const reading = entries.some((entry) => ['queued', 'local', 'online'].includes(entry.phase))
  const today = localToday()
  const hasPast = chosen.some((draft) => draft.fields.date && draft.fields.date <= today)
  const hasFuture = chosen.some((draft) => draft.fields.date && draft.fields.date > today)
  const confirmation =
    hasPast && hasFuture
      ? C.confirm[locale]
      : hasFuture
        ? C.confirmFuture[locale]
        : hasPast
          ? C.confirmPast[locale]
          : null
  useEffect(() => {
    if (entries.length && !hadSources.current) {
      const active = document.activeElement
      if (active === document.body || sourceActions.current?.contains(active)) {
        moreButton.current?.focus()
      }
    }
    hadSources.current = entries.length > 0
  }, [entries.length])
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
  }, [review.length])
  const reason = unsent
    ? unsentReason
    : reading
      ? C.reading[locale]
      : chosen.length === 0
        ? S.nothingChosen[locale]
        : undefined
  const closeReason = saving
    ? S.pausedWhileSaving[locale]
    : unsent
      ? unsentReason
      : pendingSource
        ? C.pending[locale]
        : undefined
  const save = async () => {
    if (savingNow.current || reason) return
    savingNow.current = true
    setSaving(true)
    setError(false)
    try {
      const acks = await session.save(chosen.map((draft) => draft.id))
      if (acks.length) feedback.acknowledge(acks.at(-1)!)
      const remaining = withSaved(session.drafts(), session.getOutcomes()).some(
        (draft) =>
          draft.status === 'review' &&
          (draft.selected ||
            !safe({ ...draft, fields: { ...draft.fields, flown_confirmed: true } })),
      )
      const failures = entries.some((entry) => entry.phase === 'failed')
      const savedIds = [
        ...new Set(
          withSaved(session.drafts(), session.getOutcomes()).flatMap((draft) =>
            draft.convertedFlightId ? [draft.convertedFlightId] : [],
          ),
        ),
      ]
      if (!remaining && !failures && savedIds.length && !saver.hasUnsaved()) {
        const first = savedIds[0]
        const destination = `/journal?flight=${first}`
        announceShellNotice(ownerId, {
          message: {
            en: count('en', 'savedFlights', savedIds.length),
            ru: count('ru', 'savedFlights', savedIds.length),
          },
          kind: 'success',
        })
        try {
          if (
            !withSaved(session.drafts(), session.getOutcomes()).some(
              (draft) => draft.status === 'review',
            )
          )
            sessionStorage.removeItem(`kuuki-import-session:${ownerId}`)
        } catch {
          /* Server batches remain the authority. */
        }
        setSaved(true)
        router.push(destination)
        router.refresh()
      } else if (remaining) setError(true)
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
  const lane = laneModel({
    entries: entries.map((entry) => ({
      id: entry.id,
      phase: entry.phase,
      problem: entry.problem,
      // Only a ready tray shows its stubs: one per flight this source left for review.
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
    history: 'idle',
    saved,
  })

  return (
    <div
      ref={root}
      className="import-page unified-import"
      onDragEnter={(event) => {
        // Dragged text or links are not sources: only a file transfer reaches the lane.
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
            closeReason
              ? closeReason === reason && review.length
                ? reasonId
                : closeReasonId
              : undefined
          }
          onClick={() => router.push('/journal')}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {closeReason && !(closeReason === reason && review.length) ? (
        <p id={closeReasonId} className="import-hint">
          {closeReason}
        </p>
      ) : null}
      <SecurityLane model={banded ? { ...lane, size: 'band' } : lane} />
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
            {/* Desktop browsers ignore `capture`, so there this would only repeat Choose files. */}
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
            <Button variant="ghost" disabled={saving} onClick={() => flightyInput.current?.click()}>
              {C.flighty[locale]}
            </Button>
          </div>
        )}
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept={`${ACCEPT},.csv,text/csv`}
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
      {guard.dialog}
      {textOpen ? (
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
      <ul className="unified-import-files" aria-live="polite">
        {entries.map((entry) => {
          const failure = entryFailure(entry)
          return (
            <li key={entry.id}>
              <span className="unified-import-file-name" title={entry.label || S.title[locale]}>
                <span>{(entry.label || S.title[locale]).replace(/\.(pdf|png|jpe?g)$/i, '')}</span>
                <span>{entry.label.match(/\.(pdf|png|jpe?g)$/i)?.[0]}</span>
              </span>
              <span className="import-hint">
                {entry.phase === 'queued' || entry.phase === 'local' || entry.phase === 'online' ? (
                  <TextShimmer>
                    {entry.phase === 'online' ? C.onlineReading[locale] : C[entry.phase][locale]}
                  </TextShimmer>
                ) : entry.phase === 'failed' ? (
                  entry.problem === 'type' ? (
                    S.fileBad[locale]
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
              {/* The same file fails the same type or size check again; only another file helps. */}
              {entry.phase === 'failed' && entry.problem !== 'type' && entry.problem !== 'size' ? (
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
      {review.length > 1 ? (
        <div className="import-select-head">
          <Button
            variant="ghost"
            dense
            disabled={saving || reading || unsent || selectable.length === 0}
            onClick={() => {
              for (const draft of selectable) {
                const selected = !allSelected
                if (draft.selected === selected) continue
                session.noteSelection(draft.id, selected)
                void saver.save(
                  drafts.find((item) => item.id === draft.id)!,
                  { selected },
                )
              }
            }}
          >
            {allSelected ? S.aircraftDeselectAll[locale] : S.selectAll[locale]}
          </Button>
          <span className="import-count" aria-live="polite">
            {count(locale, 'selected', chosen.length)} {count(locale, 'ofTotal', review.length)}
          </span>
        </div>
      ) : null}
      <ul className="import-rows unified-import-rows">
        {review.map((draft) => {
          const original = drafts.find((item) => item.id === draft.id)!
          const presented = { ...draft, selected: selectedIds.has(draft.id) }
          const outcome = session.getOutcomes().get(draft.id)
          const unknown = outcome?.status === 'uncertain'
          return (
            <ReviewRow
              key={draft.id}
              locale={locale}
              draft={presented}
              stored={original}
              state={states[draft.id]}
              mobile={false}
              compact
              singleton={review.length === 1}
              implicitSelection={implicitSingleton}
              frozen={saving || unknown || reading}
              onDirty={onDirty}
              onChange={(change) => {
                if (change.selected !== undefined) session.noteSelection(draft.id, change.selected)
                void saver.save(original, change)
              }}
              onRetry={() => {
                void saver.retry(draft.id)
              }}
              onDiscard={() => saver.discard(draft.id)}
            >
              {/* The row's own missing facts are asked inside its card, under the facts they complete. */}
              <QuestionDeck
                compact
                locale={locale}
                drafts={[
                  {
                    ...draft,
                    fields: {
                      ...draft.fields,
                      flown_required: undefined,
                      airline_was_placeholder: undefined,
                    },
                  },
                ]}
                saveStates={states}
                frozen={saving || unknown || reading || dirty.size > 0}
                today={localToday()}
                onChange={(_, change) => {
                  void saver.save(
                    original,
                    session.isExcluded(draft.id) ? { ...change, selected: false } : change,
                  )
                }}
                onRetry={(id) => {
                  void saver.retry(id)
                }}
              />
              {outcome && outcome.status !== 'saved' ? (
                <p className="import-problem" role="status">
                  <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {outcome.status === 'failed'
                      ? ROW_FAILURE[outcome.failure][locale]
                      : outcome.status === 'uncertain'
                        ? S.uncertainRow[locale]
                        : S.unsentRow[locale]}
                  </span>
                </p>
              ) : null}
            </ReviewRow>
          )
        })}
      </ul>
      {drafts
        .filter((draft) => draft.status === 'dismissed' && !session.isSuppressed(draft.id))
        .map((draft) => (
          <Button
            key={draft.id}
            variant="ghost"
            disabled={saving || reading}
            onClick={() => {
              void saver.save(draft, { dismissed: false })
            }}
          >
            {S.statusRestore[locale]} {draft.fields.origin}–{draft.fields.destination}
          </Button>
        ))}
      {error ? (
        <p className="import-problem" role="alert">
          <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          <span>{C.saveFailed[locale]}</span>
        </p>
      ) : null}
      {drafts.some((draft) => draft.status === 'converted') ? (
        <p className="import-hint">
          {count(
            locale,
            'alreadySavedN',
            drafts.filter((draft) => draft.status === 'converted').length,
          )}
        </p>
      ) : null}
      {review.length ? (
        <FloatingActionBar
          label={S.barLabel[locale]}
          countLabel={
            <span id={reasonId} className="import-hint">
              {reason ?? confirmation}
            </span>
          }
        >
          <Button
            variant="primary"
            loading={saving}
            loadingLabel={S.saving[locale]}
            disabled={Boolean(reason)}
            aria-describedby={reason || confirmation ? reasonId : undefined}
            onClick={() => void save()}
          >
            {review.length > 1 && chosen.length > 0
              ? count(locale, 'saveSelected', chosen.length)
              : review.length === 1 || chosen.length === 1
                ? C.saveOne[locale]
                : C.save[locale]}
          </Button>
        </FloatingActionBar>
      ) : null}
    </div>
  )
}
