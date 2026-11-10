'use client'

import { useEffect, useRef, useState } from 'react'
import { Car, MoreHorizontal, PlaneLanding, PlaneTakeoff, Plus, Train } from '@keyline-icons/react'
import { useQuery } from '@tanstack/react-query'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import {
  addGroundVisit,
  claimCountry,
  deleteGroundVisit,
  unclaimCountry,
  updateGroundVisit,
} from '@kuuki/client/passport'
import type { DerivedAck } from '@kuuki/client/derivedState'
import { trackPrivateOperation } from '../activity'
import { useWriteFeedback } from '../write-feedback'
import { NavigationLink } from '../navigation-link'
import { CountryStamp } from '../stamps'
import { Button } from '../ui/button'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { Field } from '../ui/field'
import { Menu, MenuItem } from '../ui/menu'
import { SegmentedControl } from '../ui/segmented-control'
import { Sheet } from '../ui/sheet'
import {
  formatCount,
  formatDateOnly,
  formatNumber,
  pluralCategory,
  type Locale,
} from '../../lib/format'
import { journalHref } from '../../lib/url-state'
import type { CountryDetail } from '../../server/passport'
import {
  arrivalFlightId,
  arrivalHref,
  chronology,
  formatVisitPoint,
  isCatalogCountry,
  removalOutcome,
  type PassportEntry,
} from './model'
import { SHEET_STAMP_SIZE } from './stamp-sizes'
import {
  rowWayLabel,
  VISIT_WAYS,
  visitFlightHref,
  WAY_LABELS,
  wayOf,
  wayPayload,
  type VisitWay,
} from './visit-ways'
import './passport.css'

type GroundEntry = Extract<CountryDetail['entries'][number], { kind: 'ground' }>
type JourneySource = CountryDetail['journeys'][number]

const JOURNEY_FALLBACK: Record<JourneySource['mode'], Record<Locale, string>> = {
  rail: { en: 'Train journey', ru: 'Поездка на поезде' },
  road: { en: 'Road trip', ru: 'Поездка на авто' },
}

/** "3 Oct 2026", "3 Oct 2026 – 9 Oct 2026" or null when neither end is known. */
function journeyDates(locale: Locale, journey: JourneySource): string | null {
  const start = journey.startDate?.slice(0, 10)
  const end = journey.endDate?.slice(0, 10)
  if (start && end && start !== end)
    return `${formatDateOnly(locale, start)} – ${formatDateOnly(locale, end)}`
  const only = start ?? end
  return only ? formatDateOnly(locale, only) : null
}

const MANUAL_VISIT_FORMS = {
  en: { one: '{count} manual visit', other: '{count} manual visits' },
  ru: {
    one: '{count} ручной визит',
    few: '{count} ручных визита',
    many: '{count} ручных визитов',
    other: '{count} ручного визита',
  },
}

/** One country's published evidence, shared by the sheet and the pending slots that resolve their arrival card from it. */
export function countryDetailQuery(ownerId: string, code: string) {
  return {
    queryKey: ['passport-country', ownerId, code] as const,
    staleTime: 30_000,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const controller = new AbortController()
      const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try {
        return await api.get<CountryDetail>(`/api/passport/countries/${code}/stats`, undefined, {
          signal: controller.signal,
        })
      } finally {
        untrack()
      }
    },
  }
}

