'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  Fragment,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  placeLabel,
  railRouteRuns,
  type GroundCommand,
  type GroundJourneyDto,
  type GroundMode,
  type GroundPlaceSnapshot,
  type GroundStatus,
} from '@kuuki/shared/groundTravel'
import { formatCount, formatDateOnly, type Locale } from '../../../lib/format'
import { trackPrivateOperation } from '../../activity'
import { announceShellNotice } from '../../shell-notices'
import { Alert } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Disclosure } from '../../ui/disclosure'
import { Field } from '../../ui/field'
import { SegmentedControl } from '../../ui/segmented-control'
import { countryNamer } from '../../passport/model'
import { readJourney, readOperation, sendCommand } from '../api'
import { copy } from '../copy'
import { GroundFormSkeleton } from '../ground-skeleton'
import { CountriesFieldset, type CountriesValue } from './countries-fieldset'
import { createDraftWriter, readDraft, removeDraft, type Draft, type DraftKind } from './draft'
import { DateField, errorText, TextAreaField } from './fields'
import { MetricsPreview } from './metrics-preview'
import {
  blankState,
  buildCommandBody,
  type CommandBody,
  countriesAnswered,
  newId,
  routeCountryCodes,
  routeSummary,
  stateFromDto,
  validateState,
  type FormState,
} from './model'
import { RailEditor, type RailOcrSlotApi, type StoredOcrRow } from './rail-editor'
import { RoadEditor } from './road-editor'
import { savedHref } from './return-context'
import {
  attemptSave,
  checkSave,
  commandFor,
  rereadSaved,
  saveReducer,
  type Attempt,
  type CheckOutcome,
  type SaveDeps,
  type SaveOutcome,
} from './save'
import './ground-form.css'

const noSubscribe = () => () => {}
const useMounted = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )
const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}
const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true,
  )

/** Whether the form still says what the frozen command sent: same route, dates, title, note and countries. */
function sameContent(command: GroundCommand, body: CommandBody | null): boolean {
  if (!body || !('journey' in command) || !('journey' in body)) return false
  return (
    JSON.stringify([command.journey, command.countries]) ===
    JSON.stringify([body.journey, body.countries])
  )
}

const deps: SaveDeps = {
  send: (command, signal) => sendCommand(command, { signal }),
  read: (id, signal) => readJourney(id, { signal }),
  operation: (key, signal) => readOperation(key, { signal }),
}

export interface JourneyFormProps {
  ownerId: string
  locale: Locale
  mode: GroundMode
  /** The stored journey when editing or completing; absent when creating. */
  existing?: GroundJourneyDto
  /** `?complete=1`: the stored plan is being completed through the review. */
  complete?: boolean
  /** Allowlisted list address (see return-context.ts) for Cancel and for the saved journey. */
  returnTo: string
  /**
   * Mount point for the rail ticket reader. Called with the entry point that hands recognized legs to the
   * form (`onCandidates(legs, 'append' | 'replace', replaceLegId?)`); rail journeys only.
   */
  ocrSlot?: (api: RailOcrSlotApi) => ReactNode
}

export function JourneyForm(props: JourneyFormProps) {
  const mounted = useMounted()
  // Unfinished input lives in localStorage, so the form is built on the client only: no hydration mismatch.
  if (!mounted) return <GroundFormSkeleton label={copy[props.locale].loadingForm} />
  return <FormBody {...props} />
}

interface Boot {
  state: FormState
  journeyId: string
  baseVersion: number | null
  savedStatus?: GroundStatus
  pending: GroundCommand | null
  ocr: StoredOcrRow[]
  restored: boolean
  unreadable: boolean
}

