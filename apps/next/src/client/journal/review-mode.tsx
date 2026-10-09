'use client'
/**
 * Review mode in the Journal detail sheet (spec "Detail sheet → Review mode", D1, D6; ticket 12).
 *
 * `useJournalReview({ locale, docked, queue, offlineNoteId })` runs in the page beside `<JournalDetail>`. Outside review mode
 * (`view.review` false) it returns null. In review mode it returns the sheet's slots:
 * - `status`: "Review 2 of 3", plus the pending "Did not fly" Undo line while the sheet is the modal overlay (focus cannot reach
 *   the toast region there).
 * - `top`: "Did you take this flight?" with I flew and Did not fly, the arrival transit choice the old queue offered, and a live
 *   line for the last outcome ("Confirmed TBS → IST. New stamp: Türkiye.").
 * - `footer`: "Next to review", which moves on without writing; disabled on the last flight.
 * - `placeholder`: when nothing is left, "Nothing to confirm" or "All confirmed" with Close.
 *
 * The review set is every awaiting flight in the payload, ignoring filters (D6), minus rows a pending delete hides and flights
 * this session confirmed, oldest first (date, departure_utc, id). The shown flight is `view.flight` when it is in the set, else
 * the first; the hook keeps the URL on it with `openFlight(id, { review: true })` (a replace while the sheet is open).
 *
 * - I flew: `confirmFlights` for that one flight with the queue's candidate token and, when the member changed it, the transit
 *   choice. Confirmed: advance to the next flight in the set (wrapping to the first remaining), refresh and announce the
 *   lifecycle change; newly stamped countries show in the outcome line. A confirmation whose publication is still pending waits
 *   for it (`awaitPublication`) and then reads the operation's receipt again for the stamps, as the old queue did. Any other
 *   outcome stays on the flight with an inline message.
 * - Did not fly: the page's one deferred delete (`journal-delete.tsx`, D1), then advance. Undo brings the flight back and returns
 *   the sheet to it.
 * - Offline: both actions are blocked and described by the page's offline note.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import type { ConfirmOutcome, ConfirmRequest } from '../../../../../functions/api/_services/confirmation'
import { formatNumber, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import type { AwaitingQueue } from '../awaiting'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { awaitPublication } from '../publication'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { confirmFlights, type ConfirmTransport } from './confirm-flights'
import { DeleteUndoLine, useJournalDelete, type PendingDelete } from './journal-delete'
import type { JournalFlight } from './model'
import { useJournalStore } from './store'
import './review-mode.css'

const copy = {
  en: {
    title: 'Review', question: 'Did you take this flight?', flew: 'I flew', didNotFly: 'Did not fly, remove', confirming: 'Confirming…',
    next: 'Next to review', position: (n: string, total: string) => `Review ${n} of ${total}`, close: 'Close',
    empty: 'Nothing to confirm.', allConfirmed: 'All confirmed.', nothingLeft: 'Nothing left to confirm.',
    connection: 'Connection', estimated: 'Estimated from dates', ambiguous: 'Ambiguous: the country will count unless you change it', precise: 'Based on flight times',
    leftAirport: 'Left the airport',
    confirmed: (route: string) => `Confirmed ${route}.`,
    stamps: (names: string, count: number) => count === 1 ? `New stamp: ${names}.` : `New stamps: ${names}.`, noStamps: 'No new stamps.',
    publishing: 'Your passport is updating…', publishDelayed: 'Your passport is still updating.',
    notAwaiting: 'This flight is no longer waiting for confirmation.',
    noToken: 'Could not confirm this flight right now. Try again later.',
    rejected: 'Could not confirm this flight. The list is refreshing.',
    unknown: 'Could not check whether this flight was confirmed. The list is refreshing; check it before trying again.',
    sessionChanged: 'Your session changed. Reopen the Journal before confirming.',
    removing: (route: string) => `Did not fly: removing ${route}.`,
  },
  ru: {
    title: 'Проверка', question: 'Вы летели этим рейсом?', flew: 'Подтвердить', didNotFly: 'Не летали, удалить', confirming: 'Подтверждаем…',
    next: 'Следующий', position: (n: string, total: string) => `Проверка ${n} из ${total}`, close: 'Закрыть',
    empty: 'Подтверждать нечего.', allConfirmed: 'Все подтверждены.', nothingLeft: 'Больше подтверждать нечего.',
    connection: 'Пересадка', estimated: 'Оценка по датам', ambiguous: 'Неоднозначная пересадка: страна будет засчитана, пока вы её не измените', precise: 'Определено по времени рейсов',
    leftAirport: 'Выходили в город',
    confirmed: (route: string) => `Перелёт ${route} подтверждён.`,
    stamps: (names: string, count: number) => count === 1 ? `Новая отметка: ${names}.` : `Новые отметки: ${names}.`, noStamps: 'Новых отметок нет.',
    publishing: 'Паспорт обновляется…', publishDelayed: 'Паспорт ещё обновляется.',
    notAwaiting: 'Этот перелёт уже не ждёт подтверждения.',
    noToken: 'Не удалось подтвердить перелёт сейчас. Повторите позже.',
    rejected: 'Не удалось подтвердить перелёт. Список обновляется.',
    unknown: 'Не удалось проверить, подтверждён ли перелёт. Список обновляется; проверьте его, прежде чем повторить.',
    sessionChanged: 'Сессия изменилась. Откройте журнал снова, прежде чем подтверждать.',
    removing: (route: string) => `Не летали: удаляем ${route}.`,
  },
} as const

type QueueEntry = AwaitingQueue['awaitingFlights'][number]
type Note = { text: string; alert: boolean }
/** How the session ended up with nothing left: it never had anything, the last action confirmed, or the last action removed. */
type Ending = 'empty' | 'confirmed' | 'removed'

