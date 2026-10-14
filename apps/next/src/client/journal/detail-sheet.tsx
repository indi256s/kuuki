'use client'
/**
 * The Journal detail sheet (spec "Detail sheet", D5): the open flight (`view.flight` in the Journal store), read first as a journey,
 * with an Edit mode that saves related changes together.
 *
 * `<JournalDetail>` renders inside `JournalStoreProvider` and the member shell's `ToastProvider`, and stays mounted for the page's
 * lifetime (it renders nothing while no flight is open), so a toast's Undo still works after the sheet closes. Props:
 * - `ownerId`, `locale`.
 * - `docked`: the value of `useDockedDetail()`. True (≥1280px, after mount) renders a non-modal 460px `<aside aria-label="Flight details">`
 *   meant as the second column of the page grid beside the ledger; pass `compact={docked && view.flight !== null}` to the ledger.
 *   False renders the modal `Sheet` (`side="right"`, or the `.flight-full-sheet` bottom sheet at ≤700px), opened only after mount, so a
 *   `?flight=` deep link renders the same markup on the server and the client and opens once hydrated.
 * - `initialField`: `{ flightId, field }` opens that flight's content in Edit with that field focused (the ledger's "Add aircraft"
 *   maps `field: 'aircraft'` to `'aircraft_icao'`).
 * - Review mode extension points (ticket 12): `top` renders above the read-first content ("Did you take this flight?"), `status`
 *   beside the title ("Review 2 of 3"), and `footer` in the sheet footer ("Next to review"). This component does not read `view.review`.
 * - `placeholder`: `{ title, content }` shown while no flight is open. While it is set the sheet stays open with it, so review mode
 *   can say "Nothing to confirm" or "All confirmed" in the same pane or overlay. Without it, no open flight means a closed sheet.
 *
 * Undo: the docked pane offers it in a "Saved" toast. The overlay is modal (focus trapped, a press outside dismisses it), so it
 * offers the same Undo in a status line inside the sheet instead, until the next edit or until the sheet closes.
 *
 * Focus: the docked pane takes focus on open (its title, or the requested field) and returns it to the opener
 * (or the flight row/Journal title when the opener has gone) on close; Escape inside it closes it. The overlay does the same through Radix.
 * While Edit is open, Escape first leaves Edit, and Escape or a close request with unsaved changes asks before discarding them.
 */
import { X } from '@keyline-icons/react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { formatDateOnly, type Locale } from '../../lib/format'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { useToast } from '../ui/toast'
import { useMobile } from '../ui/use-mobile'
import { useWriteFeedback } from '../write-feedback'
import { Crossfade } from './crossfade'
import { FlightDetail, type CloseGuard, type FlightEditor } from './flight-detail'
import type { Changes, EditableField, EditOutcome, EditRecord, FlightDto } from './flight-edits'
import type { JournalFlight, JournalPayload } from './model'
import { OfflineNote } from './states'
import { useJournalStore } from './store'
import './detail-sheet.css'

export const DOCK_QUERY = '(min-width: 1280px)'

const subscribeDock = (notify: () => void) => {
  const query = window.matchMedia(DOCK_QUERY)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
/** True at ≥1280px once mounted; false on the server and during hydration, so the first render never depends on `window`. */
export function useDockedDetail(): boolean {
  return useSyncExternalStore(
    subscribeDock,
    () => window.matchMedia(DOCK_QUERY).matches,
    () => false,
  )
}
const noSubscribe = () => () => {}
const useMounted = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )

const fieldNames: Record<Locale, Record<EditableField, string>> = {
  en: {
    origin: 'Departure airport',
    destination: 'Arrival airport',
    date: 'Date',
    departure_time: 'Departure time',
    arrival_time: 'Arrival time',
    airline_iata: 'Airline',
    flight_number: 'Flight number',
    aircraft_icao: 'Aircraft',
  },
  ru: {
    origin: 'аэропорт вылета',
    destination: 'аэропорт прилёта',
    date: 'дата',
    departure_time: 'время вылета',
    arrival_time: 'время прилёта',
    airline_iata: 'авиакомпания',
    flight_number: 'номер рейса',
    aircraft_icao: 'самолёт',
  },
}

