'use client'

import { Camera, Upload, X } from '@keyline-icons/react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '../../lib/format'
import { useLocale } from '../preferences'
import { Button } from '../ui/button'
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
import { FAILURE, ROW_FAILURE, S, count } from './copy'
import { UnifiedSession, type RetainedEntry } from './unified-session'

const C = {
  title: { en: 'Import flights', ru: 'Импорт перелётов' },
  choose: { en: 'Choose files', ru: 'Выбрать файлы' },
  more: { en: 'Add files', ru: 'Добавить файлы' },
  photo: { en: 'Take a photo', ru: 'Сфотографировать' },
  paste: { en: 'Paste text', ru: 'Вставить текст' },
  online: {
    en: 'Photos and PDFs may be sent for online recognition.',
    ru: 'Фото и PDF могут быть отправлены на онлайн-распознавание.',
  },
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
    en: 'Reading stopped early. Found flights are retained; try again for the remaining pages.',
    ru: 'Чтение прервано. Найденные перелёты сохранены; повторите чтение остальных страниц.',
  },
  saveFailed: {
    en: 'Couldn’t finish saving. Your remaining flights are kept here.',
    ru: 'Не удалось завершить сохранение. Остальные перелёты остались здесь.',
  },
  confirm: {
    en: 'Saving confirms that you took the past flights. Future flights are saved as bookings.',
    ru: 'Сохраняя, вы подтверждаете прошлые перелёты. Будущие сохраняются как брони.',
  },
  save: { en: 'Save flights', ru: 'Сохранить перелёты' },
  saveOne: { en: 'Save flight', ru: 'Сохранить перелёт' },
  close: { en: 'Close import', ru: 'Закрыть импорт' },
  pending: { en: 'Wait until the files are submitted.', ru: 'Дождитесь отправки файлов.' },
  show: { en: 'Show added flight', ru: 'Показать добавленный перелёт' },
  saved: { en: 'Flights saved', ru: 'Перелёты сохранены' },
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
}: {
  ownerId: string
  locale: Locale
  initialBatchId?: string | null
  initialSource?: 'file' | 'text' | 'pass' | null
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
  const [states, setStates] = useState<Record<string, SaveState>>({})
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const savingNow = useRef(false)
  const [error, setError] = useState(false)
  const [textOpen, setTextOpen] = useState(initialSource === 'text')
  const [text, setText] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
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
        session.add(files)
      }
    }
    document.addEventListener('paste', paste)
    return () => document.removeEventListener('paste', paste)
  }, [session])

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
  const reading = entries.some((entry) => ['queued', 'local', 'online'].includes(entry.phase))
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
    ? S.unsavedBlock[locale]
    : reading
      ? C.pending[locale]
      : chosen.length === 0
        ? S.nothingChosen[locale]
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
          message: C.saved,
          kind: 'success',
          actionLabel: C.show,
          onAction: () => router.push(destination),
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

  return (
    <div
      ref={root}
      className="import-page unified-import"
      onDragOver={(event) => {
        if (!saving) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (!saving) session.add([...event.dataTransfer.files])
      }}
    >
      <div className="unified-import-heading">
        <h1>{C.title[locale]}</h1>
        <Button
          variant="ghost"
          aria-label={C.close[locale]}
          disabledReason={
            saving
              ? S.pausedWhileSaving[locale]
              : unsent
                ? S.unsavedBlock[locale]
                : pendingSource
                  ? C.pending[locale]
                  : undefined
          }
          onClick={() => router.push('/journal')}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      <p className="import-privacy">{C.online[locale]}</p>
      <div className="import-actions">
        <Button
          variant={entries.length ? 'secondary' : 'primary'}
          icon={<Upload size={18} aria-hidden="true" />}
          disabled={saving}
          onClick={() => fileInput.current?.click()}
        >
          {entries.length ? C.more[locale] : C.choose[locale]}
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
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept={ACCEPT}
          multiple
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            session.add([...(event.target.files ?? [])])
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
            {locale === 'ru' ? 'Распознать текст' : 'Read text'}
          </Button>
        </form>
      ) : null}
      <ul className="unified-import-files" aria-live="polite">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="unified-import-file-name">{entry.label || S.title[locale]}</span>
            <span className="import-hint">
              {entry.phase === 'queued' || entry.phase === 'local' || entry.phase === 'online' ? (
                <TextShimmer>
                  {entry.phase === 'online' ? C.onlineReading[locale] : C[entry.phase][locale]}
                </TextShimmer>
              ) : entry.phase === 'failed' ? (
                entry.problem === 'type' ? (
                  S.fileBad[locale]
                ) : entry.problem === 'size' ? (
                  S.fileBig[locale]
                ) : entry.problem === 'partial' ? (
                  C.partial[locale]
                ) : entry.problem === 'reselect' ? (
                  C.reselect[locale]
                ) : entry.runs.find((run) => run.getState().failure)?.getState().failure ? (
                  FAILURE[
                    entry.runs.find((run) => run.getState().failure)!.getState().failure!.kind
                  ][locale].title
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
                  saving ? S.pausedWhileSaving[locale] : unsent ? S.unsavedBlock[locale] : undefined
                }
                onClick={() => session.retry(entry)}
              >
                {C.retry[locale]}
              </Button>
            ) : null}
            {entry.phase === 'failed' && !entry.runs.length ? (
              <Button dense variant="ghost" disabled={saving} onClick={() => session.remove(entry)}>
                {locale === 'ru' ? 'Убрать файл' : 'Remove file'}
              </Button>
            ) : null}
            {entry.phase === 'empty' ? (
              <Link className="ui-button" data-dense="true" href="/add">
                {C.manual[locale]}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
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
                  {outcome.status === 'failed'
                    ? ROW_FAILURE[outcome.failure][locale]
                    : outcome.status === 'uncertain'
                      ? S.uncertainRow[locale]
                      : S.unsentRow[locale]}
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
          {C.saveFailed[locale]}
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
            <span className="import-hint">
              {chosen.length && review.length > 1 ? (
                <span>
                  {count(locale, 'selected', chosen.length)}
                  <br />
                </span>
              ) : null}
              {C.confirm[locale]}
            </span>
          }
        >
          <Button
            variant="primary"
            loading={saving}
            loadingLabel={S.saving[locale]}
            disabledReason={reason}
            onClick={() => void save()}
          >
            {review.length === 1 ? C.saveOne[locale] : C.save[locale]}
          </Button>
        </FloatingActionBar>
      ) : null}
    </div>
  )
}
