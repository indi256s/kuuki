'use client'

import { useLocale } from '../preferences'

import { Check, Circle, CircleAlert, X } from '@keyline-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatNumber, type Locale } from '../../lib/format'
import { NavigationLink } from '../navigation-link'
import { BottomSheet } from '../ui/bottom-sheet'
import { Button } from '../ui/button'
import { ExpandableCard } from '../ui/expandable-card'
import { SlotText } from '../ui/slot-text'
import { TextShimmer } from '../ui/text-shimmer'
import { ToastSlot } from '../ui/toast'
import { useMobile } from '../ui/use-mobile'
import { isReading, type BatchRun } from './batch-run'
import { DOCK, FAILURE, S, STAGE_KEY, count, progressLabel, tx } from './copy'
import { cancelBatch } from './import-api'
import { useImportRuns, useImportRunsStore, type RunEntry } from './import-runs'
import type { BatchStage } from './import-types'
import { SHOWN, stageState } from './progress-step'
import { localToday, needCount } from './questions'
import { partition } from './review-model'
import './import-dock.css'

export type DockKind = 'reading' | 'need' | 'stopped' | 'failed' | 'sorted'

export interface DockItem {
  key: string
  kind: DockKind
  line: string
  label: string
  found: number
  need: number
  stage: BatchStage | null
  routes: string[]
  href: string | null
  actionLabel: string | null
}

type CancelState = 'busy' | 'failed' | 'readFailed'

const URGENCY: Record<DockKind, number> = { need: 0, stopped: 0, failed: 1, reading: 2, sorted: 3 }

export function itemOf(
  entry: RunEntry,
  key: string,
  locale: Locale,
  today: string,
): DockItem | null {
  const { state, run } = entry
  const source = run.source()
  const label =
    source?.label || (source?.type === 'text' ? DOCK.yourText[locale] : DOCK.yourFile[locale])
  const id = run.batchId()
  const routes = [...state.drafts]
    .sort((a, b) => a.ordinal - b.ordinal)
    .slice(-3)
    .map((draft) => `${draft.fields.origin || '—'} → ${draft.fields.destination || '—'}`)
  const base = {
    key,
    label,
    found: state.drafts.length,
    need: 0,
    stage: state.batch ? (state.batch.stage ?? 'accepted') : null,
    routes,
  }
  const review = id ? `/import?batch=${encodeURIComponent(id)}` : null
  if (isReading(state.phase))
    return {
      ...base,
      kind: 'reading',
      line: progressLabel(locale, base.stage),
      href: null,
      actionLabel: null,
    }
  if (state.phase === 'failed')
    return {
      ...base,
      kind: 'failed',
      line: state.failure ? FAILURE[state.failure.kind][locale].title : DOCK.tryAgain[locale],
      href: '/import',
      actionLabel: DOCK.tryAgain[locale],
    }
  if (state.phase !== 'ready' || !review) return null
  const groups = partition(state.drafts)
  const total = groups.active.length + groups.duplicates.length
  if (state.stopped)
    return {
      ...base,
      kind: 'stopped',
      line: count(locale, 'stoppedKept', total),
      href: review,
      actionLabel: DOCK.review[locale],
    }
  const need = needCount(state.drafts, today)
  return {
    ...base,
    kind: need > 0 ? 'need' : 'sorted',
    need,
    line:
      need > 0
        ? `${count(locale, 'flightsN', total)}. ${count(locale, 'needYou', need)}`
        : count(locale, 'allSorted', total),
    href: review,
    actionLabel: DOCK.review[locale],
  }
}

export const byUrgency = (items: DockItem[]) =>
  [...items].sort((a, b) => URGENCY[a.kind] - URGENCY[b.kind])

function DockMark({ kind, need, locale }: { kind: DockKind; need: number; locale: Locale }) {
  return (
    <span className="import-dock-mark" data-kind={kind} aria-hidden="true">
      <span className="import-dock-mark-layer import-dock-spinner" data-on={kind === 'reading'} />
      <span className="import-dock-mark-layer import-dock-badge" data-on={kind === 'need'}>
        <SlotText value={need} format={(value) => formatNumber(locale, value)} />
      </span>
      <span className="import-dock-mark-layer" data-on={kind === 'sorted'}>
        <Check size={18} strokeWidth={2} />
      </span>
      <span
        className="import-dock-mark-layer import-dock-alert"
        data-on={kind === 'failed' || kind === 'stopped'}
      >
        <CircleAlert size={18} strokeWidth={2} />
      </span>
    </span>
  )
}

