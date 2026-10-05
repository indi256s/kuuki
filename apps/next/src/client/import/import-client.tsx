'use client'

import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '../../lib/format'
import { useMobile } from '../ui/use-mobile'
import { useWriteFeedback } from '../write-feedback'
import type { AircraftApi } from './aircraft-panel'
import type { AircraftRun, AircraftTarget } from './aircraft-review'
import { runConfirm, type ConfirmOutcome, type RowOutcome } from './confirm-runner'
import { MANUAL_FAILURE, MANUAL_ROW_RETRYABLE, ROW_FAILURE, S } from './copy'
import { DoneStep, rowLabel, type FailedRow, type NewStamp } from './done-step'
import { DraftSaver, type DraftChange, type SaveState } from './draft-saver'
import { FailurePanel } from './failure-panel'
import { fetchPressedCountries, cancelBatch, confirmItems, discardBatch, listUnfinished, patchDraft, type ImportSource } from './import-api'
import type { FailureAction } from './import-errors'
import type { Draft, UnfinishedImport } from './import-types'
import { flightIdentity, newManualRow, retryUnconfirmedSave, saveManualRows, settleUnconfirmedSave, startNewOperation, unconfirmedSaves, type ManualFailure, type ManualRowState, type UnconfirmedSave } from './manual-save'
import { ProgressStep } from './progress-step'
import { emptyValues, hasValues, isChosen, partition, validateValues, withSaved } from './review-model'
import { ReviewStep } from './review-step'
import { newlyPressed, routeCountries, routeKm } from './flight-input'
import { SourceStep } from './source-step'
import { showSave, UnconfirmedSaves } from './unconfirmed-saves'
import { useImportBatch, type BatchApi } from './use-import-batch'

type Step = 'source' | 'processing' | 'review' | 'done'
type Shown = Exclude<Step, 'processing'>
const STEP_ORDER: Shown[] = ['source', 'review', 'done']

function Stepper({ locale, step }: { locale: Locale; step: Step }) {
  const current: Shown = step === 'processing' ? 'source' : step
  const names = { source: S.stepSource[locale], review: S.stepReview[locale], done: S.stepDone[locale] }
  return <ol className="import-steps" aria-label={S.stepsLabel[locale]}>
    {STEP_ORDER.map((name, index) => <li key={name} aria-current={name === current ? 'step' : undefined} data-state={name === current ? 'current' : STEP_ORDER.indexOf(current) > index ? 'done' : 'next'}>
      <span className="import-step-number" aria-hidden="true">{index + 1}</span><span>{names[name]}</span>{name === current ? <span className="sr-only"> ({S.stepCurrent[locale]})</span> : null}
    </li>)}
  </ol>
}

const themeNow = (): 'light' | 'dark' => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
const writeUrl = (batchId: string | null) => window.history.replaceState(window.history.state, '', batchId ? `/import?batch=${batchId}` : '/import')