const copy = {
  en: {
    region: 'Flight details',
    close: 'Close flight details',
    flight: 'Flight',
    missing: 'This flight is no longer in your journal.',
    closeMissing: 'Close',
    saved: (fields: EditableField[]) =>
      fields.length === 1 ? `${fieldNames.en[fields[0]]} saved` : 'Flight saved',
    undo: 'Undo',
    undone: 'Change undone',
    undoRefused:
      'This flight changed after that edit, so it cannot be undone. Edit the flight again instead.',
    busy: 'Another change to this flight is still saving. Try again in a moment.',
    offline: 'Offline. Connect to change flights.',
    editorFailed: 'Could not load the editor. Try again.',
    sessionChanged: 'Your session changed. Reopen the Journal before editing.',
  },
  ru: {
    region: 'Сведения о перелёте',
    close: 'Закрыть сведения о перелёте',
    flight: 'Перелёт',
    missing: 'Этого перелёта больше нет в журнале.',
    closeMissing: 'Закрыть',
    saved: (fields: EditableField[]) =>
      fields.length === 1 ? `Сохранено: ${fieldNames.ru[fields[0]]}` : 'Перелёт сохранён',
    undo: 'Отменить',
    undone: 'Изменение отменено',
    undoRefused:
      'Перелёт изменился после этой правки, поэтому её нельзя отменить. Измените перелёт ещё раз.',
    busy: 'Другое изменение этого перелёта ещё сохраняется. Повторите через мгновение.',
    offline: 'Нет сети. Подключитесь, чтобы изменить перелёты.',
    editorFailed: 'Не удалось загрузить редактор. Повторите.',
    sessionChanged: 'Сессия изменилась. Откройте журнал снова перед редактированием.',
  },
} as const

type EditorState = 'idle' | 'loading' | 'ready' | 'failed'
/** The latest saved edit, offered for Undo inside the modal overlay. */
type UndoOffer = { record: EditRecord }

/**
 * The write side: one save per flight at a time, the lazily loaded write module and Undo records.
 * A save or Undo answered after a sign-out or owner switch is dropped, never applied.
 */
