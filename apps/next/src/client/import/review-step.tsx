'use client'

import { Plus } from '../ui/animated-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatInstantDate, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { Disclosure } from '../ui/disclosure'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { FAILURE, S, count } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Failure } from './import-errors'
import type { Draft } from './import-types'
import { ManualRow } from './manual-row'
import { QuestionDeck } from './question-deck'
import { flightIdentity, newManualRow, type ManualRowState } from './manual-save'
import { ReviewRow } from './review-row'
import { emptyValues, hasValues, isChosen, partition, readiness, validateValues, withUnsent } from './review-model'

export interface ReviewStepProps {
  locale: Locale
  mobile: boolean
  drafts: Draft[]
  saveStates: Record<string, SaveState>
  partial: boolean
  /** The partial result is a cancelled recognition, not a failure. */
  cancelled?: boolean
  failure: Failure | null
  /** When the stored batch is removed (creation plus 30 days); null for a review made only of manual rows. */
  expiresAt?: string | null
  /** The member's calendar day (YYYY-MM-DD) for year suggestions; tests pin it. */
  today?: string
  /** Draft ids whose form holds a typed correction that has not been saved yet. */
  dirty: ReadonlySet<string>
  onDirty: (id: string, dirty: boolean) => void
  manualRows: ManualRowState[]
  onManualRows: (rows: ManualRowState[]) => void
  /** A new empty manual row labelled with the batch on screen, or `solo` without one. */
  makeManualRow?: () => ManualRowState
  onManualRetryOriginal: (key: string) => void
  onManualNewOperation: (key: string) => void
  /** Whether the unresolved save holding a row back is on the page (listed, or owned by a manual row). */
  canShowSave?: (operationId: string) => boolean
  /** Move to that unresolved save. */
  onShowSave?: (operationId: string) => void
  confirming: boolean
  notice?: string | null
  onChange: (draft: Draft, change: DraftChange) => void
  onSelectAll: (drafts: Draft[], selected: boolean) => void
  onRetry: (id: string) => void
  onDiscardEdit: (id: string) => void
  onConfirm: () => void
  onDiscardImport: () => Promise<void>
}