export function ImportClient({ ownerId, locale, initialBatchId = null, initialSource = null, batchApi, aircraftApi }: {
  ownerId: string; locale: Locale; initialBatchId?: string | null; initialSource?: 'file' | 'text' | null; batchApi?: BatchApi; aircraftApi?: AircraftApi
}) {
  const router = useRouter()
  const feedback = useWriteFeedback(ownerId)
  const mobile = useMobile()
  const batch = useImportBatch({ api: batchApi, initialBatchId, onBatchId: writeUrl })
  const { setDraft } = batch

  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  // Typed but unsaved corrections reported by the rows' forms. Together with the saver's states they gate the import.
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set())
  const onDirty = useCallback((id: string, flag: boolean) => setDirty(previous => {
    if (previous.has(id) === flag) return previous
    const next = new Set(previous)
    if (flag) next.add(id); else next.delete(id)
    return next
  }), [])
  const createSaver = () => new DraftSaver({
    patch: patchDraft,
    onDraft: draft => setDraft(draft),
    onState: (id, state) => setSaveStates(previous => {
      if (state) return { ...previous, [id]: state }
      const rest = { ...previous }; delete rest[id]
      return rest
    }),
  })
  const [saver, setSaver] = useState(createSaver)
  /** Edits belong to one batch: a reset fences the old saver (in-flight answers are dropped) and starts clean. */
  const resetEdits = () => { saver.dispose(); setSaver(createSaver()); setSaveStates({}); setDirty(new Set()) }
  const [manualRows, setManualRows] = useState<ManualRowState[]>([])
  const [manualOnly, setManualOnly] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [rows, setRows] = useState<Map<string, RowOutcome>>(new Map())
  const [manualSaved, setManualSaved] = useState<ManualRowState[]>([])
  const [requestedKeys, setRequestedKeys] = useState<ReadonlySet<string>>(new Set())
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)
  const [unfinished, setUnfinished] = useState<UnfinishedImport[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<'file' | 'text' | null>(initialSource)
  const [sourceKey, setSourceKey] = useState(0)
  const [aircraftSaved, setAircraftSaved] = useState<Set<number>>(new Set())
  // A manual row is labelled with the batch on screen, or `solo` once the member has left it.
  const makeManualRow = () => newManualRow(emptyValues(), !manualOnly && batch.batch ? batch.batch.id : 'solo')
  // Every unresolved create of this member in this browser, whatever batch, screen or version wrote it. It is listed on
  // every step until it is settled; a row of this page that owns one shows its own recovery instead.
  const [receipts, setReceipts] = useState<UnconfirmedSave[]>([])
  const [recoveryFailures, setRecoveryFailures] = useState<Record<string, ManualFailure>>({})
  const [recoveryRetrying, setRecoveryRetrying] = useState<string | null>(null)
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
  const refreshReceipts = useCallback(() => {
    const found = unconfirmedSaves(ownerId)
    setReceipts(found)
  }, [ownerId])
  useEffect(() => { refreshReceipts() }, [refreshReceipts])
  // An explicit "Back to review" wins over showing a completed batch's summary.
  const [reviewing, setReviewing] = useState(false)
  const lastSource = useRef<{ source: ImportSource; operationId: string } | null>(null)
  const settledOperations = useRef(new Set<string>())
  const baseline = useRef<Set<string> | null | undefined>(undefined)
  const stampsFor = useRef(-1)

  // Unsent edits live only in memory; warn before the page goes away with some still unsent.
  const unsent = Object.keys(saveStates).length > 0 || dirty.size > 0
  // The save below awaits several answers; what is unsent when it ends decides whether the review may close.
  const unsentNow = useRef(unsent)
  unsentNow.current = unsent
  const [holdDone, setHoldDone] = useState(false)
  useEffect(() => {
    if (!holdDone || unsent || confirming) return
    setHoldDone(false); setNotice(null); setShowDone(true)
  }, [holdDone, unsent, confirming])
  useEffect(() => {
    if (!unsent) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsent])

  // A confirm answer is authoritative even if the read after it failed, so its saves are laid over the snapshot.
  const drafts = useMemo(() => withSaved(batch.drafts, rows), [batch.drafts, rows])
  const groups = useMemo(() => partition(drafts), [drafts])
  const savedDrafts = useMemo(() => rows.size === 0 ? groups.saved : groups.saved.filter(draft => rows.has(draft.id)), [groups.saved, rows])

  const finishedBatch = batch.phase === 'ready' && batch.batch?.status === 'completed' && rows.size === 0 && !manualOnly && !reviewing
  const step: Step = showDone || finishedBatch ? 'done'
    : manualOnly || (batch.phase === 'ready' && !(batch.partial && batch.drafts.length === 0)) ? 'review'
    : batch.phase === 'processing' || batch.phase === 'starting' ? 'processing' : 'source'
  const failure = step === 'source' && (batch.phase === 'failed' || (batch.phase === 'ready' && batch.partial && batch.drafts.length === 0)) ? batch.failure : null

  // Once a submission produced a stored batch with a known outcome, replaying its operation id only replays that outcome
  // (ADR 0001 section 6), so the next attempt with the same source gets a new id. While the outcome is unknown (the
  // request was lost, or the batch is still running) the id is reused, so no second recognition is started.
  const batchStatus = batch.batch?.status
  useEffect(() => {
    if (batchStatus && batchStatus !== 'processing' && lastSource.current) settledOperations.current.add(lastSource.current.operationId)
  }, [batchStatus])

  const start = useCallback((source: ImportSource, requestedId: string) => {
    const operationId = settledOperations.current.has(requestedId) ? crypto.randomUUID() : requestedId
    lastSource.current = { source, operationId }
    setSourceName(source.sourceLabel ?? null)
    setNotice(null)
    void batch.start(source, operationId)
  }, [batch])

  const reset = useCallback(() => {
    batch.reset(); writeUrl(null); resetEdits()
    setRows(new Map()); setManualRows([]); setManualSaved([]); setManualOnly(false); setShowDone(false); setReviewing(false); setHoldDone(false); setRequestedKeys(new Set())
    setNewCodes(null); setUnfinished(null); setNotice(null); setCheckFailed(false); setAircraftSaved(new Set())
    baseline.current = undefined; stampsFor.current = -1; lastSource.current = null; settledOperations.current.clear()
    setSourceKey(key => key + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, saver])

  const onFailureAction = async (action: FailureAction) => {
    if (action === 'retry') {
      const last = lastSource.current
      if (last) { start(last.source, last.operationId); return }
      // After a reload the document is gone (it is never stored): ask for it again instead of replaying the stored failure.
      const type = batch.batch?.sourceType
      reset(); setSourceMode(type === 'text' ? 'text' : 'file'); setNotice(S.sourceAgain[locale])
    } else if (action === 'manual') {
      batch.reset(); writeUrl(null); resetEdits(); setManualOnly(true); setManualRows([newManualRow(emptyValues(), 'solo')])
    } else if (action === 'otherFile' || action === 'pasteText') {
      reset(); setSourceMode(action === 'otherFile' ? 'file' : 'text')
    } else if (action === 'newImport') reset()
    else {
      try { setUnfinished(await listUnfinished()) } catch { setUnfinished([]) }
    }
  }

  const onChange = useCallback((draft: Draft, change: DraftChange) => { void saver.save(draft, change) }, [saver])
  const onSelectAll = useCallback(async (drafts: Draft[], selected: boolean) => {
    // One draft at a time: each edit is version-checked, and the requests are never fanned out together.
    for (const draft of drafts) if (draft.selected !== selected) await saver.save(draft, { selected })
  }, [saver])

  const onCancelRun = async () => {
    const id = batch.batch?.id
    if (!id) { reset(); return }
    setCancelling(true); setCancelError(null)
    try {
      await cancelBatch(id)
      // Cancelling keeps the rows already extracted: read them back and show them, and leave only when none remain.
      try { const snapshot = await batch.reload(); if (!snapshot || snapshot.drafts.length === 0) reset() } catch { setCancelError(S.cancelReadFailed[locale]) }
    } catch { setCancelError(S.cancelFailed[locale]) } finally { setCancelling(false) }
  }
  const onDiscardImport = async () => {
    const id = batch.batch?.id
    if (id) await discardBatch(id)
    reset()
  }

  const acknowledgeWrites = (acks: Array<{ derived_state?: 'ready' | 'pending'; revision?: number }>) => {
    const last = acks.at(-1) ?? {}
    feedback.acknowledge(last)
    // An answer without derived state cannot start the publication check; still refresh what the server rendered.
    if (!last.derived_state) router.refresh()
  }

  /** Save the given drafts and manual rows. Runs the server confirm sequentially, then re-reads the stored snapshot. */
  const save = async (draftIds: string[], manualKeys: string[], originalKeys: ReadonlySet<string> = new Set()) => {
    // Every path that can leave the review (Import, Retry original save, Done retry) is held back while a correction
    // is typed or unsent: leaving would unmount the form and lose it. The review shows the reason beside the control.
    if (confirming || recoveryRetrying !== null || unsent) return
    setConfirming(true); setCheckFailed(false)
    if (baseline.current === undefined) baseline.current = await fetchPressedCountries()
    const byId = new Map(drafts.map(draft => [draft.id, draft]))
    const items = draftIds.flatMap(id => { const draft = byId.get(id); return draft && draft.status === 'review' ? [{ draftId: id, version: draft.version }] : [] })
    const acks: Array<{ derived_state?: 'ready' | 'pending'; revision?: number }> = []
    let wrote = false
    let outcome: ConfirmOutcome | null = null
    if (items.length > 0 && batch.batch) {
      outcome = await runConfirm({ batchId: batch.batch.id, items, send: confirmItems })
      acks.push(...outcome.acks)
      wrote ||= [...outcome.rows.values()].some(row => row.status === 'saved' || row.status === 'uncertain')
      setRows(previous => { const next = new Map(previous); for (const [id, row] of outcome!.rows) next.set(id, row); return next })
    }
    const manual = manualRows.filter(row => manualKeys.includes(row.key))
    if (manual.length > 0) {
      const result = await saveManualRows(ownerId, manual, originalKeys)
      acks.push(...result.acks)
      wrote ||= result.saved.length > 0
      setManualSaved(previous => [...previous, ...result.saved])
      setManualRows(previous => previous.flatMap(row => result.saved.some(item => item.key === row.key || row.failure?.heldBy === item.operationId && flightIdentity(row.values) === flightIdentity(item.values)) ? [] : [result.rows.get(row.key) ?? row]))
    }
    // The denominator counts each row once, however often it is retried.
    setRequestedKeys(previous => new Set([...previous, ...items.map(item => item.draftId), ...manual.map(row => row.key)]))
    if (wrote) acknowledgeWrites(acks)
    // The stored snapshot is the truth: it settles rows whose answer was lost.
    setChecking(true)
    if (batch.batch) { try { await batch.reload() } catch { setCheckFailed(true) } }
    setChecking(false)
    setConfirming(false)
    refreshReceipts()
    // A correction that appeared while saving would be lost with the form: stay on review until it is saved or discarded.
    if (unsentNow.current) { setHoldDone(true); setNotice(S.heldDone[locale]) } else setShowDone(true)
  }

  const onConfirm = () => {
    const chosen = [...groups.active, ...groups.duplicates].filter(isChosen).map(draft => draft.id)
    const manual = manualRows.filter(row => hasValues(row.values) && Object.keys(validateValues(row.values)).length === 0).map(row => row.key)
    void save(chosen, manual)
  }

  // What is still not saved after the stored snapshot has been read.
  const failures = useMemo<FailedRow[]>(() => {
    const list: FailedRow[] = []
    for (const [id, row] of rows) {
      const draft = batch.drafts.find(item => item.id === id)
      if (!draft || draft.status === 'converted' || row.status === 'saved') continue
      const label = rowLabel(locale, draft.fields)
      if (row.status === 'failed') list.push({ key: id, label, message: ROW_FAILURE[row.failure][locale], retryable: row.retryable })
      else list.push({ key: id, label, message: row.status === 'uncertain' ? S.uncertainRow[locale] : S.unsentRow[locale], retryable: true })
    }
    for (const row of manualRows) if (row.failure) list.push({ key: row.key, label: rowLabel(locale, row.values), message: MANUAL_FAILURE[row.failure.kind][locale], retryable: MANUAL_ROW_RETRYABLE[row.failure.kind] })
    return list
  }, [rows, batch.drafts, manualRows, locale])
  const retryable = failures.filter(item => item.retryable)

  const onManualRetryOriginal = (key: string) => { void save([], [key], new Set([key])) }
  const onManualNewOperation = (key: string) => {
    const row = manualRows.find(item => item.key === key)
    if (!row) return
    const next = startNewOperation(ownerId, row)
    setManualRows(previous => previous.map(item => item.key === key ? next : item.failure?.heldBy === row.operationId ? { ...item, failure: undefined } : item))
    refreshReceipts()
  }

  const shownSaves = receipts.filter(save => step !== 'review' || !manualRows.some(row => row.operationId === save.operationId))
  const saveLabel = (operationId: string) => { const values = receipts.find(save => save.operationId === operationId)?.values; return values ? rowLabel(locale, values) : S.unreadableSave[locale] }
  const forgetRecoveryFailure = (operationId: string) => setRecoveryFailures(previous => { const next = { ...previous }; delete next[operationId]; return next })
  const onRecoveryRetry = async (operationId: string) => {
    if (confirming || recoveryRetrying !== null) return
    const label = saveLabel(operationId)
    setRecoveryRetrying(operationId); setRecoveryNotice(null)
    try {
      const result = await retryUnconfirmedSave(ownerId, operationId, undefined, receipts.find(save => save.operationId === operationId)?.retryKey ?? '')
      if (result.failure) setRecoveryFailures(previous => ({ ...previous, [operationId]: result.failure! }))
      else forgetRecoveryFailure(operationId)
      if (result.saved) {
        const pinned = receipts.find(save => save.operationId === operationId)?.values
        const identity = pinned && flightIdentity(pinned)
        const matches = (row: ManualRowState) => row.operationId === operationId || identity !== null && identity !== undefined && flightIdentity(row.values) === identity && (row.failure?.heldBy === operationId || !row.failure && row.retryKey === undefined)
        const reconciled = manualRows.find(matches)
        if (reconciled) setManualSaved(previous => [...previous, { ...reconciled, values: pinned ?? reconciled.values }])
        setManualRows(previous => previous.filter(row => !matches(row)))
        acknowledgeWrites(result.acks); setRecoveryNotice(S.recoverySaved[locale].replace('{flight}', label))
      }
    } finally {
      setRecoveryRetrying(null)
      refreshReceipts()
    }
  }
  const onRecoverySettle = (operationId: string) => {
    if (confirming || recoveryRetrying !== null) return
    const label = saveLabel(operationId)
    settleUnconfirmedSave(ownerId, operationId)
    setManualRows(previous => previous.map(row => row.operationId === operationId ? startNewOperation(ownerId, row) : row.failure?.heldBy === operationId ? { ...row, failure: undefined } : row))
    forgetRecoveryFailure(operationId)
    setRecoveryNotice(S.recoverySettled[locale].replace('{flight}', label))
    refreshReceipts()
  }

  const onRetry = () => {
    const draftIds = retryable.filter(item => rows.has(item.key)).map(item => item.key)
    const manualKeys = retryable.filter(item => !rows.has(item.key)).map(item => item.key)
    void save(draftIds, manualKeys)
  }

  // New stamps press only after the saves are published; the passport is re-read once and compared with the baseline.
  const savedCount = savedDrafts.length + manualSaved.length
  const touched = useMemo(() => [...savedDrafts.map(draft => draft.fields), ...manualSaved.map(row => row.values)].flatMap(fields => routeCountries(fields.origin, fields.destination)), [savedDrafts, manualSaved])
  useEffect(() => {
    if (feedback.status !== 'ready' || savedCount === 0 || stampsFor.current === savedCount || !baseline.current) return
    stampsFor.current = savedCount
    const before = baseline.current
    let live = true
    void fetchPressedCountries().then(after => { if (live && after) setNewCodes(newlyPressed(before, after, touched)) })
    return () => { live = false }
  }, [feedback.status, savedCount, touched])

  const names = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale])
  const stamps: NewStamp[] = (newCodes ?? []).map(code => ({ code, name: names.of(code) ?? code, eventId: `import:${batch.batch?.id ?? 'manual'}:${code}` }))
  const totalKm = [...savedDrafts.map(draft => draft.fields), ...manualSaved.map(row => row.values)].reduce((sum, fields) => sum + routeKm(fields.origin, fields.destination), 0)

  const aircraftTargets: AircraftTarget[] = savedDrafts.flatMap(draft => draft.convertedFlightId !== null && !draft.fields.aircraft_icao && !aircraftSaved.has(draft.convertedFlightId)
    ? [{ id: draft.convertedFlightId, flight_number: draft.fields.flight_number ?? null, airline_iata: draft.fields.airline_iata || null, date: draft.fields.date, origin: draft.fields.origin, destination: draft.fields.destination }] : [])

  const onAircraftSaved = (run: AircraftRun) => {
    setAircraftSaved(previous => new Set([...previous, ...[...run.rows].filter(([, row]) => row.status === 'saved').map(([id]) => id)]))
    acknowledgeWrites(run.acks)
  }

  return <div className={clsx('import-page', mobile && 'is-mobile')}>
    <div className="page-heading"><p className="eyebrow">{S.eyebrow[locale]}</p><h1>{S.title[locale]}</h1><p className="lead">{S.lead[locale]}</p></div>
    <Stepper locale={locale} step={step} />
    <UnconfirmedSaves locale={locale} saves={shownSaves} failures={recoveryFailures} retrying={recoveryRetrying} paused={confirming} notice={recoveryNotice}
      onRetry={operationId => void onRecoveryRetry(operationId)} onSettle={onRecoverySettle} />
    {step === 'source' ? <>
      {failure ? <FailurePanel failure={failure} locale={locale} onAction={action => void onFailureAction(action)} unfinished={unfinished} /> : null}
      <SourceStep key={sourceKey} locale={locale} busy={false} initialMode={sourceMode} onSubmit={start} notice={notice} />
    </> : null}
    {step === 'processing' ? <ProgressStep locale={locale} batch={batch.batch} drafts={batch.drafts} sourceName={sourceName} onCancel={() => void onCancelRun()} cancelling={cancelling} error={cancelError} /> : null}
    {step === 'review' ? <ReviewStep locale={locale} mobile={mobile === true} drafts={drafts} saveStates={saveStates} partial={batch.partial} cancelled={batch.cancelled} failure={batch.failure}
      expiresAt={batch.batch?.expiresAt ?? null} dirty={dirty} onDirty={onDirty}
      manualRows={manualRows} onManualRows={setManualRows} makeManualRow={makeManualRow} onManualRetryOriginal={onManualRetryOriginal} onManualNewOperation={onManualNewOperation}
      canShowSave={operationId => receipts.some(save => save.operationId === operationId)} onShowSave={showSave} confirming={confirming || recoveryRetrying !== null} notice={notice}
      onChange={onChange} onSelectAll={(drafts, selected) => void onSelectAll(drafts, selected)} onRetry={id => void saver.retry(id)} onDiscardEdit={id => saver.discard(id)}
      onConfirm={onConfirm} onDiscardImport={onDiscardImport} /> : null}
    {step === 'done' ? <DoneStep locale={locale} savedCount={savedCount} requested={requestedKeys.size} totalKm={totalKm}
      newCountries={newCodes === null ? null : newCodes.length} stamps={stamps} publication={feedback.status}
      failures={failures} retryCount={retryable.length} retryBlocked={unsent ? S.unsavedDone[locale] : undefined} retrying={confirming || recoveryRetrying !== null} checking={checking} checkFailed={checkFailed}
      remaining={groups.active.length + groups.duplicates.length + manualRows.length} aircraftTargets={aircraftTargets} aircraftApi={aircraftApi} theme={themeNow()}
      onRetry={onRetry} onReview={() => { setShowDone(false); setReviewing(true) }} onImportMore={reset} onAircraftSaved={onAircraftSaved} /> : null}
  </div>
}
