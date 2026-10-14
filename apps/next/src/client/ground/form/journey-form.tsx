'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  placeKey,
  placeLabel,
  type GroundCommand,
  type GroundJourneyDto,
  type GroundMode,
  type GroundPlaceSnapshot,
} from '@kuuki/shared/groundTravel'
import { formatCount, type Locale } from '../../../lib/format'
import { trackPrivateOperation } from '../../activity'
import { announceShellNotice } from '../../shell-notices'
import { Button } from '../../ui/button'
import { FloatingActionBar } from '../../ui/floating-action-bar'
import { Field } from '../../ui/field'
import { SegmentedControl } from '../../ui/segmented-control'
import { countryNamer } from '../../passport/model'
import { readJourney, readOperation, sendCommand } from '../api'
import { CountriesFieldset, type CountriesValue } from './countries-fieldset'
import { createDraftWriter, readDraft, removeDraft, type Draft, type DraftKind } from './draft'
import { DateField, errorText, TextAreaField } from './fields'
import { MetricsPreview } from './metrics-preview'
import {
  blankState,
  buildCommandBody,
  countriesAnswered,
  newId,
  routeCountryCodes,
  routeSummary,
  stateFromDto,
  validateState,
  type FormState,
} from './model'
import { RailEditor, type RailOcrSlotApi } from './rail-editor'
import { RoadEditor } from './road-editor'
import { savedHref } from './return-context'
import {
  attemptSave,
  checkSave,
  commandFor,
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
  if (!mounted)
    return (
      <p className="gt-loading" role="status">
        {props.locale === 'ru' ? 'Открываем форму…' : 'Opening the form…'}
      </p>
    )
  return <FormBody {...props} />
}