function useFlightEdits({
  ownerId,
  locale,
  online,
  docked,
  payload,
  applyFlight,
  refresh,
}: {
  ownerId: string
  locale: Locale
  online: boolean
  docked: boolean
  payload: JournalPayload
  applyFlight: (flight: JournalFlight, refs?: Partial<JournalPayload['refs']>) => void
  refresh: () => Promise<void>
}) {
  const t = copy[locale]
  const toast = useToast()
  const feedback = useWriteFeedback(ownerId)
  const [editor, setEditor] = useState<FlightEditor | null>(null)
  const [editorState, setEditorState] = useState<EditorState>('idle')
  const loading = useRef<Promise<FlightEditor | null> | null>(null)
  const loadEditor = useCallback(() => {
    if (!loading.current) {
      setEditorState('loading')
      loading.current = import('./flight-edits').then(
        (mod) => {
          setEditor(mod)
          setEditorState('ready')
          return mod
        },
        () => {
          loading.current = null
          setEditorState('failed')
          return null
        },
      )
    }
    return loading.current
  }, [])

  const latest = useRef({ payload, online, locale, docked })
  useEffect(() => {
    latest.current = { payload, online, locale, docked }
  })
  const [offer, setOffer] = useState<UndoOffer | null>(null)
  const identityReset = useRef(false)
  useEffect(() => {
    const reset = () => {
      identityReset.current = true
    }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => window.removeEventListener('kuuki:identity-reset', reset)
  }, [])

  const savingRef = useRef(new Set<number>())
  const [saving, setSaving] = useState<ReadonlySet<number>>(() => new Set())
  const mark = (id: number, on: boolean) => {
    if (on) savingRef.current.add(id)
    else savingRef.current.delete(id)
    setSaving(new Set(savingRef.current))
  }
  const seqs = useRef(new Map<number, number>())

  const current = (id: number) => latest.current.payload.flights.find((flight) => flight.id === id)
  /** Applies the server's row at once, then lets the refetch recompute firsts, connections and refs. */
  const settle = (mod: FlightEditor, flightId: number, dto: FlightDto): JournalFlight | null => {
    const before = current(flightId)
    feedback.acknowledge(dto)
    if (!before) {
      void refresh()
      return null
    }
    const merged = mod.mergeSavedFlight(before, dto)
    applyFlight(merged, mod.refsPatch(merged, latest.current.payload.refs))
    // Lifecycle moved (a date edit): Query-owned reads elsewhere (queue, badges) refresh too; the store's own listener refetches the list.
    if (merged.lifecycle_state !== before.lifecycle_state)
      window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
    else void refresh()
    seqs.current.set(flightId, (seqs.current.get(flightId) ?? 0) + 1)
    return merged
  }
  const dropped = (generation: number) =>
    identityReset.current || generation !== getAuthGeneration()

  const undo = async (record: EditRecord) => {
    const { online: isOnline, locale: lang } = latest.current
    if (!isOnline) {
      toast.show({ kind: 'error', message: { en: copy.en.offline, ru: copy.ru.offline } })
      return
    }
    if (savingRef.current.has(record.flightId)) {
      toast.show({ kind: 'error', message: { en: copy.en.busy, ru: copy.ru.busy } })
      return
    }
    const mod = await loadEditor()
    if (!mod) {
      toast.show({ kind: 'error', message: { en: copy.en.editorFailed, ru: copy.ru.editorFailed } })
      return
    }
    setOffer((current) => (current?.record === record ? null : current))
    if (!mod.canUndo(record, current(record.flightId), seqs.current.get(record.flightId))) {
      toast.show({ kind: 'error', message: { en: copy.en.undoRefused, ru: copy.ru.undoRefused } })
      return
    }
    if (identityReset.current) return
    const generation = getAuthGeneration()
    mark(record.flightId, true)
    try {
      const { outcome, flight: dto } = await mod.undoWrite(record, lang, generation)
      if (dropped(generation)) return
      if (outcome.status === 'saved' && dto) {
        settle(mod, record.flightId, dto)
        toast.show({ kind: 'success', message: { en: copy.en.undone, ru: copy.ru.undone } })
      } else {
        toast.show({
          kind: 'error',
          message:
            outcome.status === 'saved'
              ? { en: mod.unknownMessage('en'), ru: mod.unknownMessage('ru') }
              : (outcome.messageCopy ?? outcome.message),
        })
        void refresh()
      }
    } finally {
      mark(record.flightId, false)
    }
  }

  const save = async (flight: JournalFlight, changes: Changes): Promise<EditOutcome> => {
    if (!latest.current.online)
      return {
        status: 'rejected',
        message: t.offline,
        messageCopy: { en: copy.en.offline, ru: copy.ru.offline },
      }
    if (identityReset.current)
      return {
        status: 'rejected',
        message: t.sessionChanged,
        messageCopy: { en: copy.en.sessionChanged, ru: copy.ru.sessionChanged },
      }
    if (savingRef.current.has(flight.id))
      return {
        status: 'rejected',
        message: t.busy,
        messageCopy: { en: copy.en.busy, ru: copy.ru.busy },
      }
    const fields = Object.keys(changes) as EditableField[]
    if (!fields.length) return { status: 'saved' }
    const generation = getAuthGeneration()
    mark(flight.id, true)
    try {
      const mod = await loadEditor()
      if (!mod)
        return {
          status: 'rejected',
          message: t.editorFailed,
          messageCopy: { en: copy.en.editorFailed, ru: copy.ru.editorFailed },
        }
      const { outcome, flight: dto } = await mod.writeFlightFields(
        flight.id,
        changes,
        locale,
        generation,
      )
      // The answer belongs to a session that has ended: never applied, never refetched here (the page is leaving).
      if (dropped(generation))
        return outcome.status === 'saved'
          ? {
              status: 'unknown',
              message: t.sessionChanged,
              messageCopy: { en: copy.en.sessionChanged, ru: copy.ru.sessionChanged },
            }
          : outcome
      if (outcome.status === 'saved' && dto) {
        const merged = settle(mod, flight.id, dto)
        if (merged && dto.undo_token) {
          const record: EditRecord = {
            flightId: flight.id,
            fields,
            undoToken: dto.undo_token,
            after: mod.editableValues(merged),
            seq: seqs.current.get(flight.id)!,
          }
          if (latest.current.docked) {
            setOffer(null)
            toast.show({
              kind: 'success',
              message: { en: copy.en.saved(fields), ru: copy.ru.saved(fields) },
              actionLabel: { en: copy.en.undo, ru: copy.ru.undo },
              onAction: () => {
                void undo(record)
              },
            })
          } else setOffer({ record })
        }
      } else void refresh() // unknown: the list shows what landed; rejected: a conflict needs the current row
      return outcome
    } finally {
      mark(flight.id, false)
    }
  }

  const dismissOffer = useCallback(() => setOffer(null), [])
  return { editor, editorState, loadEditor, save, undo, saving, offer, dismissOffer }
}

