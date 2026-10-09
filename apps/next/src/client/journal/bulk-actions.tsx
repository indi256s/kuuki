'use client'
// Selection and bulk actions on the Journal (spec "Selection and bulk actions", D1, D5). The floating bar shows while
// any ticked flight passes the filters and acts only on those (`selected`, the store's `selectedVisible`), never on
// ticks the filters hide.
//
// - Delete and Did not fly: no confirm dialog. The selection clears and the rows go to the page's one deferred delete
//   (`journal-delete.tsx`): hidden at once, 6 s Undo in the toast region with focus on it. Undo brings the rows back and
//   focuses the first; a failed delete brings them back and says so. A new delete commits a pending one first.
// - Set aircraft: fills only flights without an aircraft unless "Replace all" is ticked, through `aircraft-batch` in
//   sequential chunks of 20.
// - I flew: `confirmFlights` over the awaiting flights; upcoming and flown ones are skipped and counted.
// - Export: OpenFlights CSV of the selection, built in the browser.
// Offline, every write is blocked and points at the page's offline note; Export still works.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { formatCount, formatNumber, type CountForms, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import type { AwaitingQueue } from '../awaiting'
import { acceptAircraft, countAircraftRun, type AircraftAccept } from '../import/aircraft-review'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Combobox, type Choice } from '../ui/combobox'
import { Dialog } from '../ui/dialog'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { confirmFlights, partitionPending, type ConfirmFlightsResult } from './confirm-flights'
import { downloadCsv, exportFileName, openFlightsCsv } from './export-csv'
import { focusRowOrHeading, useJournalDelete } from './journal-delete'
import type { JournalFlight, JournalRefs } from './model'
import './bulk-actions.css'

const forms = (en: CountForms['en'], ru: CountForms['ru']): CountForms => ({ en, ru })

const plural = {
  selected: forms(
    { one: '{count} selected', other: '{count} selected' },
    {
      one: 'Выбран {count} перелёт',
      few: 'Выбрано {count} перелёта',
      many: 'Выбрано {count} перелётов',
      other: 'Выбрано {count} перелёта',
    },
  ),
  upcoming: forms(
    { one: '{count} upcoming', other: '{count} upcoming' },
    {
      one: '{count} предстоящий',
      few: '{count} предстоящих',
      many: '{count} предстоящих',
      other: '{count} предстоящего',
    },
  ),
  flown: forms(
    { one: '{count} already flown', other: '{count} already flown' },
    {
      one: '{count} уже выполненный',
      few: '{count} уже выполненных',
      many: '{count} уже выполненных',
      other: '{count} уже выполненного',
    },
  ),
  didNotFly: forms(
    { one: 'Did not fly, remove {count}', other: 'Did not fly, remove {count}' },
    {
      one: 'Не летали, удалить {count}',
      few: 'Не летали, удалить {count}',
      many: 'Не летали, удалить {count}',
      other: 'Не летали, удалить {count}',
    },
  ),
  confirmed: forms(
    { one: 'Confirmed {count} flight.', other: 'Confirmed {count} flights.' },
    {
      one: 'Подтверждён {count} перелёт.',
      few: 'Подтверждено {count} перелёта.',
      many: 'Подтверждено {count} перелётов.',
      other: 'Подтверждено {count} перелёта.',
    },
  ),
  /** "for N flights", the noun after "for" / «для». */
  forFlights: forms(
    { one: '{count} flight', other: '{count} flights' },
    {
      one: '{count} перелёта',
      few: '{count} перелётов',
      many: '{count} перелётов',
      other: '{count} перелёта',
    },
  ),
  setFor: forms(
    { one: 'Set for {count} flight', other: 'Set for {count} flights' },
    {
      one: 'Указать для {count} перелёта',
      few: 'Указать для {count} перелётов',
      many: 'Указать для {count} перелётов',
      other: 'Указать для {count} перелёта',
    },
  ),
  setForAll: forms(
    { one: 'Set for {count} flight', other: 'Set for all {count}' },
    {
      one: 'Указать для {count} перелёта',
      few: 'Указать для всех {count}',
      many: 'Указать для всех {count}',
      other: 'Указать для всех {count}',
    },
  ),
  replaceAll: forms(
    { one: 'Replace on {count} flight', other: 'Replace all {count}' },
    {
      one: 'Заменить у {count} перелёта',
      few: 'Заменить у всех {count}',
      many: 'Заменить у всех {count}',
      other: 'Заменить у всех {count}',
    },
  ),
}