export type JournalReviewSlots = {
  top: ReactNode
  status: ReactNode
  footer: ReactNode
  placeholder: { title: ReactNode; content: ReactNode } | null
}

export type JournalReviewOptions = {
  locale: Locale
  /** `useDockedDetail()`: the docked pane is not modal, so the toast's Undo is reachable and takes focus. */
  docked: boolean
  /** `useAwaiting().data`: candidate tokens and the arrival transit suggestion per flight. */
  queue: AwaitingQueue | null
  /** The page's offline note; blocked actions point `aria-describedby` at it. */
  offlineNoteId: string
}

const oldestFirst = (a: JournalFlight, b: JournalFlight) =>
  a.date.localeCompare(b.date) || (a.departure_utc ?? '').localeCompare(b.departure_utc ?? '') || a.id - b.id

/** The awaiting flights to review, oldest first. Pure. */
export function reviewSet(flights: readonly JournalFlight[], exclude: (id: number) => boolean): JournalFlight[] {
  return flights.filter(flight => flight.lifecycle_state === 'awaiting' && !exclude(flight.id)).sort(oldestFirst)
}

/** The flight after `id`, wrapping to the first remaining one; null when `id` is the only one. */
function nextAfter(set: readonly JournalFlight[], id: number): JournalFlight | null {
  const index = set.findIndex(flight => flight.id === id)
  const rest = set.filter(flight => flight.id !== id)
  if (!rest.length) return null
  return (index >= 0 ? set[index + 1] : undefined) ?? rest[0]!
}

const routeOf = (flight: JournalFlight) => `${flight.origin} → ${flight.destination}`
const announce = () => window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))

function stampText(locale: Locale, codes: readonly string[] | null): string {
  if (!codes) return ''
  if (!codes.length) return ` ${copy[locale].noStamps}`
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  const label = (code: string) => { try { return names.of(code) ?? code } catch { return code } }
  return ` ${copy[locale].stamps(codes.map(label).join(', '), codes.length)}`
}

