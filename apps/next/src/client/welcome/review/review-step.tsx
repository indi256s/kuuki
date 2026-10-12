'use client'

import { Check } from '@keyline-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { formatCount, formatNumber } from '../../../lib/format'
import { runConfirm, retryableIds, type RowOutcome } from '../../import/confirm-runner'
import { DraftSaver, type DraftChange, type SaveState } from '../../import/draft-saver'
import { confirmItems, patchDraft } from '../../import/import-api'
import type { Draft } from '../../import/import-types'
import { answerRestore } from '../../import/questions'
import { ReviewRow } from '../../import/review-row'
import { withSaved } from '../../import/review-model'
import { useImportBatch } from '../../import/use-import-batch'
import { Button } from '../../ui/button'
import { useMobile } from '../../ui/use-mobile'
import { foundOf } from '../found'
import type { Found, SavedSummary, StepProps } from '../types'
import '../../../app/(member)/import/import.css'
import { COPY, flightsForms, saveForms, saveShortForms, showAllForms } from './copy'
import { DASH, factOf, flightText, group, isUpcoming, kindOf, routeText, shownDraft } from './rows'
import { UnsureCard } from './unsure-card'
import './review.css'

const PREVIEW_ROWS = 7

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
const readOnline = () => navigator.onLine !== false
const serverOnline = () => true

/** Keep the newer of two copies of a draft, the same rule the batch hook applies to per-row updates. */
function keepNewer(store: Map<string, Draft>, draft: Draft) {
  const known = store.get(draft.id)
  if (!known || draft.version >= known.version) store.set(draft.id, draft)
}