function Stages({ stage, locale }: { stage: BatchStage | null; locale: Locale }) {
  return (
    <ol className="import-dock-stages" aria-label={S.stagesLabel[locale]}>
      {SHOWN.map((name, position) => {
        const state = stageState(position, stage)
        return (
          <li key={name} data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="import-dock-stage-marker" aria-hidden="true">
              {state === 'done' ? (
                <Check size={14} strokeWidth={2} />
              ) : (
                <Circle size={14} strokeWidth={2} />
              )}
            </span>
            <span>
              {name === 'accepted' && stage === null
                ? S.stagePreparing[locale]
                : tx(locale, STAGE_KEY[name])}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface ViewProps {
  items: DockItem[]
  locale: Locale
  inline?: boolean
  mobile?: boolean | null
  announcement?: string
  cancel?: Record<string, CancelState>
  onCancel?: (key: string) => void
  onDismiss?: (key: string) => void
  onAction?: (item: DockItem) => void
}

function Actions({
  item,
  locale,
  onDismiss,
  onAction,
}: {
  item: DockItem
  locale: Locale
  onDismiss?: (key: string) => void
  onAction?: (item: DockItem) => void
}) {
  if (item.kind === 'reading') return null
  return (
    <>
      {item.href && item.actionLabel ? (
        <NavigationLink
          href={item.href}
          className="ui-button import-dock-action"
          data-variant="ghost"
          data-dense="true"
          onClick={() => onAction?.(item)}
        >
          <span>{item.actionLabel}</span>
        </NavigationLink>
      ) : null}
      <button
        type="button"
        className="ui-icon-button import-dock-hide"
        aria-label={`${DOCK.hide[locale]}: ${item.label}`}
        onClick={() => onDismiss?.(item.key)}
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </>
  )
}

function Detail({
  item,
  several,
  locale,
  cancel,
  onCancel,
  onDismiss,
  onAction,
}: {
  item: DockItem
  several: boolean
} & Pick<ViewProps, 'locale' | 'cancel' | 'onCancel' | 'onDismiss' | 'onAction'>) {
  const cancelling = cancel?.[item.key]
  return (
    <li className="import-dock-run" data-kind={item.kind}>
      {several ? (
        <div className="import-dock-run-head">
          <DockMark kind={item.kind} need={item.need} locale={locale} />
          <div className="import-dock-run-copy">
            <p className="import-dock-run-line">{item.line}</p>
            <p className="import-dock-run-label">{item.label}</p>
          </div>
          <Actions item={item} locale={locale} onDismiss={onDismiss} onAction={onAction} />
        </div>
      ) : null}
      {item.kind === 'reading' ? (
        <>
          <Stages stage={item.stage} locale={locale} />
          {item.routes.length > 0 ? (
            <ul className="import-dock-routes" aria-label={DOCK.recent[locale]}>
              {item.routes.map((route, index) => (
                <li key={`${index}:${route}`} className="import-code">
                  {route}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="import-dock-hint">{DOCK.readingSub[locale]}</p>
          <div className="import-dock-cancel">
            <Button
              dense
              loading={cancelling === 'busy'}
              loadingLabel={S.cancelling[locale]}
              onClick={() => onCancel?.(item.key)}
            >
              {DOCK.cancelReading[locale]}
            </Button>
            {cancelling === 'failed' || cancelling === 'readFailed' ? (
              <p className="import-dock-problem" role="alert">
                <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  {cancelling === 'failed' ? S.cancelFailed[locale] : S.cancelReadFailed[locale]}
                </span>
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </li>
  )
}

const EXIT_MS = 200

export function ImportDockView({
  items,
  locale,
  inline = false,
  mobile: mobileProp,
  announcement = '',
  cancel,
  onCancel,
  onDismiss,
  onAction,
}: ViewProps) {
  const detected = useMobile()
  const mobile = mobileProp === undefined ? detected : mobileProp
  const [expanded, setExpanded] = useState(false)
  const [sheet, setSheet] = useState(false)
  const open = items.length > 0
  const [held, setHeld] = useState<{
    open: boolean
    items: DockItem[]
    leaving: DockItem[] | null
  }>({ open, items, leaving: null })
  let current = held
  if (held.open !== open || (open && held.items !== items)) {
    current = { open, items: open ? items : held.items, leaving: open ? null : held.items }
    setHeld(current)
  }
  useEffect(() => {
    if (!current.leaving) return
    const timer = window.setTimeout(
      () => setHeld((latest) => (latest.open ? latest : { ...latest, leaving: null })),
      EXIT_MS,
    )
    return () => window.clearTimeout(timer)
  }, [current.leaving])
  const shown = open ? items : current.leaving
  const openable = open && (items.length > 1 || items[0].kind === 'reading')
  if (!openable && (expanded || sheet)) {
    setExpanded(false)
    setSheet(false)
  }
  const act = (target: DockItem) => {
    setExpanded(false)
    setSheet(false)
    onAction?.(target)
  }

  const status = (
    <div className="sr-only" role="status" aria-live="polite">
      {announcement}
    </div>
  )
  const host = (card: ReactNode) => {
    const body = (
      <div className="import-dock-host">
        {card}
        {status}
      </div>
    )
    return inline ? body : <ToastSlot>{body}</ToastSlot>
  }
  if (!shown || shown.length === 0 || mobile === null) return host(null)

  const lead = shown[0]
  const several = shown.length > 1
  const reading = lead.kind === 'reading'
  const detail = (
    <ul className="import-dock-list">
      {shown.map((item) => (
        <Detail
          key={item.key}
          item={item}
          several={several}
          locale={locale}
          cancel={cancel}
          onCancel={onCancel}
          onDismiss={onDismiss}
          onAction={act}
        />
      ))}
    </ul>
  )
  const opens = several || reading
  const card = (
    <section
      className="import-dock"
      aria-label={DOCK.label[locale]}
      data-state={open ? 'open' : 'closed'}
      data-layout={mobile ? 'phone' : 'desktop'}
    >
      <ExpandableCard
        direction="up"
        expanded={expanded}
        onExpandedChange={setExpanded}
        onTrigger={mobile && opens ? () => setSheet(true) : undefined}
        icon={<DockMark kind={lead.kind} need={lead.need} locale={locale} />}
        title={
          <span className="import-dock-title">
            <TextShimmer active={reading}>{lead.line}</TextShimmer>
            {several ? (
              <span className="import-dock-more">
                <SlotText value={count(locale, 'more', shown.length - 1)} align="end" />
              </span>
            ) : null}
          </span>
        }
        description={
          reading ? (
            <span className="import-dock-description">
              <span className="import-dock-source">{lead.label}</span>
              <SlotText value={count(locale, 'foundShort', lead.found)} />
            </span>
          ) : (
            lead.label
          )
        }
        actions={
          several ? null : (
            <Actions item={lead} locale={locale} onDismiss={onDismiss} onAction={act} />
          )
        }
      >
        {opens && !mobile ? detail : undefined}
      </ExpandableCard>
    </section>
  )
  return (
    <>
      {host(card)}
      {mobile && opens ? (
        <BottomSheet
          open={sheet}
          onOpenChange={setSheet}
          title={DOCK.label[locale]}
          initialDetent={0}
          closeLabel={locale === 'ru' ? 'Закрыть' : 'Close'}
        >
          {detail}
        </BottomSheet>
      ) : null}
    </>
  )
}

const keys = new WeakMap<BatchRun, string>()
let nextKey = 1
const keyOf = (run: BatchRun) => {
  let key = keys.get(run)
  if (!key) {
    key = `run-${nextKey++}`
    keys.set(run, key)
  }
  return key
}

const itemCache: Record<Locale, WeakMap<RunEntry['state'], DockItem | null>> = {
  en: new WeakMap(),
  ru: new WeakMap(),
}
function cachedItem(entry: RunEntry, locale: Locale, today: string) {
  const cache = itemCache[locale]
  if (!cache.has(entry.state))
    cache.set(entry.state, itemOf(entry, keyOf(entry.run), locale, today))
  return cache.get(entry.state) ?? null
}

export function ImportDock({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  const store = useImportRunsStore()
  const entries = useImportRuns()
  const docked = useMemo(() => entries.filter((entry) => !entry.viewed), [entries])
  const items = useMemo(() => {
    const today = localToday()
    return byUrgency(
      docked.flatMap((entry) => {
        const item = cachedItem(entry, locale, today)
        return item ? [item] : []
      }),
    )
  }, [docked, locale])
  const runOf = (key: string) => docked.find((entry) => keyOf(entry.run) === key)?.run ?? null

  const [heard, setHeard] = useState<{
    items: DockItem[]
    states: Map<string, string>
    said: string
  }>(() => ({ items: [], states: new Map(), said: '' }))
  let announcement = heard.said
  if (heard.items !== items) {
    const states = new Map<string, string>()
    for (const item of items) {
      const state = item.kind === 'reading' ? `${item.kind}:${item.stage}` : item.kind
      states.set(item.key, state)
      if (heard.states.get(item.key) !== state) announcement = `${item.line}. ${item.label}`
    }
    setHeard({ items, states, said: announcement })
  }

  const [cancel, setCancel] = useState<Record<string, CancelState>>({})
  const setCancelFor = (key: string, value: CancelState | null) =>
    setCancel((previous) => {
      const next = { ...previous }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  const onCancel = async (key: string) => {
    const run = runOf(key)
    const id = run?.batchId()
    if (!run || !id || cancel[key] === 'busy') return
    setCancelFor(key, 'busy')
    try {
      await cancelBatch(id)
    } catch {
      setCancelFor(key, 'failed')
      return
    }
    try {
      await run.reload()
      setCancelFor(key, null)
    } catch {
      setCancelFor(key, 'readFailed')
    }
  }
  const onDismiss = (key: string) => {
    const run = runOf(key)
    if (run) store?.dismiss(run)
  }
  const onAction = (item: DockItem) => {
    if (item.kind === 'failed') onDismiss(item.key)
  }

  return (
    <ImportDockView
      items={items}
      locale={locale}
      announcement={announcement}
      cancel={cancel}
      onCancel={(key) => void onCancel(key)}
      onDismiss={onDismiss}
      onAction={onAction}
    />
  )
}