const copy = {
  en: {
    region: 'Selection',
    toolbar: 'Selection actions',
    clear: 'Clear',
    selectAll: (count: string) => `Select all ${count} matching`,
    setAircraft: 'Set aircraft',
    iFlew: (count: string) => `I flew (${count})`,
    iFlewIdle: 'I flew',
    didNotFlyIdle: 'Did not fly',
    confirming: 'Confirming…',
    export: 'Export CSV',
    delete: 'Delete',
    retry: 'Try again',
    skipped: (parts: string) => `Skipped: ${parts}.`,
    noneAwaiting: 'None of the selected flights are waiting for confirmation.',
    notConfirmedRest: 'The rest could not be confirmed.',
    noToken: (count: string) => `${count} could not be confirmed right now. Try again later.`,
    rejected: 'Could not confirm the flights. The list is refreshing.',
    unknown:
      'Could not check whether the flights were confirmed. The list is refreshing; check it before trying again.',
    nothingConfirmed: 'None of these flights are waiting for confirmation any more.',
    aircraft: 'Aircraft',
    cancel: 'Cancel',
    saving: 'Saving…',
    fillOnly: (empty: string, set: string) =>
      `Set for ${empty} without aircraft (${set} already set)`,
    allSet: 'Every selected flight already has an aircraft. Tick the box above to replace them.',
    replaceNote: (set: string) => `${set} already have an aircraft. Ticking this replaces it.`,
    chooseAircraft: 'Choose an aircraft from the list.',
    loadingAircraft: 'Loading aircraft…',
    loadFailed: 'Could not load the aircraft list. Try again.',
    aircraftSet: (flights: string) => `Aircraft set for ${flights}.`,
    aircraftPartial: (saved: string, total: string) => `Aircraft set for ${saved} of ${total}.`,
    notSaved: (count: string) => `Not saved: ${count}.`,
    unchecked: (count: string) => `Could not check: ${count}. The list is refreshing.`,
  },
  ru: {
    region: 'Выбранные перелёты',
    toolbar: 'Действия с выбранными',
    clear: 'Снять выбор',
    selectAll: (count: string) => `Выбрать все найденные: ${count}`,
    setAircraft: 'Указать самолёт',
    iFlew: (count: string) => `Подтвердить (${count})`,
    iFlewIdle: 'Подтвердить',
    didNotFlyIdle: 'Не летали',
    confirming: 'Подтверждаем…',
    export: 'Экспорт CSV',
    delete: 'Удалить',
    retry: 'Повторить',
    skipped: (parts: string) => `Пропущены: ${parts}.`,
    noneAwaiting: 'Среди выбранных нет перелётов, которые ждут подтверждения.',
    notConfirmedRest: 'Остальные подтвердить не удалось.',
    noToken: (count: string) => `Не удалось подтвердить сейчас: ${count}. Повторите позже.`,
    rejected: 'Не удалось подтвердить перелёты. Список обновляется.',
    unknown:
      'Не удалось проверить, подтверждены ли перелёты. Список обновляется; проверьте его, прежде чем повторить.',
    nothingConfirmed: 'Эти перелёты уже не ждут подтверждения.',
    aircraft: 'Самолёт',
    cancel: 'Отмена',
    saving: 'Сохраняем…',
    fillOnly: (empty: string, set: string) =>
      `Указать для ${empty} без самолёта (у ${set} уже указан)`,
    allSet:
      'У всех выбранных перелётов уже указан самолёт. Отметьте поле выше, чтобы заменить его.',
    replaceNote: (set: string) => `Уже указан самолёт: ${set}. Отметка заменит его.`,
    chooseAircraft: 'Выберите самолёт из списка.',
    loadingAircraft: 'Загружаем самолёты…',
    loadFailed: 'Не удалось загрузить список самолётов. Повторите.',
    aircraftSet: (flights: string) => `Самолёт указан для ${flights}.`,
    aircraftPartial: (saved: string, total: string) => `Самолёт указан для ${saved} из ${total}.`,
    notSaved: (count: string) => `Не сохранено: ${count}.`,
    unchecked: (count: string) => `Не удалось проверить: ${count}. Список обновляется.`,
  },
} as const