export function ReviewStep(props: ReviewStepProps) {
  const { locale, mobile, drafts, saveStates, partial, cancelled = false, failure, expiresAt = null, today, dirty, onDirty, manualRows, onManualRows, makeManualRow, onManualRetryOriginal, onManualNewOperation, canShowSave, onShowSave, confirming, notice, onChange, onSelectAll, onRetry, onDiscardEdit, onConfirm, onDiscardImport } = props
  const shown = useMemo(() => drafts.map(draft => withUnsent(draft, saveStates[draft.id]?.unsent)), [drafts, saveStates])
  const groups = useMemo(() => partition(shown), [shown])
  const [discard, setDiscard] = useState(false)
  const all = useRef<HTMLInputElement>(null)

  const selectable = groups.active.filter(draft => readiness(draft).length === 0)
  const chosenActive = groups.active.filter(isChosen)
  const chosenDuplicates = groups.duplicates.filter(isChosen)
  // An untouched manual row is ignored; a row with any value must pass the same validation as a draft edit.
  const touched = manualRows.filter(row => hasValues(row.values))
  const validManual = touched.filter(row => Object.keys(validateValues(row.values)).length === 0)
  const invalidManual = touched.length - validManual.length
  const total = chosenActive.length + chosenDuplicates.length + validManual.length
  const unsaved = Object.keys(saveStates).length > 0 || dirty.size > 0
  const everySelected = selectable.length > 0 && selectable.every(isChosen)
  useEffect(() => { if (all.current) all.current.indeterminate = chosenActive.length > 0 && !everySelected }, [chosenActive.length, everySelected])

  const reason = confirming ? undefined : unsaved ? S.unsavedBlock[locale] : invalidManual > 0 ? S.manualInvalid[locale] : total === 0 ? S.nothingChosen[locale] : undefined
  const addManual = () => onManualRows([...manualRows, makeManualRow ? makeManualRow() : newManualRow(emptyValues())])
  const originalOf = (id: string) => drafts.find(draft => draft.id === id)!

  const row = (draft: Draft) => <ReviewRow key={draft.id} locale={locale} draft={draft} stored={originalOf(draft.id)} state={saveStates[draft.id]} mobile={mobile} frozen={confirming} onDirty={onDirty}
    onChange={change => onChange(originalOf(draft.id), change)} onRetry={() => onRetry(draft.id)} onDiscard={() => onDiscardEdit(draft.id)} />

  return <section className="import-review" aria-labelledby="import-review-title">
    <h2 id="import-review-title">{partial ? S.partialTitle[locale] : S.reviewTitle[locale]}</h2>
    {partial ? <p className="import-note" role="status">{cancelled ? S.cancelledNote[locale] : <>{S.partialNote[locale]}{failure ? ` ${FAILURE[failure.kind][locale].title}.` : ''}</>}</p> : null}
    {expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? <p className="import-hint" data-testid="import-retention">{S.retention[locale].replace('{date}', formatInstantDate(locale, expiresAt, 'medium'))}</p> : null}
    {notice ? <p className="import-note" role="status">{notice}</p> : null}
    {confirming ? <p className="import-hint" role="status">{S.pausedWhileSaving[locale]}</p> : null}
    {groups.saved.length > 0 || groups.skipped.length > 0 ? <p className="import-hint">
      {[groups.saved.length ? count(locale, 'alreadySavedN', groups.saved.length) : null, groups.skipped.length ? count(locale, 'skipped', groups.skipped.length) : null].filter(Boolean).join(' · ')}
    </p> : null}

    <QuestionDeck locale={locale} drafts={shown} saveStates={saveStates} readyCount={total} frozen={confirming} today={today}
      onChange={(draft, change) => onChange(originalOf(draft.id), change)} onRetry={onRetry} />

    {groups.active.length > 0 ? <div className="import-select-head">
      <label className="import-check">
        <input ref={all} type="checkbox" checked={everySelected} disabled={selectable.length === 0 || confirming} onChange={event => onSelectAll(selectable, event.target.checked)} />
        <span>{S.selectAll[locale]}</span>
      </label>
      <span className="import-count" aria-live="polite">{count(locale, 'selected', chosenActive.length)} {count(locale, 'ofTotal', groups.active.length)}</span>
    </div> : null}

    {groups.active.length > 0 ? <ul className="import-rows">{groups.active.map(row)}</ul>
      : manualRows.length === 0 && groups.duplicates.length === 0 ? <p className="import-empty">{S.noRowsLeft[locale]}</p> : null}

    {manualRows.length > 0 ? <ul className="import-rows">{manualRows.map(manual =>
      <ManualRow key={manual.key} locale={locale} row={manual} showErrors={hasValues(manual.values)} disabled={confirming} retryBlocked={unsaved ? S.unsavedBlock[locale] : undefined}
        onRetryOriginal={() => onManualRetryOriginal(manual.key)} onNewOperation={() => onManualNewOperation(manual.key)}
        onShowHeld={manual.failure?.heldBy && onShowSave && canShowSave?.(manual.failure.heldBy) ? () => onShowSave(manual.failure!.heldBy!) : undefined}
        // Optional edits keep a date/route hold tied to its original receipt until recovery settles it.
        onChange={values => onManualRows(manualRows.map(item => item.key === manual.key ? { ...item, values, failure: item.failure?.kind === 'refused' || item.failure?.kind === 'duplicate' && flightIdentity(item.values) !== flightIdentity(values) ? undefined : item.failure } : item))}
        onRemove={() => onManualRows(manualRows.filter(item => item.key !== manual.key))} />)}</ul> : null}
    <div className="import-actions"><Button onClick={addManual} disabled={confirming}><Plus size={16} strokeWidth={2} aria-hidden="true" /> {S.addManual[locale]}</Button></div>

    {groups.duplicates.length > 0 ? <Disclosure summary={<span>{S.duplicatesTitle[locale]} · {count(locale, 'duplicates', groups.duplicates.length)}</span>}>
      <p className="import-hint">{S.duplicatesNote[locale]}</p>
      <ul className="import-rows">{groups.duplicates.map(row)}</ul>
    </Disclosure> : null}

    <FloatingActionBar label={S.barLabel[locale]} countLabel={count(locale, 'selected', total)}>
      <Button variant="secondary" disabled={confirming} onClick={() => setDiscard(true)}>{S.cancelImport[locale]}</Button>
      <Button variant="primary" loading={confirming} loadingLabel={S.importing[locale]} disabledReason={reason}
        onClick={onConfirm}>{count(locale, 'importN', total)}</Button>
    </FloatingActionBar>

    <DestructiveConfirm open={discard} onOpenChange={setDiscard} title={S.discardTitle[locale]} consequence={S.discardBody[locale]}
      confirmLabel={S.cancelImport[locale]} cancelLabel={S.discardKeep[locale]} closeLabel={S.close[locale]} errorMessage={S.discardFailed[locale]}
      onConfirm={async () => { await onDiscardImport(); setDiscard(false) }} />
  </section>
}