export function ReviewStep({
  locale,
  headingRef,
  batch,
  onSaved,
  onStartEmpty,
  onFound,
}: StepProps & {
  batch: string
  onSaved: (summary: SavedSummary) => void
  /** "Start empty" when nothing is left to save: behaves like "I'll do this later". */
  onStartEmpty: () => Promise<void>
  /** Flights and countries that Save would keep, for the passport. */
  onFound: (found: Found) => void
}) {
  const t = (entry: { en: string; ru: string }) => entry[locale]
  const mobile = useMobile() === true
  const online = useSyncExternalStore(subscribeOnline, readOnline, serverOnline)
  const state = useImportBatch({ initialBatchId: batch })
  const { setDraft, reload } = state

  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set())
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, RowOutcome>>(new Map())
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [emptying, setEmptying] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [expanded, setExpanded] = useState(false)
  const [reloading, setReloading] = useState(false)
  const active = useRef(true)
  // Rows the server refused on Save: unsure again until the member changes them or leaves them out.
  const [rejected, setRejected] = useState<ReadonlySet<string>>(new Set())
  // Latest copy of every draft, so a save started right after an edit sees the version the edit returned.
  const store = useRef(new Map<string, Draft>())
  const pending = useRef(new Set<Promise<void>>())
  const retry = useRef<string[] | null>(null)
  const busy = useRef(false)
  const unsureList = useRef<HTMLUListElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  // Set when an action is taken inside an unsure card that holds focus: where focus goes once that card is gone.
  const refocus = useRef<{ id: string; ids: string[] } | null>(null)

  const [saver] = useState(
    () =>
      new DraftSaver({
        patch: patchDraft,
        onDraft: (draft) => {
          if (!active.current) return
          keepNewer(store.current, draft)
          setDraft(draft)
        },
        onState: (id, next) =>
          setSaveStates((previous) => {
            if (next) return { ...previous, [id]: next }
            const rest = { ...previous }
            delete rest[id]
            return rest
          }),
      }),
  )

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      // Allow React's effect replay to reactivate before retiring the saver.
      queueMicrotask(() => {
        if (!active.current) saver.dispose()
      })
    }
  }, [saver])

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

  const stored = useMemo(() => withSaved(state.drafts, outcomes), [state.drafts, outcomes])
  useEffect(() => {
    for (const draft of state.drafts) keepNewer(store.current, draft)
  }, [state.drafts])
  const shown = useMemo(
    () => stored.map((draft) => shownDraft(draft, saveStates[draft.id]?.unsent)),
    [stored, saveStates],
  )
  const groups = useMemo(() => group(shown, rejected), [shown, rejected])
  const included = useMemo(() => [...groups.right, ...groups.saved], [groups])
  const total = shown.length
  const unsure = groups.unsure.length
  const left = groups.left.length
  const chosen = included.length

  // The passport counts what Save would keep.
  const signature = included.map((draft) => draft.id).join(',')
  const sent = useRef<string | null>(null)
  useEffect(() => {
    if (state.drafts.length === 0 || sent.current === signature) return
    sent.current = signature
    onFound(foundOf(included.map(factOf)))
    // `included` is keyed by `signature`: the passport follows the set, not each re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, state.drafts.length, onFound])

  // Resolving an unsure card removes it, and with it the control that had focus: hand focus to the next card.
  const unsureIds = groups.unsure.map((draft) => draft.id)
  const unsureKey = unsureIds.join(',')
  useEffect(() => {
    const target = refocus.current
    if (!target || unsureIds.includes(target.id)) return
    refocus.current = null
    const lost = !document.activeElement || document.activeElement === document.body
    if (!lost) return
    const after = target.ids.slice(target.ids.indexOf(target.id) + 1)
    const nextId = [...after, ...target.ids.slice(0, target.ids.indexOf(target.id)).reverse()].find(
      (id) => unsureIds.includes(id),
    )
    const card = nextId ? unsureList.current?.children[unsureIds.indexOf(nextId)] : null
    const action = card?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')
    const save = bar.current?.querySelector<HTMLElement>('button:not(:disabled)')
    ;(action ?? save ?? headingRef.current)?.focus()
    // `unsureIds` is keyed by `unsureKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsureKey, headingRef])

  function queue(id: string, change: DraftChange) {
    const current = store.current.get(id)
    if (!current) return
    if (rejected.has(id))
      setRejected((previous) => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
    const index = unsureIds.indexOf(id)
    const card = index >= 0 ? unsureList.current?.children[index] : null
    if (card?.contains(document.activeElement)) refocus.current = { id, ids: unsureIds }
    const promise = saver.save(current, change)
    pending.current.add(promise)
    void promise.finally(() => pending.current.delete(promise))
  }

  async function save() {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setFailed(false)
    try {
      await Promise.all([...pending.current])
      if (!active.current) return
      for (const id of saver.unsentIds()) {
        await saver.retry(id)
        if (!active.current) return
      }
      if (saver.hasUnsaved()) {
        setFailed(true)
        return
      }
      const drafts = [...store.current.values()]
      const wanted = retry.current ? new Set(retry.current) : null
      // Rows already saved keep their receipts and are never sent again.
      const items = group(drafts, rejected)
        .right.filter(
          (draft) =>
            outcomes.get(draft.id)?.status !== 'saved' && (!wanted || wanted.has(draft.id)),
        )
        .map((draft) => ({ draftId: draft.id, version: draft.version }))
      const outcome =
        items.length > 0 ? await runConfirm({ batchId: batch, items, send: confirmItems }) : null
      if (!active.current) return
      const rows = new Map(outcomes)
      for (const [id, row] of outcome?.rows ?? []) rows.set(id, row)
      setOutcomes(rows)
      const again = outcome ? retryableIds(outcome) : []
      const savedIds = drafts.filter(
        (draft) => draft.status === 'converted' || rows.get(draft.id)?.status === 'saved',
      )
      const flights = savedIds.map(factOf)
      // A row the server refused for good is not retried as it stands: it goes back to unsure, with a fresh read on a conflict.
      const refused = items
        .map((item) => item.draftId)
        .filter((id) => {
          const row = rows.get(id)
          return row?.status === 'failed' && !row.retryable
        })
      const anyUnsaved = items.some((item) => rows.get(item.draftId)?.status !== 'saved')
      if (refused.length > 0) {
        setRejected((previous) => new Set([...previous, ...refused]))
        const conflict = refused.some((id) => {
          const row = rows.get(id)
          return row?.status === 'failed' && row.failure === 'versionConflict'
        })
        if (conflict)
          try {
            await reload()
          } catch {
            // The next Save reads again through the version the server answers with.
          }
      }
      if (anyUnsaved) {
        // Only rows worth another try are resent; the rest wait for the member.
        retry.current = again.length > 0 ? again : null
        setFailed(true)
        return
      }
      retry.current = null
      if (active.current) onSaved({ flights, leftOut: drafts.length - flights.length })
    } catch {
      if (active.current) setFailed(true)
    } finally {
      busy.current = false
      if (active.current) setSaving(false)
    }
  }

  async function startEmpty() {
    if (emptying === 'busy') return
    setEmptying('busy')
    try {
      await onStartEmpty()
    } catch {
      setEmptying('failed')
      return
    }
    setEmptying('idle')
  }

  const loading =
    state.drafts.length === 0 &&
    (state.phase === 'idle' || state.phase === 'starting' || state.phase === 'processing')
  const gone = state.drafts.length === 0 && !loading
  const unread =
    !state.batch &&
    state.failure &&
    state.failure.kind !== 'expired' &&
    state.failure.kind !== 'notFound'

  if (loading)
    return (
      <div className="review-step" aria-busy="true">
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            {t(COPY.loading)}
          </h1>
        </div>
        <div className="review-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    )

  if (gone)
    return (
      <div className="review-step">
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            {t(COPY.goneTitle)}
          </h1>
          <p>{t(unread ? COPY.loadFailed : COPY.goneSub)}</p>
        </div>
        <div className="review-gone">
          {emptying === 'failed' ? (
            <p className="review-error" role="alert">
              {t(COPY.startEmptyFailed)}
            </p>
          ) : null}
          {unread ? (
            <Button
              variant="primary"
              loading={reloading}
              loadingLabel={t(COPY.loading)}
              onClick={async () => {
                setReloading(true)
                try {
                  await reload()
                } catch {
                  // Keep the retry available when the read is still unavailable.
                } finally {
                  if (active.current) setReloading(false)
                }
              }}
            >
              {t(COPY.tryAgain)}
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={emptying === 'busy'}
              loadingLabel={t(COPY.saving)}
              onClick={startEmpty}
            >
              {t(COPY.startEmpty)}
            </Button>
          )}
        </div>
      </div>
    )

  const allLeftOut = total > 0 && left === total
  const stuck = Object.values(saveStates).some((s) => s.status !== 'saving')
  const frozen = saving
  const count = formatCount(locale, total, flightsForms)
  const heading = allLeftOut
    ? `${count} ${t(COPY.allLeftOut)}`
    : unsure > 0
      ? `${count} ${t(COPY.check).replace('{count}', formatNumber(locale, unsure))}`
      : `${count} ${t(COPY.allRight)}`
  const sub = allLeftOut
    ? t(COPY.subAllLeftOut)
    : unsure > 0
      ? mobile
        ? t(COPY.subShort)
        : t(COPY.subLong)
      : null

  const shownRight = expanded ? groups.right : groups.right.slice(0, PREVIEW_ROWS)
  const hidden = groups.right.length - PREVIEW_ROWS
  const row = (draft: Draft, kind: 'right' | 'left') => (
    <li key={draft.id} className="review-line" data-kind={kind}>
      <span className="review-date">{draft.fields.date || DASH}</span>
      <span className="review-route">{routeText(draft)}</span>
      <span className="review-flight">
        {flightText(draft)}
        {kind === 'right' && isUpcoming(draft) ? (
          <span className="review-upcoming">{t(COPY.upcoming)}</span>
        ) : null}
      </span>
      {kind === 'left' ? (
        <button
          type="button"
          className="review-put"
          disabled={frozen}
          aria-label={t(COPY.putBackRoute).replace('{route}', routeText(draft))}
          onClick={() => queue(draft.id, answerRestore())}
        >
          {t(COPY.putBack)}
        </button>
      ) : null}
    </li>
  )

  const mode: 'failed' | 'offline' | 'empty' | 'ready' =
    failed || stuck
      ? 'failed'
      : !online && chosen > 0
        ? 'offline'
        : chosen === 0
          ? 'empty'
          : 'ready'
  const saveLabel = formatCount(locale, chosen, mobile ? saveShortForms : saveForms)
  const barTitle =
    mode === 'failed'
      ? t(COPY.couldntSave)
      : mode === 'offline'
        ? t(COPY.offline)
        : mode === 'empty'
          ? t(COPY.nothingToSave)
          : unsure > 0
            ? t(COPY.stillUnsure).replace('{count}', formatNumber(locale, unsure))
            : left > 0
              ? t(COPY.leftOutCount).replace('{count}', formatNumber(locale, left))
              : t(COPY.allGood)
  const barSub =
    mode === 'failed'
      ? t(COPY.keptFixes)
      : mode === 'offline'
        ? t(COPY.offlineSub)
        : mode === 'empty'
          ? null
          : unsure > 0
            ? t(COPY.savingLeavesOut)
            : left > 0
              ? t(COPY.savingSkips)
              : null

  return (
    <div className="review-step">
      <div className="auth-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          {heading}
        </h1>
        {sub ? <p>{sub}</p> : null}
      </div>

      {unsure > 0 ? (
        <ul className="review-unsure" ref={unsureList}>
          {groups.unsure.map((draft) => {
            const kind = kindOf(draft)
            const original = store.current.get(draft.id) ?? draft
            return kind === 'other' ? (
              <ReviewRow
                key={draft.id}
                locale={locale}
                draft={draft}
                stored={original}
                state={saveStates[draft.id]}
                mobile={mobile}
                frozen={frozen}
                onDirty={onDirty}
                onChange={(change) => queue(draft.id, change)}
                onRetry={() => void saver.retry(draft.id)}
                onDiscard={() => saver.discard(draft.id)}
              />
            ) : (
              <UnsureCard
                key={draft.id}
                locale={locale}
                draft={draft}
                kind={kind}
                disabled={frozen}
                onChange={(change) => queue(draft.id, change)}
              />
            )
          })}
        </ul>
      ) : null}

      {groups.right.length > 0 ? (
        <section className="review-group" aria-labelledby="review-right">
          <h2 id="review-right" className="review-group-head">
            <Check size={14} strokeWidth={2} aria-hidden="true" />
            <span>{t(COPY.looksRight)}</span>
            <span className="review-count">{formatNumber(locale, groups.right.length)}</span>
          </h2>
          <div
            className={expanded ? 'review-scroll' : undefined}
            role={expanded ? 'region' : undefined}
            tabIndex={expanded ? 0 : undefined}
            aria-label={expanded ? t(COPY.looksRightList) : undefined}
          >
            <ul className="review-lines">{shownRight.map((draft) => row(draft, 'right'))}</ul>
          </div>
          {hidden > 0 ? (
            <button
              type="button"
              className="review-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded
                ? t(COPY.showFewer)
                : formatCount(locale, groups.right.length, showAllForms)}
            </button>
          ) : null}
        </section>
      ) : null}

      {left > 0 ? (
        <section className="review-group" aria-labelledby="review-left">
          <h2 id="review-left" className="review-group-head">
            <span>{t(COPY.leftOut)}</span>
            <span className="review-count">{formatNumber(locale, left)}</span>
          </h2>
          <ul className="review-lines">{groups.left.map((draft) => row(draft, 'left'))}</ul>
        </section>
      ) : null}

      <div className="review-bar" data-mode={mode} ref={bar}>
        <div className="review-bar-text" aria-live="polite">
          <p className="review-bar-title">{barTitle}</p>
          {barSub ? <p className="review-bar-sub">{barSub}</p> : null}
        </div>
        {mode === 'empty' ? (
          <div className="review-bar-action">
            {emptying === 'failed' ? (
              <p className="review-error" role="alert">
                {t(COPY.startEmptyFailed)}
              </p>
            ) : null}
            <Button
              variant="primary"
              loading={emptying === 'busy'}
              loadingLabel={t(COPY.saving)}
              onClick={startEmpty}
            >
              {t(COPY.startEmpty)}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            loading={saving}
            loadingLabel={t(COPY.saving)}
            disabledReason={
              mode === 'offline'
                ? t(COPY.offlineReason)
                : dirty.size > 0
                  ? t(COPY.unsavedReason)
                  : undefined
            }
            onClick={save}
          >
            {mode === 'failed' ? t(COPY.tryAgain) : saveLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