/** The default transport, keeping the last confirm request and answer so a pending publication can read the receipt again. */
function receiptTransport() {
  let last: { request: ConfirmRequest; outcome: ConfirmOutcome } | null = null
  const transport: ConfirmTransport = {
    readQueue: signal => api.get<AwaitingQueue>('/api/me/awaiting', undefined, { signal }),
    confirm: async (request, signal) => {
      const outcome = await api.post<ConfirmOutcome>('/api/flights/confirm', request, { signal })
      last = { request, outcome }
      return outcome
    },
  }
  return { transport, last: () => last }
}

export function useJournalReview({ locale, docked, queue, offlineNoteId }: JournalReviewOptions): JournalReviewSlots | null {
  const t = copy[locale]
  const { payload, view, hidden, openFlight, closeSheet, refresh, online } = useJournalStore()
  const { scheduleDelete, pending, undo } = useJournalDelete()

  // Flights this session confirmed leave the set at once; each is forgotten once the payload no longer shows it awaiting.
  const [resolved, setResolved] = useState<ReadonlySet<number>>(() => new Set())
  const [seenPayload, setSeenPayload] = useState(payload)
  if (seenPayload !== payload) {
    setSeenPayload(payload)
    const still = [...resolved].filter(id => payload.flights.some(flight => flight.id === id && flight.lifecycle_state === 'awaiting'))
    if (still.length !== resolved.size) setResolved(new Set(still))
  }

  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const noteSeq = useRef(0)
  const say = (next: Note | null) => { noteSeq.current += 1; setNote(next); return noteSeq.current }
  const [ending, setEnding] = useState<Ending>('empty')
  const [decisions, setDecisions] = useState<ReadonlyMap<number, boolean>>(() => new Map())
  const [removedId, setRemovedId] = useState<number | null>(null)
  const [focusKey, setFocusKey] = useState(0)

  // Leaving review mode ends the session: its outcome line and ending do not follow the member into the next one.
  const [wasReview, setWasReview] = useState(view.review)
  if (wasReview !== view.review) {
    setWasReview(view.review)
    if (!view.review) { setNote(null); setEnding('empty'); setFocusKey(0) }
  }

  const set = useMemo(() => view.review ? reviewSet(payload.flights, id => hidden.has(id) || resolved.has(id)) : [],
    [view.review, payload.flights, hidden, resolved])
  const found = set.findIndex(flight => flight.id === view.flight)
  const index = found >= 0 ? found : 0
  const current = set[index] ?? null
  const target = current?.id ?? null

  // Keep the sheet on a flight of the set: the first when none is chosen (the pill) or the chosen one left the set.
  useEffect(() => {
    if (view.review && view.flight !== target) openFlight(target, { review: true })
  }, [view.review, view.flight, target, openFlight])

  const latest = useRef({ view, set })
  useEffect(() => { latest.current = { view, set } })
  const operations = useRef(new Set<AbortController>())
  useEffect(() => { const running = operations.current; return () => running.forEach(controller => controller.abort()) }, [])

  if (!view.review) return null

  const confirm = async () => {
    const flight = current
    if (!flight || !online || busy) return
    setBusy(true)
    say(null)
    const controller = new AbortController()
    operations.current.add(controller)
    const generation = getAuthGeneration()
    const receipts = receiptTransport()
    const transit = decisions.get(flight.id)
    const result = await confirmFlights({
      flights: [flight], queue, signal: controller.signal, transport: receipts.transport,
      ...(transit === undefined ? {} : { arrivalTransit: new Map([[flight.id, transit]]) }),
    })
    // Unmounted: nothing here belongs to a page any more.
    if (controller.signal.aborted) { operations.current.delete(controller); return }
    setBusy(false)
    switch (result.outcome) {
      case 'confirmed': {
        setResolved(old => new Set(old).add(flight.id))
        const { view: now, set: shown } = latest.current
        // Advance only when the sheet is still on this flight in review mode (the member may have closed it meanwhile).
        if (now.review && now.flight === flight.id) {
          const next = nextAfter(shown, flight.id)
          openFlight(next?.id ?? null, { review: true })
          if (!next) setEnding('confirmed')
        }
        void refresh()
        announce()
        const confirmed = t.confirmed(routeOf(flight))
        const last = receipts.last()
        if (result.derivedState !== 'pending' || !last) {
          operations.current.delete(controller)
          say({ text: confirmed + stampText(locale, result.newlyStampedCountries), alert: false })
          return
        }
        // Publication is pending: wait for it, then read this operation's receipt again for the stamps.
        const seq = say({ text: `${confirmed} ${t.publishing}`, alert: false })
        const isCurrent = () => !controller.signal.aborted && generation === getAuthGeneration()
        const release = trackPrivateOperation(controller)
        let text = `${confirmed} ${t.publishDelayed}`
        try {
          if (await awaitPublication(last.outcome.revision, controller.signal, isCurrent) === 'ready') {
            const receipt = await api.post<ConfirmOutcome>('/api/flights/confirm', last.request, { signal: controller.signal })
            if (receipt.derivedState === 'ready') text = confirmed + stampText(locale, receipt.newlyStampedCountries)
          }
        } catch { /* the delayed line stays */ } finally { release(); operations.current.delete(controller) }
        if (isCurrent() && noteSeq.current === seq) say({ text, alert: false })
        return
      }
      case 'stale':
        operations.current.delete(controller)
        say({ text: t.sessionChanged, alert: true })
        return
      case 'nothing':
        operations.current.delete(controller)
        // No token: the flight is beyond the queue's first 100 or the queue could not be read. Otherwise it already left the queue.
        say({ text: result.skipped.noToken.length ? t.noToken : t.notAwaiting, alert: true })
        if (!result.skipped.noToken.length) void refresh()
        return
      case 'rejected':
        operations.current.delete(controller)
        say({ text: t.rejected, alert: true })
        void refresh()
        return
      default:
        // `unknown` (and `partial`, which one flight cannot reach): it may have committed.
        operations.current.delete(controller)
        say({ text: t.unknown, alert: true })
        void refresh()
        announce()
    }
  }

  const didNotFly = () => {
    const flight = current
    if (!flight || !online || busy) return
    const next = nextAfter(set, flight.id)
    say(null)
    setRemovedId(flight.id)
    scheduleDelete([flight.id], {
      label: t.removing(routeOf(flight)),
      // The docked pane is not modal: the toast's Undo takes focus. The overlay traps focus, so its own Undo line does.
      focusUndo: docked,
      onUndo: () => { openFlight(flight.id, { review: true }); setFocusKey(key => key + 1) },
    })
    openFlight(next?.id ?? null, { review: true })
    if (!next) setEnding('removed')
  }

  const goNext = () => {
    const next = set[index + 1]
    if (!next || busy) return
    say(null)
    openFlight(next.id, { review: true })
  }

  const ownPending = !docked && pending && pending.ids.length === 1 && pending.ids[0] === removedId ? pending : null
  const undoLine = ownPending ? <ReviewUndo locale={locale} pending={ownPending} onUndo={undo} /> : null
  const outcome = <ReviewNote note={note} />

  if (!current) {
    const message = ending === 'confirmed' ? t.allConfirmed : ending === 'removed' ? t.nothingLeft : t.empty
    return {
      top: null, status: null, footer: null,
      placeholder: { title: t.title, content: <ReviewEmpty message={message} closeLabel={t.close} onClose={closeSheet}>{outcome}{undoLine}</ReviewEmpty> },
    }
  }

  const entry = queue?.awaitingFlights.find(item => item.flight.id === current.id) ?? null
  return {
    status: <div className="journal-review-status">
      <p className="journal-review-count">{t.position(formatNumber(locale, index + 1), formatNumber(locale, set.length))}</p>
      {undoLine}
    </div>,
    top: <ReviewQuestion locale={locale} entry={entry} decision={decisions.get(current.id)}
      onDecision={value => setDecisions(old => new Map(old).set(current.id, value))}
      busy={busy} online={online} offlineNoteId={offlineNoteId} focusKey={focusKey}
      onFlew={() => void confirm()} onDidNotFly={didNotFly}>{outcome}</ReviewQuestion>,
    footer: <Button disabled={busy || index >= set.length - 1} onClick={goNext}>{t.next}</Button>,
    placeholder: null,
  }
}