interface Boot {
  state: FormState
  journeyId: string
  baseVersion: number | null
  pending: GroundCommand | null
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
    pending: null,
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
    baseVersion: existing ? (draft.baseVersion ?? existing.version) : null,
    pending: draft.pending,
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
  const [reviewSaved, setReviewSaved] = useState(false)
  const [existingStatus, setExistingStatus] = useState(existing?.status)
  const [baseVersion, setBaseVersion] = useState(initial.baseVersion)
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
    return () => {
      alive.current = false
      writer.flush()
    }
  }, [writer])

  const pending = save.phase === 'saving' || save.phase === 'unknown' ? save.command : null
  useEffect(() => {
    if (!touched || finished.current) return
    const draft: Draft = { v: 1, journeyId, baseVersion, state, pending }
    writer.schedule(draft)
    // A write in flight is unconfirmed the moment the page may go away: record it now, not after the debounce.
    if (pending) writer.flush()
  }, [state, touched, pending, baseVersion, journeyId, writer])

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
  const saving = save.phase === 'saving'
  const countriesMissing = review && !countriesAnswered(state)

  const finish = (result: { journeyId: string; derivedState: 'ready' | 'pending' }) => {
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

  const settle = (outcome: SaveOutcome, command: GroundCommand) => {
    if (!alive.current) return
    if (outcome.kind === 'saved') return finish(outcome.result)
    dispatch({ type: 'outcome', outcome, command })
  }

  const run = async (command: GroundCommand) => {
    dispatch({ type: 'start', command })
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    try {
      settle(await attemptSave(command, deps, controller.signal), command)
    } finally {
      release()
    }
  }

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
      queueMicrotask(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
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
      if (outcome.kind === 'saved') return finish(outcome.result)
      dispatch({ type: 'check-done', outcome })
    } finally {
      release()
    }
  }

  const applyOnTop = () => {
    if (save.phase !== 'conflict' || !save.current) return
    const current = save.current
    const body = buildCommandBody(state, {
      journeyId,
      existing: current.status,
      expectedVersion: current.version,
    })
    if (!body) {
      setShowErrors(true)
      dispatch({ type: 'dismiss' })
      return
    }
    setExistingStatus(current.status)
    setBaseVersion(current.version)
    const next = commandFor(body, attempt.current, newId)
    attempt.current = next.attempt
    void run(next.command)
  }

  const discard = () => {
    writer.cancel()
    removeDraft(ownerId, kind)
    attempt.current = null
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

  const intent = existing
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
              ? 'Отметьте пересечённые страны или «Ни одной из них».'
              : 'Choose the countries you crossed, or “None of these”.'
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
          {!existing && (
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
              {review && (
                <p className="gt-muted">
                  {ru
                    ? 'Старую поездку сразу сверяем целиком: маршрут, даты и страны, одним сохранением.'
                    : 'An old trip is reviewed in one go: route, dates and countries, one save.'}
                </p>
              )}
            </section>
          )}
          <section className="gt-section" aria-labelledby="gt-route-h">
            <h2 id="gt-route-h" className="gt-h">
              {review
                ? ru
                  ? 'Фактический маршрут'
                  : 'The route you took'
                : ru
                  ? 'Маршрут'
                  : 'Route'}
            </h2>
            {errors.route && showErrors && (
              <p className="gt-error-text" role="alert">
                {errorText(errors.route, locale)}
              </p>
            )}
            {state.mode === 'rail' ? (
              <RailEditor
                legs={state.legs}
                onChange={(legs) => change((current) => ({ ...current, legs }))}
                locale={locale}
                errors={showErrors ? errors : {}}
                disabled={saving}
                ocrSlot={ocrSlot}
              />
            ) : (
              <RoadEditor
                points={state.points}
                onChange={(points) => change((current) => ({ ...current, points }))}
                locale={locale}
                errors={showErrors ? errors : {}}
                disabled={saving}
              />
            )}
            <MetricsPreview state={state} locale={locale} />
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
              <h2 id="gt-countries-h" className="gt-h">
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
          <section className="gt-section" aria-labelledby="gt-about-h">
            <h2 id="gt-about-h" className="gt-h">
              {ru ? 'Название и заметка' : 'Name and note'}
            </h2>
            <Field
              label={ru ? 'Название' : 'Title'}
              optionalLabel={ru ? 'необязательно' : 'optional'}
              value={state.title}
              maxLength={200}
              onChange={(event) => change((current) => ({ ...current, title: event.target.value }))}
              error={shown('title')}
            />
            <TextAreaField
              label={ru ? 'Заметка' : 'Note'}
              optionalLabel={ru ? 'необязательно' : 'optional'}
              value={state.note}
              maxLength={10_000}
              onChange={(event) => change((current) => ({ ...current, note: event.target.value }))}
              error={shown('note')}
            />
          </section>
        </fieldset>
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
          onLeave={() => router.push(returnTo)}
        />
      </form>
      <FloatingActionBar
        label={ru ? 'Действия с путешествием' : 'Journey actions'}
        countLabel={
          state.mode === 'rail'
            ? formatCount(locale, children, LEGS)
            : formatCount(locale, children, STOPS)
        }
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
      </FloatingActionBar>
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
  const names: string[] = []
  let previous: GroundPlaceSnapshot | null = null
  for (const leg of journey.legs) {
    if (names.length === 0 || (previous && placeKey(previous) !== placeKey(leg.from)))
      names.push(label(leg.from))
    names.push(label(leg.to))
    previous = leg.to
  }
  return names.join(' → ')
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
  onLeave: () => void
}) {
  const ru = locale === 'ru'
  if (save.phase === 'unknown') {
    const route = commandRoute(save.command, locale)
    return (
      <div ref={noticeRef} tabIndex={-1} className="gt-notice" data-tone="warning">
        {/* One short live message; the buttons sit outside it so a re-render never re-announces them. */}
        <p className="gt-notice-title" role="alert">
          {ru ? 'Не удалось подтвердить сохранение' : 'We could not confirm the save'}
        </p>
        <p className="gt-muted">
          {ru
            ? 'Запись могла сохраниться. Отправленные данные заморожены; правки ниже останутся у вас и не подменят их.'
            : 'The journey may have been saved. The data that was sent is frozen; edits made since stay here and do not replace it.'}
          {route ? ` ${route}` : ''}
        </p>
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
      <div ref={noticeRef} tabIndex={-1} className="gt-notice" data-tone="warning">
        <p className="gt-notice-title" role="alert">
          {ru ? 'Путешествие изменилось в другом месте' : 'This journey changed elsewhere'}
        </p>
        <p className="gt-muted">
          {ru
            ? 'Ваши правки остались в форме. Ничего не объединяется само.'
            : 'Your edits are still in the form. Nothing is merged automatically.'}
        </p>
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
                {saved.startDate || (ru ? 'Дата неизвестна' : 'Date unknown')}
                {saved.endDate ? ` – ${saved.endDate}` : ''}
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
            <div>
              <dt>{ru ? 'Версия' : 'Version'}</dt>
              <dd>{current.version}</dd>
            </div>
          </dl>
        )}
        {!current && (
          <p className="gt-muted">
            {ru
              ? 'Сохранённую версию прочитать не удалось.'
              : 'We could not read the saved version.'}
          </p>
        )}
      </div>
    )
  }
  if (save.phase === 'gone') {
    return (
      <div ref={noticeRef} tabIndex={-1} className="gt-notice" data-tone="warning">
        <p className="gt-notice-title" role="alert">
          {ru ? 'Это путешествие удалено' : 'This journey was deleted'}
        </p>
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