export type JournalDetailProps = {
  ownerId: string
  locale: Locale
  docked: boolean
  initialField?: { flightId: number; field: EditableField } | null
  top?: ReactNode
  status?: ReactNode
  footer?: ReactNode
  placeholder?: { title: ReactNode; content: ReactNode } | null
}

export function JournalDetail({
  ownerId,
  locale,
  docked,
  initialField,
  top,
  status,
  footer,
  placeholder,
}: JournalDetailProps) {
  const t = copy[locale]
  const { payload, view, openFlight, closeSheet, refresh, applyFlight, online, hidden } =
    useJournalStore()
  const mounted = useMounted()
  const mobile = useMobile()
  const offlineNoteId = useId()
  const edits = useFlightEdits({ ownerId, locale, online, docked, payload, applyFlight, refresh })
  const { loadEditor: loadEditorModule, dismissOffer } = edits
  const loadEditor = useCallback(() => {
    void loadEditorModule()
  }, [loadEditorModule])

  const id = view.flight
  // The overlay keeps showing the last flight while it animates out.
  const [shownId, setShownId] = useState(id)
  if (id !== null && id !== shownId) setShownId(id)
  const flight =
    shownId !== null && !hidden.has(shownId)
      ? payload.flights.find((item) => item.id === shownId)
      : undefined
  const idle = id === null ? (placeholder ?? null) : null

  /** Filled by the content while Edit is open: Escape and close requests ask it first. */
  const guard = useRef<CloseGuard | null>(null)
  const requestClose = () => {
    if (!guard.current?.('close', closeSheet)) closeSheet()
  }
  const paneTitle = useRef<HTMLHeadingElement | null>(null)
  /** Header slot beside Close; the content portals its Edit button here so identity and actions share one region. */
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null)
  const actions = <span ref={setActionSlot} className="jd-actions" />
  const body = useRef<HTMLDivElement | null>(null)
  /** A swap started inside the sheet (a connection leg): the clicked button unmounts, so focus moves to the title. */
  const swapFromInside = useRef(false)
  const previousId = useRef<number | null>(null)
  const previousDockOpen = useRef(false)
  const opener = useRef<HTMLElement | null>(null)
  const dockOpen = docked && (id !== null || idle !== null)

  useEffect(() => {
    const before = previousId.current
    const wasDockOpen = previousDockOpen.current
    previousId.current = id
    previousDockOpen.current = dockOpen
    if (wasDockOpen && !dockOpen) {
      // Review can keep an idle pane open after its last flight; restore focus only when the dock closes.
      if (!document.activeElement || document.activeElement === document.body)
        (opener.current?.isConnected
          ? opener.current
          : ((shownId !== null ? rowFor(shownId) : null) ??
            document.querySelector<HTMLElement>('.journal-header h1'))
        )?.focus()
      opener.current = null
    }
    const inside = swapFromInside.current
    if (dockOpen && (before !== id || !wasDockOpen)) {
      const active = document.activeElement
      if (
        !inside &&
        active instanceof HTMLElement &&
        active !== document.body &&
        !active.closest('.journal-detail, .journal-detail-sheet')
      )
        opener.current = active
    }
    if (before === id) {
      if (dockOpen && !wasDockOpen) paneTitle.current?.focus()
      return
    }
    swapFromInside.current = false
    if (id === null) {
      dismissOffer()
      return
    }
    if (docked) {
      if (before === null && initialField?.flightId === id) return // the requested field takes focus
      if (before === null || inside) paneTitle.current?.focus()
    } else if (inside) {
      body.current
        ?.closest<HTMLElement>('[role=dialog]')
        ?.querySelector<HTMLElement>('.ui-panel-title')
        ?.focus()
    }
  }, [id, docked, dockOpen, shownId, initialField, dismissOffer])

  const swap = useCallback(
    (next: number) => {
      swapFromInside.current = true
      openFlight(next)
    },
    [openFlight],
  )
  const paneKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    if (!guard.current?.('escape', closeSheet)) closeSheet()
  }

  const title = flight ? (
    <>
      {flight.origin}
      <span aria-hidden="true"> → </span>
      <span className="sr-only">{locale === 'ru' ? ' в ' : ' to '}</span>
      {flight.destination}
      {/* Identity before any decision: the date sits under the route; the flight number leads the facts below. */}
      <span className="sr-only">,</span>
      <span className="jd-title-meta">{formatDateOnly(locale, flight.date, 'long')}</span>
    </>
  ) : (
    t.flight
  )
  const content = flight ? (
    <Crossfade signature={String(flight.id)}>
      <FlightDetail
        key={flight.id}
        flight={flight}
        payload={payload}
        locale={locale}
        online={online}
        offlineNoteId={offlineNoteId}
        editor={edits.editor}
        editorState={edits.editorState}
        loadEditor={loadEditor}
        onSave={edits.save}
        busy={edits.saving.has(flight.id)}
        initialField={initialField?.flightId === flight.id ? initialField.field : null}
        onOpenFlight={swap}
        guardRef={guard}
        actionSlot={actionSlot}
      />
    </Crossfade>
  ) : (
    <div className="jd-missing" role="status">
      <p>{t.missing}</p>
      <Button variant="secondary" onClick={closeSheet}>
        {t.closeMissing}
      </Button>
    </div>
  )
  const lead = (
    <>
      {status}
      {flight && !online && <OfflineNote locale={locale} id={offlineNoteId} />}
      {flight && top}
    </>
  )
  const offer = !docked && flight && edits.offer?.record.flightId === flight.id ? edits.offer : null
  const undoLine = (
    <div className="jd-undo" role="status">
      {offer && (
        <>
          <p>{t.saved(offer.record.fields)}</p>
          <Button
            variant="ghost"
            dense
            onClick={() => {
              void edits.undo(offer.record)
            }}
          >
            {t.undo}
          </Button>
        </>
      )}
    </div>
  )

  if (docked) {
    if (id === null && !idle) return null
    return (
      <aside className="journal-detail" aria-label={t.region} onKeyDown={paneKeys}>
        <div className="jd-header">
          <h2 ref={paneTitle} tabIndex={-1} className="jd-title">
            {idle ? idle.title : title}
          </h2>
          {!idle && actions}
          <button
            type="button"
            className="ui-icon-button"
            aria-label={t.close}
            onClick={requestClose}
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div ref={body} className="jd-body">
          {idle ? (
            idle.content
          ) : (
            <>
              {lead}
              {content}
            </>
          )}
        </div>
        {footer && flight && !idle && <div className="jd-footer">{footer}</div>}
      </aside>
    )
  }

  return (
    <Sheet
      open={mounted && mobile !== null && (id !== null || idle !== null)}
      onOpenChange={(open) => {
        if (!open) requestClose()
      }}
      onEscapeKeyDown={(event) => {
        if (guard.current?.('escape', closeSheet)) event.preventDefault()
      }}
      title={idle ? idle.title : title}
      titleAction={idle ? undefined : actions}
      initialDetent={1}
      side={mobile ? 'bottom' : 'right'}
      className={mobile ? 'journal-detail-sheet flight-full-sheet' : 'journal-detail-sheet'}
      closeLabel={t.close}
      footer={footer && flight && !idle ? footer : undefined}
      onCloseAutoFocus={(event) => {
        const row = shownId !== null ? rowFor(shownId) : null
        if (row) {
          event.preventDefault()
          row.focus()
        }
      }}
    >
      <div ref={body} className="jd-body-inner">
        {idle ? (
          idle.content
        ) : (
          <>
            {lead}
            {content}
            {undoLine}
          </>
        )}
      </div>
    </Sheet>
  )
}

function rowFor(id: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-flight-row="${id}"]`)
}