type Status = { key: string; text: string; alert: boolean }

export type JournalBulkActionsProps = {
  locale: Locale
  /** Ticked flights that pass the filters, in ledger order (the store's `selectedVisible`). Every action uses only these. */
  selected: readonly JournalFlight[]
  /** Every flight the filters match, for "Select all M matching". */
  matching: readonly JournalFlight[]
  refs: JournalRefs
  /** `useAwaiting().data`: its candidate tokens are tried first for I flew. */
  queue: AwaitingQueue | null
  online: boolean
  /** The page's `OfflineNote` id; blocked writes point `aria-describedby` at it while offline. */
  offlineNoteId: string
  onSelectAll: (ids: number[]) => void
  onClear: () => void
  refresh: () => Promise<unknown>
}

const describe = (...ids: (string | false | null | undefined)[]) =>
  ids.filter(Boolean).join(' ') || undefined
const announceChange = () => window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))

export function JournalBulkActions({
  locale,
  selected,
  matching,
  refs,
  queue,
  online,
  offlineNoteId,
  onSelectAll,
  onClear,
  refresh,
}: JournalBulkActionsProps) {
  const t = copy[locale]
  const { scheduleDelete } = useJournalDelete()
  const noteId = useId()
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [aircraftOpen, setAircraftOpen] = useState(false)
  const operations = useRef(new Set<AbortController>())
  useEffect(() => {
    const running = operations.current
    return () => running.forEach((controller) => controller.abort())
  }, [])

  const ids = useMemo(() => selected.map((flight) => flight.id), [selected])
  const key = ids.join(',')
  const parts = useMemo(() => partitionPending(selected), [selected])

  // Deferred delete (spec D1): Delete and Did not fly both end in the page's one deferred delete.
  const remove = (target: number[]) => {
    if (!online || !target.length) return
    onClear()
    scheduleDelete(target)
  }

  const confirmAwaiting = async () => {
    if (!online || confirming || !parts.awaiting.length) return
    setConfirming(true)
    setStatus(null)
    const controller = new AbortController()
    operations.current.add(controller)
    const result = await confirmFlights({ flights: selected, queue, signal: controller.signal })
    operations.current.delete(controller)
    // Unmounted, signed out or switched owner: nothing here belongs to this page any more.
    if (result.outcome === 'stale') return
    setConfirming(false)
    if (result.outcome !== 'nothing') {
      void refresh()
      announceChange()
    }
    setStatus({ key, ...confirmMessage(locale, result) })
  }

  const exportSelection = () =>
    downloadCsv(exportFileName(new Date()), openFlightsCsv([...selected], refs))

  const clearAndFocus = () => {
    onClear()
    focusRowOrHeading(ids)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The aircraft dialog renders in a portal: React bubbles its keys here, the DOM does not contain them.
    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      !event.currentTarget.contains(event.target as Node)
    )
      return
    event.preventDefault()
    clearAndFocus()
  }

  const offline = !online && offlineNoteId
  const skippedParts = [
    parts.upcoming.length > 0 && formatCount(locale, parts.upcoming.length, plural.upcoming),
    parts.notAwaiting.length > 0 && formatCount(locale, parts.notAwaiting.length, plural.flown),
  ]
    .filter(Boolean)
    .join(', ')
  const pendingNote = !parts.awaiting.length
    ? t.noneAwaiting
    : skippedParts
      ? t.skipped(skippedParts)
      : null
  const writeBlocked = !online || confirming
  const shownStatus = status?.key === key ? status : null

  if (!selected.length) return null
  return (
    <div className="journal-bulk" onKeyDown={onKeyDown}>
      <FloatingActionBar
        label={t.region}
        countLabel={formatCount(locale, selected.length, plural.selected)}
      >
        <div role="toolbar" aria-label={t.toolbar} className="journal-bulk-toolbar">
          <div className="journal-bulk-group">
            {selected.length < matching.length && (
              <Button
                dense
                variant="ghost"
                onClick={() => onSelectAll(matching.map((flight) => flight.id))}
              >
                {t.selectAll(formatNumber(locale, matching.length))}
              </Button>
            )}
            <Button dense variant="ghost" onClick={clearAndFocus}>
              {t.clear}
            </Button>
          </div>
          <div className="journal-bulk-group">
            <SetAircraft
              locale={locale}
              flights={selected}
              online={online}
              offlineNoteId={offlineNoteId}
              blocked={writeBlocked}
              open={aircraftOpen}
              onOpenChange={setAircraftOpen}
              refresh={refresh}
              onSaved={(text) => setStatus({ key, text, alert: false })}
              operations={operations}
            />
            <Button
              dense
              disabled={writeBlocked || !parts.awaiting.length}
              loading={confirming}
              loadingLabel={t.confirming}
              aria-describedby={describe(offline, pendingNote && noteId)}
              onClick={() => void confirmAwaiting()}
            >
              {parts.awaiting.length
                ? t.iFlew(formatNumber(locale, parts.awaiting.length))
                : t.iFlewIdle}
            </Button>
            <Button
              dense
              disabled={writeBlocked || !parts.awaiting.length}
              aria-describedby={describe(offline, pendingNote && noteId)}
              onClick={() => remove(parts.awaiting)}
            >
              {parts.awaiting.length
                ? formatCount(locale, parts.awaiting.length, plural.didNotFly)
                : t.didNotFlyIdle}
            </Button>
            <Button dense onClick={exportSelection}>
              {t.export}
            </Button>
            <Button
              dense
              variant="danger"
              disabled={writeBlocked}
              aria-describedby={describe(offline)}
              onClick={() => remove(ids)}
            >
              {t.delete}
            </Button>
          </div>
        </div>
        {pendingNote && (
          <p id={noteId} className="journal-bulk-note">
            {pendingNote}
          </p>
        )}
        <p className="journal-bulk-status" role={shownStatus?.alert ? 'alert' : 'status'}>
          {shownStatus?.text ?? ''}
        </p>
      </FloatingActionBar>
    </div>
  )
}