function boot(
  ownerId: string,
  kind: DraftKind,
  mode: GroundMode,
  existing: GroundJourneyDto | undefined,
  complete: boolean,
): Boot {
  const base = existing ? stateFromDto(existing, complete) : blankState(mode)
  const fresh: Boot = {
    state: base,
    journeyId: existing?.id ?? newId(),
    baseVersion: existing?.version ?? null,
    savedStatus: existing?.status,
    pending: null,
    ocr: [],
    restored: false,
    unreadable: false,
  }
  const stored = readDraft(ownerId, kind, mode)
  if (stored.status === 'invalid') return { ...fresh, unreadable: true }
  if (stored.status === 'none') return fresh
  const { draft } = stored
  // An edit draft belongs to this journey; a leftover for another status choice is not carried over.
  return {
    state: existing && complete ? { ...draft.state, status: 'completed' } : draft.state,
    journeyId: existing?.id ?? draft.journeyId,
    baseVersion: draft.baseVersion ?? existing?.version ?? null,
    savedStatus: existing?.status ?? draft.savedStatus,
    pending: draft.pending,
    ocr: draft.ocr ?? [],
    restored: true,
    unreadable: false,
  }
}

function FormBody({
  ownerId,
  locale,
  mode,
  existing,
  complete = false,
  returnTo,
  ocrSlot,
}: JourneyFormProps) {
  const ru = locale === 'ru'
  const router = useRouter()
  const online = useOnline()
  const kind: DraftKind = existing ? `edit-${existing.id}` : `new-${mode}`
  const [initial] = useState(() => boot(ownerId, kind, mode, existing, complete))
  const [state, setState] = useState(initial.state)
  const [restored, setRestored] = useState(initial.restored)
  const [unreadable, setUnreadable] = useState(initial.unreadable)
  const [storageFailed, setStorageFailed] = useState(false)
  const [touched, setTouched] = useState(initial.restored)
  const [showErrors, setShowErrors] = useState(false)
  const [validationAttempt, setValidationAttempt] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [reviewSaved, setReviewSaved] = useState(false)
  const [existingStatus, setExistingStatus] = useState(initial.savedStatus)
  const [baseVersion, setBaseVersion] = useState(initial.baseVersion)
  const [ocrRows, setOcrRows] = useState(initial.ocr)
  const [ocrEpoch, setOcrEpoch] = useState(0)
  const [laterEdits, setLaterEdits] = useState(false)
  const [rebased, setRebased] = useState(false)
  const [rereading, setRereading] = useState(false)
  const [rereadFailed, setRereadFailed] = useState(false)
  const focusCountries = useRef(false)
  const journeyId = initial.journeyId
  const [save, dispatch] = useReducer(saveReducer, initial.pending, (pending) =>
    pending
      ? {
          phase: 'unknown' as const,
          command: pending,
          checking: false,
          notFound: false,
          checkFailed: false,
        }
      : { phase: 'idle' as const },
  )
  const attempt = useRef<Attempt | null>(
    initial.pending ? { key: initial.pending.operationKey, signature: '' } : null,
  )
  const alive = useRef(true)
  const finished = useRef(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const formId = 'ground-journey-form'

  const writer = useMemo(
    () => createDraftWriter(ownerId, kind, (stored) => setStorageFailed(!stored)),
    [ownerId, kind],
  )
  useEffect(() => {
    alive.current = true
    // A write queued for the owner who just left must not land after the identity reset.
    const unwatch = writer.watchIdentityReset()
    return () => {
      alive.current = false
      unwatch()
      writer.flush()
    }
  }, [writer])

  const pending = save.phase === 'saving' || save.phase === 'unknown' ? save.command : null
  useEffect(() => {
    if (!touched || finished.current) return
    const draft: Draft = {
      v: 1,
      journeyId,
      baseVersion,
      savedStatus: existingStatus,
      state,
      pending,
      ocr: ocrRows,
    }
    writer.schedule(draft)
    // A write in flight is unconfirmed the moment the page may go away: record it now, not after the debounce.
    if (pending) writer.flush()
  }, [state, touched, pending, baseVersion, existingStatus, journeyId, ocrRows, writer])

  // What the async save paths compare against: the form as it is now, not as it was when the request left.
  const latest = useRef({ state, existingStatus, baseVersion })
  useEffect(() => {
    latest.current = { state, existingStatus, baseVersion }
  })
  const onUnaddedChange = useCallback((rows: StoredOcrRow[]) => {
    setOcrRows((current) => (current.length === 0 && rows.length === 0 ? current : rows))
    if (rows.length > 0) setTouched(true)
  }, [])

  const change = useCallback((next: (current: FormState) => FormState) => {
    setTouched(true)
    setState(next)
  }, [])

  const noticePhase = save.phase
  useEffect(() => {
    if (noticePhase === 'unknown' || noticePhase === 'conflict' || noticePhase === 'gone')
      noticeRef.current?.focus()
  }, [noticePhase])

  const review = state.status === 'completed'
  const errors = useMemo(() => validateState(state), [state])
  const name = useMemo(() => countryNamer(locale), [locale])
  const placeName = useCallback((place: GroundPlaceSnapshot) => placeLabel(place, locale), [locale])
  const routeCodes = useMemo(() => routeCountryCodes(state), [state])
  if (showErrors && (errors.title || errors.note) && !detailsOpen) setDetailsOpen(true)
  const saving = save.phase === 'saving'
  const countriesMissing = review && !countriesAnswered(state)

  const finish = (
    result: { journeyId: string; derivedState: 'ready' | 'pending'; savedVersion: number },
    command: GroundCommand,
  ) => {
    // A late answer must not erase what was typed after the request left: keep the form and the draft, move the
    // baseline to what was saved, and say the newer edits still need their own save.
    const now = latest.current
    if (!sameContent(command, buildCommandBody(now.state, bodyTarget(now)))) {
      attempt.current = null
      setBaseVersion(result.savedVersion)
      setExistingStatus(
        command.action === 'create'
          ? command.status
          : command.action === 'complete'
            ? 'completed'
            : now.existingStatus,
      )
      setLaterEdits(true)
      dispatch({ type: 'dismiss' })
      return
    }
    finished.current = true
    writer.cancel()
    removeDraft(ownerId, kind)
    announceShellNotice(ownerId, {
      kind: 'success',
      message:
        result.derivedState === 'pending'
          ? ru
            ? 'Сохранено. Итоги ещё обновляются.'
            : 'Saved. Totals are still updating.'
          : ru
            ? 'Путешествие сохранено'
            : 'Journey saved',
    })
    router.push(savedHref(returnTo, result.journeyId))
  }

  const bodyTarget = (now: typeof latest.current) => ({
    journeyId,
    existing: now.existingStatus,
    expectedVersion: now.baseVersion ?? undefined,
  })

  const settle = (outcome: SaveOutcome, command: GroundCommand) => {
    if (!alive.current) return
    if (outcome.kind === 'saved') return finish(outcome.result, command)
    dispatch({ type: 'outcome', outcome, command })
  }

  const run = async (command: GroundCommand) => {
    setLaterEdits(false)
    dispatch({ type: 'start', command })
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    try {
      settle(await attemptSave(command, deps, controller.signal), command)
    } finally {
      release()
    }
  }

  useEffect(() => {
    if (validationAttempt === 0) return
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [validationAttempt])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (saving || !online || save.phase === 'unknown' || save.phase === 'gone') return
    const body =
      Object.keys(errors).length === 0
        ? buildCommandBody(state, {
            journeyId,
            existing: existingStatus,
            expectedVersion: baseVersion ?? undefined,
          })
        : null
    if (!body) {
      setShowErrors(true)
      setValidationAttempt((value) => value + 1)
      return
    }
    const next = commandFor(body, attempt.current, newId)
    attempt.current = next.attempt
    void run(next.command)
  }

  const check = async () => {
    if (save.phase !== 'unknown') return
    const command = save.command
    dispatch({ type: 'check-start' })
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    try {
      const outcome: CheckOutcome = await checkSave(command, deps, controller.signal)
      if (!alive.current) return
      if (outcome.kind === 'saved') return finish(outcome.result, command)
      dispatch({ type: 'check-done', outcome })
    } finally {
      release()
    }
  }

  const applyOnTop = () => {
    if (save.phase !== 'conflict' || !save.current) return
    const current = save.current
    // The baseline moves first, so even a refused apply leaves the next save aimed at the version on the server.
    setExistingStatus(current.status)
    setBaseVersion(current.version)
    attempt.current = null
    const body = buildCommandBody(state, {
      journeyId,
      existing: current.status,
      expectedVersion: current.version,
    })
    if (!body) {
      // The saved journey was completed elsewhere and this edit is still a plan: it needs the countries answer.
      setState((value) => ({ ...value, status: 'completed' }))
      setShowErrors(true)
      setRebased(true)
      focusCountries.current = true
      dispatch({ type: 'dismiss' })
      return
    }
    const next = commandFor(body, attempt.current, newId)
    attempt.current = next.attempt
    void run(next.command)
  }

  const reread = async () => {
    if (save.phase !== 'conflict' || rereading) return
    setRereading(true)
    setRereadFailed(false)
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    try {
      const outcome = await rereadSaved(journeyId, deps, controller.signal)
      if (!alive.current) return
      if (outcome.kind === 'read') dispatch({ type: 'conflict-read', current: outcome.current })
      else if (outcome.kind === 'gone')
        dispatch({ type: 'outcome', outcome: { kind: 'gone' }, command: save.command })
      else if (outcome.kind === 'failed') setRereadFailed(true)
    } finally {
      release()
      if (alive.current) setRereading(false)
    }
  }

  useEffect(() => {
    if (!focusCountries.current || !review) return
    focusCountries.current = false
    document.getElementById('gt-countries-h')?.focus()
  })

  const discard = () => {
    writer.cancel()
    removeDraft(ownerId, kind)
    attempt.current = null
    setOcrRows([])
    setOcrEpoch((epoch) => epoch + 1)
    setLaterEdits(false)
    setRebased(false)
    setState(existing ? stateFromDto(existing, complete) : blankState(mode))
    setRestored(false)
    setUnreadable(false)
    setTouched(false)
    setShowErrors(false)
  }

  const shown = (key: string) => (showErrors ? errorText(errors[key], locale) : undefined)
  const countriesValue: CountriesValue = {
    countries: state.countries,
    noCountries: state.noCountries,
  }
  const children = state.mode === 'rail' ? state.legs.length : state.points.length

  // A journey created by this very form is stored from then on: further saves are edits of it.
  const stored = existing !== undefined || existingStatus !== undefined
  const intent = stored
    ? review && existingStatus !== 'completed'
      ? 'complete'
      : 'edit'
    : review
      ? 'create-done'
      : 'create-plan'
  const saveLabel =
    intent === 'complete'
      ? ru
        ? 'Завершить путешествие'
        : 'Complete journey'
      : intent === 'create-done'
        ? ru
          ? 'Сохранить поездку'
          : 'Save journey'
        : intent === 'create-plan'
          ? ru
            ? 'Сохранить план'
            : 'Save plan'
          : ru
            ? 'Сохранить изменения'
            : 'Save changes'

  const saveReason = !online
    ? ru
      ? 'Нет сети. Подключитесь, чтобы сохранить.'
      : 'Offline. Connect to save.'
    : save.phase === 'unknown'
      ? ru
        ? 'Сначала проверьте предыдущее сохранение.'
        : 'Resolve the unconfirmed save first.'
      : save.phase === 'conflict'
        ? ru
          ? 'Сначала решите, что делать с новой версией.'
          : 'Choose how to handle the newer version first.'
        : save.phase === 'gone'
          ? ru
            ? 'Путешествие удалено.'
            : 'This journey was deleted.'
          : countriesMissing
            ? ru
              ? 'Выберите страны поездки или «Ни одной из них».'
              : 'Choose the countries on your journey, or “None of these”.'
            : undefined

  return (
    <>
      <form
        id={formId}
        ref={formRef}
        className="gt-form"
        noValidate
        aria-busy={saving || undefined}
        onSubmit={submit}
      >
        {restored && (
          <div className="gt-restored">
            <p>{ru ? 'Незаконченная запись восстановлена' : 'Unfinished entry restored'}</p>
            <Button variant="ghost" dense disabled={save.phase !== 'idle'} onClick={discard}>
              {ru ? 'Сбросить' : 'Discard'}
            </Button>
          </div>
        )}
        {unreadable && (
          <p className="gt-muted" role="status">
            {ru
              ? 'Не удалось восстановить прежнюю запись, начинаем заново.'
              : 'We could not restore the earlier entry, so this one starts fresh.'}
          </p>
        )}
        {storageFailed && (
          <p className="gt-muted" role="status">
            {ru
              ? 'Запись сохранится, только пока открыта эта страница.'
              : 'This entry is kept only while this page is open.'}
          </p>
        )}
        <fieldset className="gt-sections" disabled={saving}>
          {!stored && (
            <section className="gt-section" aria-labelledby="gt-status-h">
              <h2 id="gt-status-h" className="gt-h">
                {ru ? 'Что это за поездка' : 'What kind of journey'}
              </h2>
              <SegmentedControl
                label={ru ? 'Статус поездки' : 'Journey status'}
                value={state.status}
                onChange={(status) => change((current) => ({ ...current, status }))}
                options={[
                  { value: 'planned', label: ru ? 'План' : 'Plan' },
                  { value: 'completed', label: ru ? 'Уже была' : 'Already happened' },
                ]}
              />
            </section>
          )}
          <section className="gt-section" aria-labelledby="gt-route-h">
            <h2 id="gt-route-h" className="gt-h">
              {ru ? 'Маршрут' : 'Route'}
            </h2>
            {errors.route && showErrors && (
              <p className="gt-error-text" role="alert">
                {errorText(errors.route, locale)}
              </p>
            )}
            {state.mode === 'rail' ? (
              <RailEditor
                ownerId={ownerId}
                legs={state.legs}
                onChange={(legs) => change((current) => ({ ...current, legs }))}
                locale={locale}
                errors={showErrors ? errors : {}}
                disabled={saving}
                ocrSlot={ocrSlot && ((api) => <Fragment key={ocrEpoch}>{ocrSlot(api)}</Fragment>)}
                ocrDraft={{ restoredRows: ocrRows, onUnaddedChange }}
              />
            ) : (
              <RoadEditor
                ownerId={ownerId}
                points={state.points}
                onChange={(points) => change((current) => ({ ...current, points }))}
                locale={locale}
                errors={showErrors ? errors : {}}
                disabled={saving}
              />
            )}
          </section>
          <section className="gt-section" aria-labelledby="gt-dates-h">
            <h2 id="gt-dates-h" className="gt-h">
              {ru ? 'Даты' : 'Dates'}
            </h2>
            <div className="gt-pair">
              <DateField
                label={ru ? 'Начало' : 'Start'}
                value={state.startDate}
                locale={locale}
                onChange={(startDate) => change((current) => ({ ...current, startDate }))}
                error={shown('startDate')}
              />
              <DateField
                label={ru ? 'Конец' : 'End'}
                value={state.endDate}
                locale={locale}
                onChange={(endDate) => change((current) => ({ ...current, endDate }))}
                error={shown('endDate')}
              />
            </div>
          </section>
          {review && (
            <section className="gt-section" aria-labelledby="gt-countries-h">
              <h2 id="gt-countries-h" className="gt-h" tabIndex={-1}>
                {ru ? 'Страны' : 'Countries'}
              </h2>
              <CountriesFieldset
                value={countriesValue}
                onChange={(value) => change((current) => ({ ...current, ...value }))}
                routeCodes={routeCodes}
                locale={locale}
                error={showErrors ? errorText(errors.countries, locale) : undefined}
              />
            </section>
          )}
          <Disclosure
            summary={ru ? 'Подробности' : 'Details'}
            open={detailsOpen || (showErrors && !!(errors.title || errors.note))}
            onOpenChange={setDetailsOpen}
          >
            <div className="gt-fields">
              <MetricsPreview state={state} locale={locale} />
              <Field
                label={ru ? 'Название' : 'Title'}
                optionalLabel={ru ? 'необязательно' : 'optional'}
                value={state.title}
                maxLength={200}
                onChange={(event) =>
                  change((current) => ({ ...current, title: event.target.value }))
                }
                error={shown('title')}
              />
              <TextAreaField
                label={ru ? 'Заметка' : 'Note'}
                optionalLabel={ru ? 'необязательно' : 'optional'}
                value={state.note}
                maxLength={10_000}
                onChange={(event) =>
                  change((current) => ({ ...current, note: event.target.value }))
                }
                error={shown('note')}
              />
            </div>
          </Disclosure>
        </fieldset>
        {laterEdits && (
          <p className="gt-muted" role="status">
            {ru
              ? 'Сохранено. Ваши более поздние правки ещё не сохранены.'
              : 'Saved. Your later edits are not saved yet.'}
          </p>
        )}
        {rebased && save.phase === 'idle' && (
          <p className="gt-muted" role="status">
            {ru
              ? 'Это путешествие уже отмечено как состоявшееся. Выберите страны поездки и сохраните снова.'
              : 'This journey was completed elsewhere. Choose the countries on your journey, then save again.'}
          </p>
        )}
        <SaveNotices
          locale={locale}
          save={save}
          placeName={placeName}
          name={name}
          noticeRef={noticeRef}
          reviewSaved={reviewSaved}
          onToggleReview={() => setReviewSaved((value) => !value)}
          onCheck={() => void check()}
          onRetry={() => save.phase === 'unknown' && void run(save.command)}
          onApplyOnTop={applyOnTop}
          rereading={rereading}
          rereadFailed={rereadFailed}
          onReread={() => void reread()}
          onLeave={() => router.push(returnTo)}
        />
        <p className="gt-muted gt-count">
          {state.mode === 'rail'
            ? formatCount(locale, children, LEGS)
            : formatCount(locale, children, STOPS)}
        </p>
        <div
          className="gt-actions gt-save-actions"
          role="group"
          aria-label={ru ? 'Действия с путешествием' : 'Journey actions'}
        >
          <Button onClick={() => router.push(returnTo)} disabled={saving}>
            {ru ? 'Отмена' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={saving}
            loadingLabel={ru ? 'Сохраняем…' : 'Saving…'}
            disabledReason={saveReason}
          >
            {saveLabel}
          </Button>
        </div>
      </form>
    </>
  )
}

const LEGS = {
  en: { one: '{count} leg', other: '{count} legs' },
  ru: {
    one: '{count} участок',
    few: '{count} участка',
    many: '{count} участков',
    other: '{count} участка',
  },
}
const STOPS = {
  en: { one: '{count} stop', other: '{count} stops' },
  ru: {
    one: '{count} пункт',
    few: '{count} пункта',
    many: '{count} пунктов',
    other: '{count} пункта',
  },
}

/** The route of a frozen command, as plain text for the notice. */
function commandRoute(command: GroundCommand, locale: Locale): string {
  if (!('journey' in command)) return ''
  const journey = command.journey
  const label = (place: GroundPlaceSnapshot) => placeLabel(place, locale)
  if (journey.mode === 'road') return journey.points.map((point) => label(point.place)).join(' → ')
  return railRouteRuns(journey.legs)
    .map((run) => run.map(label).join(' → '))
    .join(' · ')
}

function SaveNotices({
  locale,
  save,
  placeName,
  name,
  noticeRef,
  reviewSaved,
  onToggleReview,
  onCheck,
  onRetry,
  onApplyOnTop,
  rereading,
  rereadFailed,
  onReread,
  onLeave,
}: {
  locale: Locale
  save: ReturnType<typeof saveReducer>
  placeName: (place: GroundPlaceSnapshot) => string
  name: (code: string) => string
  noticeRef: React.RefObject<HTMLDivElement | null>
  reviewSaved: boolean
  onToggleReview: () => void
  onCheck: () => void
  onRetry: () => void
  onApplyOnTop: () => void
  rereading: boolean
  rereadFailed: boolean
  onReread: () => void
  onLeave: () => void
}) {
  const ru = locale === 'ru'
  if (save.phase === 'unknown') {
    const route = commandRoute(save.command, locale)
    return (
      <div ref={noticeRef} tabIndex={-1} className="gt-notices">
        {/* One live alert; the buttons sit outside it so a re-render never re-announces them. */}
        <Alert
          variant="warning"
          urgent
          title={ru ? 'Не удалось подтвердить сохранение' : 'We could not confirm the save'}
        >
          {ru
            ? 'Запись могла сохраниться. Отправленные данные заморожены; правки ниже останутся у вас и не подменят их.'
            : 'The journey may have been saved. The data that was sent is frozen; edits made since stay here and do not replace it.'}
          {route ? ` ${route}` : ''}
        </Alert>
        <div className="gt-actions">
          <Button
            loading={save.checking}
            loadingLabel={ru ? 'Проверяем…' : 'Checking…'}
            onClick={onCheck}
          >
            {ru ? 'Проверить результат' : 'Check result'}
          </Button>
          <Button variant="primary" disabled={save.checking} onClick={onRetry}>
            {ru ? 'Повторить исходное сохранение' : 'Retry original save'}
          </Button>
        </div>
        {save.notFound && (
          <p className="gt-muted" role="status">
            {ru
              ? 'Следов этого сохранения нет. Исходное можно безопасно повторить.'
              : 'No record of that save was found. Retrying the original is safe.'}
          </p>
        )}
        {save.checkFailed && (
          <p className="gt-muted" role="status">
            {ru ? 'Проверить не удалось. Попробуйте ещё раз.' : 'We could not check. Try again.'}
          </p>
        )}
      </div>
    )
  }
  if (save.phase === 'conflict') {
    const current = save.current
    const saved = current ? stateFromDto(current, false) : null
    return (
      <div ref={noticeRef} tabIndex={-1} className="gt-notices">
        <Alert
          variant="warning"
          urgent
          title={ru ? 'Путешествие изменилось в другом месте' : 'This journey changed elsewhere'}
        >
          {ru
            ? 'Ваши правки остались в форме. Ничего не объединяется само.'
            : 'Your edits are still in the form. Nothing is merged automatically.'}
        </Alert>
        <div className="gt-actions">
          {current && (
            <Button aria-expanded={reviewSaved} onClick={onToggleReview}>
              {ru ? 'Посмотреть сохранённую версию' : 'Review saved version'}
            </Button>
          )}
          {current && (
            <Button variant="primary" onClick={onApplyOnTop}>
              {ru ? 'Применить мои правки поверх' : 'Apply my changes on top'}
            </Button>
          )}
        </div>
        {current && saved && reviewSaved && (
          <dl className="gt-saved">
            <div>
              <dt>{ru ? 'Маршрут' : 'Route'}</dt>
              <dd>{routeSummary(saved, placeName) || (ru ? 'неизвестно' : 'unknown')}</dd>
            </div>
            <div>
              <dt>{ru ? 'Даты' : 'Dates'}</dt>
              <dd>
                {saved.startDate
                  ? formatDateOnly(locale, saved.startDate, 'medium')
                  : ru
                    ? 'Дата неизвестна'
                    : 'Date unknown'}
                {saved.endDate ? ` – ${formatDateOnly(locale, saved.endDate, 'medium')}` : ''}
              </dd>
            </div>
            {current.status === 'completed' && (
              <div>
                <dt>{ru ? 'Страны' : 'Countries'}</dt>
                <dd>
                  {current.countries.length > 0
                    ? current.countries.map(name).join(', ')
                    : ru
                      ? 'Ни одной'
                      : 'None'}
                </dd>
              </div>
            )}
          </dl>
        )}
        {!current && (
          <>
            <p className="gt-muted" role={rereadFailed ? 'status' : undefined}>
              {rereadFailed
                ? ru
                  ? 'Прочитать не удалось и в этот раз. Ваши правки остались в форме.'
                  : 'Still could not read it. Your edits are still in the form.'
                : ru
                  ? 'Сохранённую версию прочитать не удалось.'
                  : 'We could not read the saved version.'}
            </p>
            <div className="gt-actions">
              <Button
                variant="primary"
                loading={rereading}
                loadingLabel={ru ? 'Читаем…' : 'Reading…'}
                onClick={onReread}
              >
                {ru ? 'Прочитать сохранённую версию ещё раз' : 'Retry reading the saved version'}
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }
  if (save.phase === 'gone') {
    return (
      <div ref={noticeRef} tabIndex={-1} className="gt-notices">
        <Alert
          variant="danger"
          urgent
          title={ru ? 'Это путешествие удалено' : 'This journey was deleted'}
        />
        <div className="gt-actions">
          <Button onClick={onLeave}>{ru ? 'К списку' : 'Back to the list'}</Button>
        </div>
      </div>
    )
  }
  if (save.phase === 'rejected') {
    return (
      <p className="gt-error-text" role="alert">
        {save.message}
      </p>
    )
  }
  return null
}