/** The outcome line. Both live regions stay mounted with the block, so a message after an advance is still announced. */
function ReviewNote({ note }: { note: Note | null }) {
  return <>
    <p className="journal-review-note" role="status">{note && !note.alert ? note.text : ''}</p>
    <p className="journal-review-note" role="alert">{note?.alert ? note.text : ''}</p>
  </>
}

function ReviewQuestion({ locale, entry, decision, onDecision, busy, online, offlineNoteId, focusKey, onFlew, onDidNotFly, children }: {
  locale: Locale; entry: QueueEntry | null; decision: boolean | undefined; onDecision: (transit: boolean) => void
  busy: boolean; online: boolean; offlineNoteId: string; focusKey: number; onFlew: () => void; onDidNotFly: () => void; children: ReactNode
}) {
  const t = copy[locale]
  const questionId = useId()
  const flew = useRef<HTMLButtonElement>(null)
  // After Undo returns the sheet to a removed flight, focus lands on its question.
  useEffect(() => { if (focusKey) flew.current?.focus() }, [focusKey])
  const offline = !online ? offlineNoteId : undefined
  const candidate = entry && entry.candidate.kind !== 'none' ? entry.candidate : null
  const basis = candidate?.label === 'estimated' ? t.estimated : candidate?.label === 'ambiguous' ? t.ambiguous : t.precise
  return <section className="journal-review" aria-labelledby={questionId}>
    <h3 id={questionId} className="journal-review-question">{t.question}</h3>
    {entry && candidate && <div className="journal-review-transit">
      <p>{t.connection}: {entry.flight.destination}{candidate.leg && <> → {candidate.leg.destination}</>} · {basis}</p>
      {/* Same default as the old queue: unticked means transit (the server's suggestion) until the member says otherwise. */}
      {candidate.kind === 'link' && <Checkbox label={t.leftAirport} checked={!(decision ?? entry.effectiveDefault.transit)}
        disabled={!online || busy} aria-describedby={offline} onChange={event => onDecision(!event.target.checked)} />}
    </div>}
    <div className="journal-review-actions">
      <Button ref={flew} variant="primary" disabled={!online} loading={busy} loadingLabel={t.confirming} aria-describedby={offline} onClick={onFlew}>{t.flew}</Button>
      <Button disabled={!online || busy} aria-describedby={offline} onClick={onDidNotFly}>{t.didNotFly}</Button>
    </div>
    {children}
  </section>
}

/** The overlay's own Undo for a review "Did not fly": the modal sheet keeps focus and pointer input inside it. */
function ReviewUndo({ locale, pending, onUndo }: { locale: Locale; pending: PendingDelete; onUndo: () => void }) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => { button.current?.focus() }, [])
  return <DeleteUndoLine ref={button} locale={locale} pending={pending} onUndo={onUndo} />
}

function ReviewEmpty({ message, closeLabel, onClose, children }: { message: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const close = useRef<HTMLButtonElement>(null)
  // The question that had focus is gone: land on Close rather than the page body.
  useEffect(() => { if (document.activeElement === null || document.activeElement === document.body) close.current?.focus() }, [])
  return <div className="journal-review-empty">
    <p role="status">{message}</p>
    {children}
    <Button ref={close} onClick={onClose}>{closeLabel}</Button>
  </div>
}