function confirmMessage(
  locale: Locale,
  result: ConfirmFlightsResult,
): { text: string; alert: boolean } {
  const t = copy[locale]
  const done = result.confirmed.length
    ? formatCount(locale, result.confirmed.length, plural.confirmed)
    : ''
  switch (result.outcome) {
    case 'confirmed': {
      const missing = result.skipped.noToken.length
        ? ` ${t.noToken(formatNumber(locale, result.skipped.noToken.length))}`
        : ''
      return { text: done + missing, alert: false }
    }
    case 'nothing':
      return {
        text: result.skipped.noToken.length
          ? t.noToken(formatNumber(locale, result.skipped.noToken.length))
          : t.nothingConfirmed,
        alert: true,
      }
    case 'partial':
      return { text: `${done} ${t.notConfirmedRest}`, alert: true }
    case 'unknown':
      return { text: t.unknown, alert: true }
    default:
      return { text: t.rejected, alert: true }
  }
}

type SetAircraftProps = {
  locale: Locale
  flights: readonly JournalFlight[]
  online: boolean
  offlineNoteId: string
  /** Offline or another write is running. */
  blocked: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  refresh: () => Promise<unknown>
  onSaved: (message: string) => void
  operations: RefObject<Set<AbortController>>
}

/** "Set aircraft": fill-only by default (D5), "Replace all" needs its own tick. Sequential `aircraft-batch` chunks of 20. */
function SetAircraft({
  locale,
  flights,
  online,
  offlineNoteId,
  blocked,
  open,
  onOpenChange,
  refresh,
  onSaved,
  operations,
}: SetAircraftProps) {
  const t = copy[locale]
  const [choices, setChoices] = useState<Choice[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [code, setCode] = useState('')
  const [replace, setReplace] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; alert: boolean } | null>(null)
  const replaceId = useId()

  // The aircraft catalogue is large: load it the first time the dialog opens.
  const [loadAttempt, setLoadAttempt] = useState(0)
  useEffect(() => {
    if (!open || choices) return
    let active = true
    import('../capture/reference-choices').then(
      (module) => {
        if (active) {
          setChoices(module.aircraftChoices)
          setLoadFailed(false)
        }
      },
      () => {
        if (active) setLoadFailed(true)
      },
    )
    return () => {
      active = false
    }
  }, [open, choices, loadAttempt])

  const empty = flights.filter((flight) => !flight.aircraft_icao)
  const already = flights.length - empty.length
  const targets = replace ? flights : empty
  const n = (value: number) => formatNumber(locale, value)
  const submitLabel = replace
    ? formatCount(locale, flights.length, plural.setForAll)
    : !empty.length
      ? t.setAircraft
      : already
        ? t.fillOnly(n(empty.length), n(already))
        : formatCount(locale, empty.length, plural.setFor)

  const changeOpen = (next: boolean) => {
    if (saving && !next) return
    if (next) {
      setReplace(false)
      setMessage(null)
      setCode('')
    }
    onOpenChange(next)
  }

  const save = async () => {
    if (saving || !online || !targets.length) return
    const icao = code.trim().toUpperCase()
    if (!choices?.some((choice) => choice.code === icao)) {
      setMessage({ text: t.chooseAircraft, alert: true })
      return
    }
    const generation = getAuthGeneration()
    const controller = new AbortController()
    operations.current.add(controller)
    const release = trackPrivateOperation(controller)
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    setSaving(true)
    setMessage(null)
    const items = targets.map((flight) => ({ id: flight.id, aircraft_icao: icao }))
    let run: Awaited<ReturnType<typeof acceptAircraft>>
    try {
      run = await acceptAircraft(items, (chunk) =>
        current()
          ? api.post<AircraftAccept>(
              '/api/flights/aircraft-batch',
              { items: chunk, replaceAll: replace },
              { signal: controller.signal },
            )
          : Promise.reject(new DOMException('Session changed', 'AbortError')),
      )
    } finally {
      release()
      operations.current.delete(controller)
    }
    // A sign-out or owner switch happened meanwhile: this answer belongs to another identity and is never shown.
    if (!current()) return
    setSaving(false)
    const counts = countAircraftRun(run.rows.values())
    if (counts.saved || counts.uncertain) {
      void refresh()
      window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
    }
    if (counts.saved === items.length) {
      onSaved(t.aircraftSet(formatCount(locale, counts.saved, plural.forFlights)))
      onOpenChange(false)
      return
    }
    const notSaved = items.length - counts.saved - counts.uncertain
    setMessage({
      alert: true,
      text: [
        t.aircraftPartial(n(counts.saved), formatCount(locale, items.length, plural.forFlights)),
        notSaved > 0 && t.notSaved(n(notSaved)),
        counts.uncertain > 0 && t.unchecked(n(counts.uncertain)),
      ]
        .filter(Boolean)
        .join(' '),
    })
  }

  const offline = !online ? offlineNoteId : undefined
  const trigger = (
    <Button dense disabled={blocked} aria-describedby={offline}>
      {t.setAircraft}
    </Button>
  )
  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      trigger={trigger}
      title={t.setAircraft}
      closeLabel={t.cancel}
      dismissible={!saving}
      className="journal-bulk-dialog"
    >
      <div className="journal-bulk-form">
        {choices ? (
          <Combobox
            label={t.aircraft}
            value={code}
            onChange={setCode}
            choices={choices}
            locale={locale}
            disabled={saving}
          />
        ) : loadFailed ? (
          <p role="alert" className="journal-bulk-note">
            {t.loadFailed}{' '}
            <Button dense onClick={() => setLoadAttempt((value) => value + 1)}>
              {t.retry}
            </Button>
          </p>
        ) : (
          <p role="status" className="journal-bulk-note">
            {t.loadingAircraft}
          </p>
        )}
        {already > 0 && (
          <Checkbox
            id={replaceId}
            checked={replace}
            disabled={saving}
            onChange={(event) => setReplace(event.target.checked)}
            label={formatCount(locale, flights.length, plural.replaceAll)}
            description={t.replaceNote(n(already))}
          />
        )}
        <p className="journal-bulk-status" role={message?.alert ? 'alert' : 'status'}>
          {message?.text ?? ''}
        </p>
        <div className="journal-bulk-dialog-actions">
          <Button onClick={() => changeOpen(false)} disabled={saving}>
            {t.cancel}
          </Button>
          <Button
            variant="primary"
            loading={saving}
            loadingLabel={t.saving}
            disabledReason={!targets.length ? t.allSet : undefined}
            disabled={!online || !choices}
            aria-describedby={offline}
            onClick={() => void save()}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