export function CountrySheet({
  ownerId,
  locale,
  code: selected,
  entry,
  publishedRevision,
  mobile,
  name,
  onClose,
  onChanged,
  onRemoved,
  onHidden,
  onCloseAutoFocus,
}: {
  ownerId: string
  locale: Locale
  code: string | null
  entry: PassportEntry | undefined
  /** The collection's published revision: when it moves past the detail's, the detail is out of date. */
  publishedRevision: number
  mobile: boolean
  name: (code: string) => string
  onClose: () => void
  /** A write landed: refresh the collection; `added` is true when the country was not in the passport before. */
  onChanged: (code: string, added: boolean) => Promise<void> | void
  onRemoved: (code: string) => void
  /** The country was hidden from the passport: close the sheet, refresh and offer Undo. */
  onHidden: (code: string) => Promise<void> | void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const ru = locale === 'ru'
  // Only catalog countries get a sheet: its write actions would otherwise press a code with no region or outline.
  const code = selected && isCatalogCountry(selected) ? selected : null
  const feedback = useWriteFeedback(ownerId)
  const detail = useQuery({ ...countryDetailQuery(ownerId, code ?? ''), enabled: !!code })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [year, setYear] = useState('')
  // A legacy land visit has no segment of its own: it stays `land` (and is left out of the PATCH) until a way is picked.
  const [way, setWay] = useState<VisitWay | 'land'>('other')
  // The visit the form is editing; null means the form adds a new one.
  const [editing, setEditing] = useState<string | null>(null)
  // A country already in the passport keeps the add form behind its button until asked for.
  const [adding, setAdding] = useState(false)
  const [focusYear, setFocusYear] = useState(false)
  const yearField = useRef<HTMLInputElement | null>(null)
  const [note, setNote] = useState('')
  const [deleting, setDeleting] = useState<GroundEntry | null>(null)
  const [removing, setRemoving] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [hideError, setHideError] = useState('')
  const countryMenu = useRef<HTMLButtonElement | null>(null)
  const addButton = useRef<HTMLButtonElement | null>(null)
  const deleteButton = useRef<HTMLButtonElement | null>(null)
  const form = useRef<HTMLFormElement | null>(null)
  const [shownCode, setShownCode] = useState(code)
  const shownRef = useRef(code)
  // What the fields hold now, for a save that resolves after the member kept typing.
  const draft = useRef({ year, note })
  useEffect(() => {
    draft.current = { year, note }
  }, [year, note])
  // A closed sheet keeps its last country, so a save that completes while it is closed still clears the saved draft.
  useEffect(() => {
    shownRef.current = code ?? shownRef.current
  }, [code])
  if (code && code !== shownCode) {
    setShownCode(code)
    setNotice('')
    setError('')
    setHideError('')
    setYear('')
    setNote('')
    setWay('other')
    setEditing(null)
    setAdding(false)
  }

  const data = detail.data?.countryCode === code ? detail.data : undefined
  // A write can read the detail before its publication lands; the later page refresh only updates the collection.
  // Once the collection is newer, it states the country's status and the detail reloads (once per revision).
  const behind = !!data && publishedRevision > data.publishedRevision
  const { refetch } = detail
  useEffect(() => {
    if (behind) void refetch()
  }, [behind, publishedRevision, data?.publishedRevision, refetch])
  // Editing a visit moves focus to its year once the form has rendered with it.
  useEffect(() => {
    if (!focusYear) return
    const frame = requestAnimationFrame(() => {
      const field = yearField.current
      field?.focus({ preventScroll: true })
      field?.scrollIntoView?.({ block: 'nearest' })
      setFocusYear(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [focusYear])
  // C3 keeps failure apart from pending (`last_error`): a failed derivation is an error with a retry, not "preparing".
  const derivedFailed = !!data && !behind && !detail.isError && data.derivedState === 'error'
  const preparing =
    !!data &&
    !behind &&
    !derivedFailed &&
    (data.derivedState !== 'ready' || data.publishedRevision < data.revision)
  const title = code ? name(code) : ''
  const yearValue = year.trim() ? Number(year) : null
  const yearInvalid =
    yearValue !== null && (!Number.isInteger(yearValue) || yearValue < 1800 || yearValue > 2200)

  /** Runs one write; resolves after the collection refresh, rejects (for DestructiveConfirm) when it failed. */
  async function write(run: () => Promise<DerivedAck>, done: string, added = false) {
    if (!code) return
    const target = code
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const ack = await run()
      if (!current()) return
      feedback.acknowledge(ack)
      setNotice(done)
      await Promise.all([detail.refetch(), onChanged(target, added)])
    } catch (cause) {
      if (current())
        setError(
          ru
            ? 'Не удалось сохранить. Проверьте сеть и повторите.'
            : 'Could not save. Check your connection and try again.',
        )
      throw cause
    } finally {
      release()
      if (current()) setBusy(false)
    }
  }

  /** Hiding is presentation only (PUT /api/passport/hidden/:cc): records and statistics stay. No confirm; Undo is the net. */
  async function hide() {
    if (!code) return
    const target = code
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    setHiding(true)
    setHideError('')
    try {
      await api.put(`/api/passport/hidden/${target}`, undefined, { signal: controller.signal })
      if (!current()) return
      await onHidden(target)
    } catch {
      if (current())
        setHideError(
          ru
            ? 'Не удалось скрыть страну. Проверьте сеть и повторите.'
            : 'Could not hide this country. Check your connection and try again.',
        )
    } finally {
      release()
      if (current()) setHiding(false)
    }
  }

  const ignore = () => {}

  function leaveEdit() {
    setEditing(null)
    setAdding(false)
    setYear('')
    setNote('')
    setWay('other')
  }

  /** Puts the form into edit mode for one visit and moves focus to its year. */
  function startEdit(item: GroundEntry) {
    const stored = data?.groundVisits.find((visit) => visit.id === item.id)
    setEditing(item.id)
    setAdding(false)
    setYear(item.visitYear === null ? '' : String(item.visitYear))
    setNote(stored?.note ?? '')
    setWay(wayOf(item))
    setNotice('')
    setError('')
    setFocusYear(true)
  }
  const status = data && !behind ? data.status : (entry?.status ?? 'none')
  const inPassport = status !== 'none'
  const flights = data?.entries.filter((item) => item.kind === 'flight') ?? []
  const legacy = data?.entries.filter((item) => item.kind === 'legacy') ?? []
  const ground = (data?.entries.filter((item) => item.kind === 'ground') ?? []) as GroundEntry[]
  const journeys = data?.journeys ?? []
  const claim = data?.entries.find((item) => item.kind === 'claim')
  const outcome = data ? removalOutcome(data) : null
  // The projection leaves first/last NULL for land/sea-only countries; their years still date the visit.
  const dates = chronology(
    [data?.firstVisit, data?.lastVisit],
    ground.map((visit) => visit.visitYear),
  )
  // Adding is the whole job for a country outside the passport; otherwise the record comes first and the form waits.
  const formOpen = !inPassport || adding || editing !== null
  const editingEntry = editing ? ground.find((item) => item.id === editing) : undefined
  const held = stampHeldCopy(locale, journeys.length > 0)
  const formWasOpen = useRef(formOpen)
  useEffect(() => {
    const was = formWasOpen.current
    formWasOpen.current = formOpen
    if (was === formOpen) return
    // Add visit unmounts as the form opens: land on the form's first choice. Closing it from inside hands focus back.
    if (formOpen && adding)
      form.current
        ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
        ?.focus({ preventScroll: true })
    else if (!formOpen && (!document.activeElement || document.activeElement === document.body))
      addButton.current?.focus({ preventScroll: true })
  }, [formOpen, adding])

  const claimWithoutVisit = () =>
    void write(
      () => claimCountry(ownerId, code!),
      ru ? 'Страна отмечена.' : 'Country claimed.',
      !inPassport,
    ).catch(ignore)

  const countryActions =
    data && inPassport ? (
      <Menu
        align="end"
        trigger={
          <button
            ref={countryMenu}
            type="button"
            className="ui-icon-button passport-sheet-menu"
            aria-label={ru ? 'Действия со страной' : 'Country actions'}
            disabled={busy || hiding}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
        }
      >
        {!data.isClaimed ? (
          <MenuItem onSelect={claimWithoutVisit}>
            {ru ? 'Отметить без визита' : 'Claim without a visit'}
          </MenuItem>
        ) : null}
        {/* Hiding is undone from its toast, so it needs no confirmation and no explanation here. */}
        {status === 'pressed' ? (
          <MenuItem onSelect={() => void hide()}>
            {ru ? 'Скрыть из паспорта' : 'Hide from passport'}
          </MenuItem>
        ) : null}
        <MenuItem danger onSelect={() => setRemoving(true)}>
          {ru ? 'Удалить страну…' : 'Remove country…'}
        </MenuItem>
      </Menu>
    ) : null

  return (
    <Sheet
      open={!!code}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      side={mobile ? 'bottom' : 'right'}
      initialDetent={1}
      title={title}
      closeLabel={ru ? 'Закрыть' : 'Close'}
      className="passport-sheet-panel"
      titleAction={countryActions}
      onCloseAutoFocus={onCloseAutoFocus}
      description={
        status === 'pending'
          ? ru
            ? 'Ждёт отметки'
            : 'Waiting for confirmation'
          : status === 'none'
            ? ru
              ? 'Пока не в паспорте'
              : 'Not in your passport yet'
            : undefined
      }
    >
      <div className="passport-sheet">
        {entry ? (
          <div className="passport-sheet-stamp" data-sheet-stamp={entry.code}>
            <CountryStamp
              iso2={entry.code}
              status={entry.status === 'pending' ? 'pending' : 'inked'}
              size={SHEET_STAMP_SIZE}
              static
            />
          </div>
        ) : null}
        {status === 'pending' ? (
          <p className="passport-note">
            {ru
              ? 'Перелёт в эту страну ещё не подтверждён, поэтому штамп не поставлен.'
              : 'A flight to this country is not confirmed yet, so the stamp is not pressed.'}{' '}
            <a href={arrivalHref(data ? arrivalFlightId(data) : null)}>
              {ru ? 'Открыть карточку прилёта' : 'Open the arrival card'}
            </a>
          </p>
        ) : null}
        {detail.isError ? (
          <p role="alert">
            {data
              ? ru
                ? 'Не удалось обновить страну. Показаны последние загруженные данные.'
                : 'Could not refresh this country. Showing the last loaded details.'
              : ru
                ? 'Не удалось загрузить страну.'
                : 'Could not load this country.'}{' '}
            <Button dense onClick={() => void detail.refetch()}>
              {ru ? 'Повторить' : 'Try again'}
            </Button>
          </p>
        ) : null}
        {derivedFailed ? (
          <p role="alert">
            {ru
              ? 'Не удалось обновить итоги по стране. Визиты сохранены, но данные здесь могут быть устаревшими.'
              : "This country's totals could not be updated. Your visits are saved, but what you see here may be out of date."}{' '}
            <Button
              dense
              loading={detail.isFetching}
              loadingLabel={ru ? 'Проверяем…' : 'Checking…'}
              onClick={() => void detail.refetch()}
            >
              {ru ? 'Повторить' : 'Try again'}
            </Button>
          </p>
        ) : null}
        {preparing || (behind && detail.isFetching) ? (
          <p role="status" className="passport-note">
            {ru
              ? 'Последние изменения ещё обрабатываются. Данные страны могут отставать.'
              : 'Recent changes are still being prepared. This country may lag behind them.'}
          </p>
        ) : null}
        {hideError ? <p role="alert">{hideError}</p> : null}
        {!data && !detail.isError ? (
          <p role="status" className="passport-note">
            {ru ? 'Загружаем…' : 'Loading…'}
          </p>
        ) : null}
        {data ? (
          <>
            {inPassport ? (
              <dl>
                <div>
                  <dt>{ru ? 'Первый визит' : 'First visit'}</dt>
                  <dd>
                    {dates.first
                      ? formatVisitPoint(locale, dates.first, 'date')
                      : ru
                        ? 'без даты'
                        : 'no date'}
                  </dd>
                </div>
                <div>
                  <dt>{ru ? 'Последний визит' : 'Last visit'}</dt>
                  <dd>
                    {dates.last
                      ? formatVisitPoint(locale, dates.last, 'date')
                      : ru
                        ? 'без даты'
                        : 'no date'}
                  </dd>
                </div>
              </dl>
            ) : null}

            {flights.length || legacy.length || claim || ground.length || data.suppressed.length ? (
              <section aria-labelledby="passport-visits">
                <h3 id="passport-visits">
                  {ru ? 'Визиты' : 'Visits'} · {formatNumber(locale, data.totalVisits)}
                </h3>
                {/* Arc Timeline (uiarc.dev, MIT; docs/research/2026-10-08-arc-source-inventory.md): dated source rows with a marker column.
              Static evidence, no activity-feed clock, connectors, expansion or fabricated dates for year-only visits and legacy counters. */}
                {flights.length ? (
                  <ol
                    className="passport-list passport-timeline"
                    aria-label={ru ? 'Визиты по перелётам' : 'Flight visits'}
                  >
                    {flights.map((item) =>
                      item.kind === 'flight' ? (
                        <li key={`${item.flightId}-${item.endpoint}`}>
                          <a href={journalHref({ flight: item.flightId })}>
                            {item.endpoint === 'destination' ? (
                              <PlaneLanding size={18} aria-hidden="true" />
                            ) : (
                              <PlaneTakeoff size={18} aria-hidden="true" />
                            )}
                            <span>
                              <time dateTime={item.date.slice(0, 10)}>
                                {formatDateOnly(locale, item.date.slice(0, 10))}
                              </time>{' '}
                              ·{' '}
                              {item.endpoint === 'destination'
                                ? ru
                                  ? `прилёт в ${item.airport}`
                                  : `arrived at ${item.airport}`
                                : ru
                                  ? `вылет из ${item.airport}`
                                  : `departed ${item.airport}`}
                            </span>
                          </a>
                          {item.state === 'awaiting' ? (
                            <span className="passport-note">{ru ? 'ждёт отметки' : 'waiting'}</span>
                          ) : null}
                        </li>
                      ) : null,
                    )}
                  </ol>
                ) : null}
                {legacy.length || claim || ground.length ? (
                  <ul className="passport-list">
                    {legacy.map((item) =>
                      item.kind === 'legacy' ? (
                        <li key={`legacy-${item.airport}`}>
                          <span>
                            {item.airport} · ×{formatNumber(locale, item.visitCount)}{' '}
                            <span className="passport-note">
                              {ru
                                ? '— архивный счётчик из прежнего журнала'
                                : '— archived counter from your earlier journal'}
                            </span>
                          </span>
                        </li>
                      ) : null,
                    )}
                    {claim && claim.kind === 'claim' ? (
                      <li>
                        <span>
                          {ru ? 'Отмечена без перелётов' : 'Claimed without flights'}
                          {claim.claimedAt
                            ? ` · ${formatDateOnly(locale, claim.claimedAt.slice(0, 10))}`
                            : ''}
                        </span>
                      </li>
                    ) : null}
                    {ground.map((item) => {
                      const label = `${item.visitYear ?? (ru ? 'Год не указан' : 'Year not set')} · ${rowWayLabel(item, locale)}`
                      const visit = data.groundVisits.find((visit) => visit.id === item.id)
                      const visitNote = visit?.note
                      // The row is the way in: editing opens the form, which also holds Delete.
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="passport-visit-row"
                            aria-label={ru ? `Изменить визит: ${label}` : `Edit visit: ${label}`}
                            aria-pressed={editing === item.id}
                            disabled={busy}
                            onClick={() => startEdit(item)}
                          >
                            {label}
                            {visitNote ? (
                              <span className="passport-note"> · {visitNote}</span>
                            ) : null}
                          </button>
                          {item.entryMethod === 'air' && !visit?.linkedFlightId ? (
                            <NavigationLink
                              className="ui-button"
                              data-variant="ghost"
                              href={visitFlightHref(item.id)}
                            >
                              <PlaneLanding size={18} aria-hidden="true" />
                              {ru ? 'Добавить перелёт' : 'Add flight'}
                            </NavigationLink>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                {data.suppressed.length ? (
                  <ul
                    className="passport-list"
                    aria-label={
                      ru
                        ? 'Пересадки, не засчитанные как визит'
                        : 'Connections not counted as a visit'
                    }
                  >
                    {data.suppressed.map((item) => (
                      <li key={`${item.flightId}-${item.endpoint}`}>
                        <a href={journalHref({ flight: item.flightId })}>{item.airport}</a>
                        <span className="passport-note">
                          {ru ? 'пересадка, не визит' : 'connection, not a visit'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {formOpen ? (
              <section aria-labelledby="passport-add-visit">
                <h3 id="passport-add-visit">
                  {editing
                    ? ru
                      ? 'Изменить визит'
                      : 'Edit visit'
                    : ru
                      ? 'Новый визит'
                      : 'New visit'}
                </h3>
                <form
                  ref={form}
                  className="passport-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (yearInvalid || busy) return
                    const submitted = { code: code!, year, note }
                    if (editing) {
                      void write(
                        () =>
                          updateGroundVisit(ownerId, editing, {
                            visitYear: yearValue,
                            note: note.trim() || null,
                            // A legacy land visit keeps its stored way until a segment is picked.
                            ...(way === 'land' ? {} : wayPayload(way)),
                          }),
                        ru ? 'Визит обновлён.' : 'Visit updated.',
                      ).then(() => {
                        if (shownRef.current === submitted.code) leaveEdit()
                      }, ignore)
                      return
                    }
                    const added = !inPassport
                    void write(
                      () =>
                        addGroundVisit(ownerId, code!, {
                          visitYear: yearValue,
                          note: note.trim() || null,
                          ...wayPayload(way === 'land' ? 'other' : way),
                        }),
                      ru ? 'Визит добавлен.' : 'Visit added.',
                      added,
                    ).then(() => {
                      // Both fields stay editable during the save: clear only what is still the submitted text, on the submitted country.
                      if (shownRef.current !== submitted.code) return
                      const untouched =
                        draft.current.year === submitted.year &&
                        draft.current.note === submitted.note
                      setYear((current) => (current === submitted.year ? '' : current))
                      setNote((current) => (current === submitted.note ? '' : current))
                      // The new visit is in the list now; a draft typed during the save keeps the form open.
                      if (untouched) setAdding(false)
                    }, ignore)
                  }}
                >
                  <SegmentedControl
                    label={ru ? 'Как вы въехали' : 'How you entered'}
                    value={way}
                    onChange={setWay}
                    options={VISIT_WAYS.map((value) => ({
                      value,
                      label: WAY_LABELS[value][locale],
                    }))}
                  />
                  <div className="passport-form-row">
                    <Field
                      label={ru ? 'Год' : 'Year'}
                      className="passport-year-field"
                      ref={yearField}
                      inputMode="numeric"
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                      error={
                        yearInvalid
                          ? ru
                            ? 'Год от 1800 до 2200'
                            : 'A year from 1800 to 2200'
                          : undefined
                      }
                    />
                    <Field
                      label={ru ? 'Заметка' : 'Note'}
                      maxLength={200}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                  <div className="read-actions">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={busy}
                      loadingLabel={ru ? 'Сохраняем…' : 'Saving…'}
                    >
                      {editing
                        ? ru
                          ? 'Сохранить'
                          : 'Save changes'
                        : ru
                          ? 'Добавить визит'
                          : 'Add visit'}
                    </Button>
                    {editing || inPassport ? (
                      <Button disabled={busy} onClick={leaveEdit}>
                        {ru ? 'Отмена' : 'Cancel'}
                      </Button>
                    ) : null}
                    {!inPassport && !data.isClaimed ? (
                      <Button disabled={busy} onClick={claimWithoutVisit}>
                        {ru ? 'Отметить без визита' : 'Claim without a visit'}
                      </Button>
                    ) : null}
                    {editingEntry ? (
                      <Button
                        ref={deleteButton}
                        variant="danger"
                        className="passport-form-delete"
                        disabled={busy}
                        onClick={() => setDeleting(editingEntry)}
                      >
                        {ru ? 'Удалить визит' : 'Delete visit'}
                      </Button>
                    ) : null}
                  </div>
                </form>
              </section>
            ) : (
              <div>
                <Button
                  ref={addButton}
                  icon={<Plus size={18} aria-hidden="true" />}
                  onClick={() => {
                    setAdding(true)
                    setNotice('')
                    setError('')
                  }}
                >
                  {ru ? 'Добавить визит' : 'Add visit'}
                </Button>
              </div>
            )}

            <p role="status" className="passport-note">
              {notice}
              {notice && feedback.status === 'pending'
                ? ru
                  ? ' Итоги обновляются.'
                  : ' Totals are updating.'
                : ''}
            </p>
            {error ? <p role="alert">{error}</p> : null}

            {journeys.length ? (
              <section aria-labelledby="passport-journeys">
                <h3 id="passport-journeys">
                  {ru ? 'Наземные поездки' : 'Ground journeys'} ·{' '}
                  {formatNumber(locale, journeys.length)}
                </h3>
                <ul
                  className="passport-list passport-timeline"
                  aria-label={ru ? 'Наземные поездки' : 'Ground journeys'}
                >
                  {journeys.map((journey) => {
                    const dates = journeyDates(locale, journey)
                    const Icon = journey.mode === 'rail' ? Train : Car
                    return (
                      <li key={journey.id}>
                        <NavigationLink
                          href={`/ground-travel?journey=${encodeURIComponent(journey.id)}`}
                        >
                          <Icon size={18} aria-hidden="true" />
                          <span>
                            {journey.title ||
                              journey.route ||
                              JOURNEY_FALLBACK[journey.mode][locale]}{' '}
                            · {dates ?? (ru ? 'дата неизвестна' : 'date unknown')}
                          </span>
                        </NavigationLink>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            {data.airports.length ? (
              <section aria-labelledby="passport-airports">
                <h3 id="passport-airports">{ru ? 'Аэропорты' : 'Airports'}</h3>
                <ul className="passport-list">
                  {data.airports.map((airport) => (
                    <li key={airport.iata}>
                      <a href={journalHref({ airport: airport.iata })}>
                        {airport.iata}
                        {airport.city ? ` · ${airport.city}` : ''}
                      </a>
                      <span className="passport-note">
                        ×{formatNumber(locale, airport.visitCount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <DestructiveConfirm
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={
          deleting?.visitYear
            ? ru
              ? `Удалить визит ${deleting.visitYear} года?`
              : `Delete the ${deleting.visitYear} visit?`
            : ru
              ? 'Удалить визит без даты?'
              : 'Delete the undated visit?'
        }
        consequence={deleting && data ? groundCopy(locale, data, name(data.countryCode)) : ''}
        confirmLabel={ru ? 'Удалить визит' : 'Delete visit'}
        cancelLabel={ru ? 'Отмена' : 'Cancel'}
        pendingLabel={ru ? 'Удаляем…' : 'Deleting…'}
        errorMessage={
          ru ? 'Не удалось удалить визит. Повторите.' : 'Could not delete the visit. Try again.'
        }
        onCloseAutoFocus={(event) => {
          // Cancelled: back to Delete visit (the opener). Deleted: the form closed, so Add visit takes focus.
          if (!deleteButton.current?.isConnected && addButton.current?.isConnected) {
            event.preventDefault()
            addButton.current.focus()
          }
        }}
        onConfirm={async () => {
          const target = deleting!
          await write(
            () => deleteGroundVisit(ownerId, target.id),
            ru ? 'Визит удалён.' : 'Visit deleted.',
          )
          if (editing === target.id) leaveEdit()
          setDeleting(null)
        }}
      />

      <DestructiveConfirm
        open={removing}
        onOpenChange={setRemoving}
        title={ru ? `Удалить из паспорта: ${title}?` : `Remove ${title} from your passport?`}
        consequence={!outcome ? '' : outcome.removable ? removalCopy(locale, outcome) : held.fact}
        confirmDisabledReason={outcome && !outcome.removable ? held.fix : undefined}
        confirmLabel={ru ? 'Удалить страну' : 'Remove country'}
        cancelLabel={ru ? 'Отмена' : 'Cancel'}
        pendingLabel={ru ? 'Удаляем…' : 'Removing…'}
        errorMessage={
          ru ? 'Не удалось удалить страну. Повторите.' : 'Could not remove the country. Try again.'
        }
        onCloseAutoFocus={(event) => {
          if (countryMenu.current?.isConnected) {
            event.preventDefault()
            countryMenu.current.focus()
          }
        }}
        onConfirm={async () => {
          const target = code!
          await write(
            () => unclaimCountry(ownerId, target),
            ru ? 'Отметка и визиты удалены.' : 'Claim and visits removed.',
          )
          setRemoving(false)
          if (outcome?.after === 'gone') onRemoved(target)
        }}
      />
    </Sheet>
  )
}

/** What DELETE /api/passport/claims/:cc does, stated exactly: claim and every land/sea visit go, flights stay. */
export function removalCopy(locale: Locale, outcome: ReturnType<typeof removalOutcome>): string {
  const ru = locale === 'ru'
  const parts: string[] = []
  const visits = outcome.groundVisits
    ? formatCount(locale, outcome.groundVisits, MANUAL_VISIT_FORMS)
    : ''
  if (outcome.claimed && outcome.groundVisits)
    parts.push(
      ru ? `Будут удалены ваша отметка и ${visits}.` : `This deletes your claim and ${visits}.`,
    )
  else if (outcome.claimed)
    parts.push(ru ? 'Будет удалена ваша отметка.' : 'This deletes your claim.')
  else
    parts.push(
      ru
        ? `${pluralCategory('ru', outcome.groundVisits) === 'one' ? 'Будет удалён' : 'Будут удалены'} ${visits}.`
        : `This deletes ${visits}.`,
    )
  parts.push(
    outcome.journeys
      ? ru
        ? 'Перелёты и наземные поездки не удаляются.'
        : 'Flights and ground journeys are not deleted.'
      : ru
        ? 'Перелёты в журнале не удаляются.'
        : 'Flights in your journal are not deleted.',
  )
  parts.push(
    outcome.journeys
      ? ru
        ? 'Наземные поездки по-прежнему ведут в эту страну, поэтому штамп останется.'
        : 'Ground journeys still reach this country, so its stamp stays.'
      : outcome.after === 'pressed'
        ? ru
          ? 'Перелёты по-прежнему ведут в эту страну, поэтому штамп останется.'
          : 'Flights still reach this country, so its stamp stays.'
        : outcome.after === 'pending'
          ? ru
            ? 'Останется только неподтверждённый перелёт: страна будет ждать отметки.'
            : 'Only an unconfirmed flight remains, so the country will wait for confirmation.'
          : ru
            ? 'Штамп исчезнет из паспорта.'
            : 'The stamp disappears from your passport.',
  )
  return parts.join(' ')
}

/** Why a stamp cannot be removed here (`fact`) and what removes it instead (`fix`, shown as the disabled reason). */
function stampHeldCopy(locale: Locale, journeys: boolean): { fact: string; fix: string } {
  const ru = locale === 'ru'
  return journeys
    ? {
        fact: ru
          ? 'Этот штамп поставлен перелётами и наземными поездками.'
          : 'Flights and ground journeys press this stamp.',
        fix: ru
          ? 'Чтобы убрать его, удалите или измените их.'
          : 'To remove it, delete or change them.',
      }
    : {
        fact: ru ? 'Этот штамп поставлен перелётами.' : 'Flights press this stamp.',
        fix: ru
          ? 'Чтобы убрать его, удалите или измените эти перелёты в журнале.'
          : 'To remove it, delete or change those flights in the Journal.',
      }
}

function groundCopy(locale: Locale, data: CountryDetail, country: string): string {
  const ru = locale === 'ru'
  const outcome = removalOutcome(data)
  const last = !outcome.claimed && outcome.groundVisits === 1
  if (last && outcome.after === 'gone')
    return ru
      ? `Это последняя запись о стране «${country}»: штамп исчезнет из паспорта.`
      : `This is the last record for ${country}: its stamp disappears from your passport.`
  if (last && outcome.after === 'pending')
    return ru
      ? 'Останется только неподтверждённый перелёт: страна будет ждать отметки.'
      : 'Only an unconfirmed flight remains, so the country will wait for confirmation.'
  return ru
    ? 'Удаляется только этот визит. Остальные записи о стране остаются.'
    : "Only this visit is deleted. The rest of this country's record stays."
}
