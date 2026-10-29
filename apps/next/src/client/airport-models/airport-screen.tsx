'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  AirportCatalogEntry,
  AirportFeature,
  AirportModelV1,
  AirportPlanV1,
  Measure,
  SourceProvenance,
} from '../../lib/airport-models/model'
import {
  AirportViewer,
  defaultAirportLayers,
  type AirportLayers,
  type AirportViewerHandle,
  type ViewerStatus,
} from './viewer'
import { AirportComparison } from './comparison'
import { useLocale } from '../preferences'
import { isConstrainedConnection } from '../network'
import { useMobile } from '../ui/use-mobile'
import { formatDateOnly, formatInstantDate, formatNumber, pluralCategory } from '../../lib/format'
import { Button } from '../ui/button'
import { PopoverRoot, PopoverTrigger, PopoverContent } from '../ui/popover'
import { useAirportHistory } from './use-airport-history'
import { markAirportVisit, airportOverviewBack } from './return-session'
import { kindNames } from './airport-copy'
import { AirportPreview } from './preview'
import './airport-screen.css'

type Locale = 'en' | 'ru'
type Panel = 'history' | 'objects' | 'detail' | null
type Props = {
  entry: AirportCatalogEntry
  catalog: readonly AirportCatalogEntry[]
  ownerId: string
  locale: Locale
  scope: string | null
  invalidScope: boolean
  backToken: string | null
  compare: string | null
}
async function asset<T extends { iata: string; revision: string }>(
  path: string,
  entry: AirportCatalogEntry,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error('Airport asset unavailable')
  const data = (await response.json()) as T
  if (data.iata !== entry.iata || data.revision !== entry.revision)
    throw new Error('Airport asset revision mismatch')
  return data
}
function featureName(feature: AirportFeature, locale: Locale) {
  return (
    feature.label || `${kindNames[feature.kind][locale]}${feature.ref ? ` ${feature.ref}` : ''}`
  )
}
function measurement(value: Measure, locale: Locale) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value.metres)
  const source =
    value.source === 'osm'
      ? 'OSM'
      : value.source === 'levels'
        ? locale === 'ru'
          ? 'оценка по этажности'
          : 'estimated from levels'
        : value.source === 'default'
          ? locale === 'ru'
            ? 'визуальное допущение'
            : 'visual assumption'
          : locale === 'ru'
            ? 'по геометрии'
            : 'from geometry'
  return `${number} ${locale === 'ru' ? 'м' : 'm'} · ${source}`
}

function ModelScene({
  model,
  entry,
  mobile,
  selected,
  layers,
  panel,
  compare,
  viewer,
  onSelect,
  onStatus,
  onHover,
}: {
  model: AirportModelV1
  entry: AirportCatalogEntry
  mobile: boolean
  selected: string | null
  layers: AirportLayers
  panel: Panel
  compare: boolean
  viewer: React.RefObject<AirportViewerHandle | null>
  onSelect: (id: string | null) => void
  onStatus: (status: ViewerStatus) => void
  onHover: (hit: { id: string; x: number; y: number } | null) => void
}) {
  const [initialPose] = useState(() => model.cameras[mobile ? 'mobile' : 'desktop'])
  const [pose, setPose] = useState(initialPose)
  return (
    <AirportViewer
      ref={viewer}
      model={model}
      initialPose={initialPose}
      active={!compare}
      state={{
        pose,
        layers,
        selectedFeatureId: selected,
        visibleInsets: panel ? (mobile ? { bottom: 292 } : { right: 320 }) : {},
      }}
      fallback={<AirportPreview entry={entry} />}
      onPoseChange={setPose}
      onSelection={onSelect}
      onStatus={onStatus}
      onHover={onHover}
    />
  )
}

export function AirportScreen({
  entry,
  catalog,
  ownerId,
  locale: initialLocale,
  scope: inheritedScope,
  invalidScope,
  backToken,
  compare: _initialCompare,
}: Props) {
  const locale = useLocale(initialLocale),
    ru = locale === 'ru'
  const router = useRouter(),
    query = useSearchParams(),
    mobile = useMobile()
  const [panel, setPanel] = useState<Panel>(null)
  const [historyScope, setHistoryScope] = useState<'inherited' | 'all'>('inherited')
  const [selected, setSelected] = useState<string | null>(null)
  const [layers, setLayers] = useState<AirportLayers>({ ...defaultAirportLayers })
  const [model, setModel] = useState<AirportModelV1 | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadMode, setLoadMode] = useState<'pending' | 'explicit' | 'load'>('pending')
  const [modelError, setModelError] = useState(false)
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>('loading')
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [compareRequest, setCompareRequest] = useState<string | null>(null)
  const [plans, setPlans] = useState<{
    reference: string
    pair: readonly [AirportPlanV1, AirportPlanV1]
    sources: readonly [SourceProvenance, SourceProvenance]
  } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdHover = useCallback((hit: { id: string; x: number; y: number } | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (hit) setHover(hit)
    else hoverTimer.current = setTimeout(() => setHover(null), 120)
  }, [])
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    },
    [],
  )
  const [compareError, setCompareError] = useState(false)
  const [compareAttempt, setCompareAttempt] = useState(0)
  const [picker, setPicker] = useState(false)
  const viewer = useRef<AirportViewerHandle | null>(null),
    compareTrigger = useRef<HTMLButtonElement>(null),
    historyTrigger = useRef<HTMLButtonElement>(null),
    objectsTrigger = useRef<HTMLButtonElement>(null),
    panelElement = useRef<HTMLElement>(null)
  const historyScroll = useRef(0)
  const [historyWasOpen, setHistoryWasOpen] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const peers = catalog.filter((item) => item.iata !== entry.iata)
  const compareCode = query.get('compare')?.toUpperCase() ?? null
  const desiredCompare = compareRequest ?? compareCode
  const reference = catalog.find((item) => item.iata === desiredCompare && item.iata !== entry.iata)
  const comparing = Boolean(compareCode && plans?.reference === compareCode)
  const history = useAirportHistory(
    ownerId,
    entry.iata,
    historyScope === 'all' ? null : inheritedScope,
    panel === 'history' && !comparing,
    historyScope !== 'all' && invalidScope,
  )
  const feature = model?.features.find((item) => item.id === selected)
  const hoveredFeature = model?.features.find((item) => item.id === hover?.id)
  const copy = (en: string, russian: string) => (ru ? russian : en)
  const focusCompare = useCallback(() => compareTrigger.current?.focus({ preventScroll: true }), [])

  useEffect(() => {
    markAirportVisit(ownerId, backToken)
  }, [ownerId, backToken])
  useEffect(() => {
    queueMicrotask(() => setLoadMode(isConstrainedConnection() ? 'explicit' : 'load'))
  }, [])
  useEffect(() => {
    if (loadMode !== 'load') return
    const controller = new AbortController()
    void asset<AirportModelV1>(entry.model, entry, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setModel(value)
          setModelError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setModelError(true)
      })
    return () => controller.abort()
  }, [entry, loadMode, loadAttempt])
  useEffect(() => {
    if (!reference || (plans?.reference === reference.iata && !compareRequest)) return
    const controller = new AbortController()
    void Promise.all([
      asset<AirportPlanV1>(entry.plan, entry, controller.signal),
      asset<AirportPlanV1>(reference.plan, reference, controller.signal),
      fetch(entry.provenance, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error('Source unavailable')
        return response.json() as Promise<SourceProvenance>
      }),
      fetch(reference.provenance, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error('Source unavailable')
        return response.json() as Promise<SourceProvenance>
      }),
    ])
      .then((pair) => {
        if (controller.signal.aborted) return
        setPlans({
          reference: reference.iata,
          pair: [pair[0], pair[1]],
          sources: [pair[2], pair[3]],
        })
        setCompareError(false)
        if (compareRequest) {
          const next = new URL(window.location.href)
          next.searchParams.set('compare', reference.iata)
          const state = {
            ...window.history.state,
            kuukiAirportCompare: { ownerId, iata: entry.iata },
          }
          // Next copies its own fields and publishes the URL for external History calls.
          delete state.__NA
          delete state._N
          if (compareCode) window.history.replaceState(state, '', next)
          else window.history.pushState(state, '', next)
          setCompareRequest(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCompareError(true)
      })
    return () => controller.abort()
  }, [entry, reference, compareAttempt, compareRequest, compareCode, ownerId, plans])
  const previousComparing = useRef(comparing)
  useEffect(() => {
    if (previousComparing.current && !comparing) focusCompare()
    previousComparing.current = comparing
  }, [comparing, focusCompare])
  useEffect(() => {
    if (panel === 'history' && panelElement.current)
      panelElement.current.scrollTop = historyScroll.current
  }, [panel, comparing])

  const previousPanel = useRef(panel)
  useEffect(() => {
    if (previousPanel.current !== panel && panel && keyboard && !comparing)
      panelElement.current?.querySelector('h2')?.focus({ preventScroll: true })
    previousPanel.current = panel
  }, [panel, keyboard, comparing])

  const closeCompare = useCallback(() => {
    const marker = window.history.state?.kuukiAirportCompare
    setCompareRequest(null)
    setCompareError(false)
    if (compareCode && marker?.ownerId === ownerId && marker?.iata === entry.iata)
      window.history.back()
    else if (compareCode) {
      const next = new URL(window.location.href)
      next.searchParams.delete('compare')
      const state = { ...window.history.state }
      delete state.kuukiAirportCompare
      delete state.__NA
      delete state._N
      window.history.replaceState(state, '', next)
    }
    focusCompare()
  }, [compareCode, ownerId, entry.iata, focusCompare])
  const closePanel = useCallback(() => {
    if (panel === 'history') historyScroll.current = panelElement.current?.scrollTop ?? 0
    const target = panel === 'history' ? historyTrigger : objectsTrigger
    setPanel(null)
    target.current?.focus({ preventScroll: true })
  }, [panel])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (hover) {
        setHover(null)
        return
      }
      if (desiredCompare) closeCompare()
      else if (panel) closePanel()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [hover, desiredCompare, panel, closeCompare, closePanel])
  const selectFeature = useCallback(
    (id: string | null) => {
      if (!id) {
        setSelected(null)
        if (panel === 'detail') setPanel(null)
        return
      }
      setHover(null)
      if (panel === 'history') {
        historyScroll.current = panelElement.current?.scrollTop ?? 0
        setHistoryWasOpen(true)
      }
      setSelected(id)
      setPanel('detail')
    },
    [panel],
  )
  const startCompare = (iata: string) => {
    setCompareError(false)
    setCompareRequest(iata)
    setPicker(false)
  }
  const back = () => {
    if (compareCode || compareRequest) {
      closeCompare()
      return
    }
    if (!airportOverviewBack(ownerId, backToken)) router.push('/overview')
  }
  const loadModel = () => {
    setModelError(false)
    setLoadMode('load')
    setLoadAttempt((value) => value + 1)
  }
  const objectFeatures = model?.features ?? []
  const timestamp = model?.provenance.osmTimestamp ?? model?.provenance.fetchedAt
  const plural = pluralCategory(locale, history.data?.total ?? 0)
  const flightNoun = ru
    ? plural === 'one'
      ? 'перелёт'
      : plural === 'few'
        ? 'перелёта'
        : 'перелётов'
    : plural === 'one'
      ? 'flight'
      : 'flights'

  return (
    <section
      className="airport-screen"
      data-airport={entry.iata}
      onKeyDownCapture={() => setKeyboard(true)}
      onPointerDownCapture={() => setKeyboard(false)}
    >
      <header className="airport-header">
        <div className="airport-topbar">
          <Button variant="ghost" onClick={back}>
            {desiredCompare ? copy('Back to model', 'К модели') : copy('Overview', 'Обзор')}
          </Button>
          <div className="airport-header-actions">
            {peers.length > 0 && (
              <PopoverRoot open={picker} onOpenChange={setPicker}>
                <PopoverTrigger asChild>
                  <Button
                    ref={compareTrigger}
                    hidden={comparing}
                    variant="ghost"
                    onClick={(event) => {
                      if (comparing) {
                        event.preventDefault()
                        closeCompare()
                      } else if (peers.length === 1) {
                        event.preventDefault()
                        startCompare(peers[0]!.iata)
                      }
                    }}
                  >
                    {comparing
                      ? copy('Back to model', 'К модели')
                      : peers.length === 1
                        ? copy(`Compare with ${peers[0]!.iata}`, `Сравнить с ${peers[0]!.iata}`)
                        : copy('Compare', 'Сравнить')}
                  </Button>
                </PopoverTrigger>
                {peers.length > 1 && (
                  <PopoverContent>
                    <div className="airport-peer-options">
                      {peers.map((peer) => (
                        <Button
                          key={peer.iata}
                          variant="ghost"
                          onClick={() => startCompare(peer.iata)}
                        >
                          {peer.iata} · {peer.name}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </PopoverRoot>
            )}
            {!comparing && (
              <Button
                ref={historyTrigger}
                variant={panel === 'history' ? 'secondary' : 'ghost'}
                aria-expanded={panel === 'history'}
                aria-controls="airport-context"
                onClick={() => {
                  setHistoryWasOpen(true)
                  if (panel === 'history') closePanel()
                  else setPanel('history')
                }}
              >
                {copy('History', 'История')}
              </Button>
            )}
          </div>
        </div>
        <div className="airport-heading">
          <span className="airport-code">
            {entry.iata} / {entry.icao}
          </span>
          <h1>{entry.name}</h1>
        </div>
      </header>
      <div className="airport-workspace">
        <div className="airport-detail" hidden={comparing}>
          <div className="airport-stage">
            {model && mobile !== null ? (
              <ModelScene
                model={model}
                entry={entry}
                mobile={mobile}
                selected={selected}
                layers={layers}
                panel={panel}
                compare={comparing}
                viewer={viewer}
                onSelect={selectFeature}
                onStatus={setViewerStatus}
                onHover={holdHover}
              />
            ) : (
              <AirportPreview entry={entry} />
            )}
            {hover && hoveredFeature && !panel && (
              <div
                className="airport-hover"
                role="tooltip"
                style={{
                  insetInlineStart: `clamp(110px, ${hover.x}px, calc(100% - 110px))`,
                  insetBlockStart: Math.max(44, hover.y),
                }}
                onPointerEnter={() => holdHover(hover)}
                onPointerLeave={() => holdHover(null)}
              >
                {featureName(hoveredFeature, locale)}
              </div>
            )}
            {(loadMode === 'explicit' || modelError || viewerStatus === 'error') && (
              <div className="airport-model-notice">
                {(modelError || viewerStatus === 'error') && (
                  <p role="status">
                    {copy('The model could not load.', 'Не удалось загрузить модель.')}
                  </p>
                )}
                <Button
                  onClick={() =>
                    viewerStatus === 'error' && model ? viewer.current?.retry() : loadModel()
                  }
                >
                  {loadMode === 'explicit' && !modelError
                    ? copy('Load model', 'Загрузить модель')
                    : copy('Retry model', 'Загрузить снова')}
                </Button>
              </div>
            )}
          </div>
          <div className="airport-controls">
            <div className="airport-controls-start">
              <Button
                ref={objectsTrigger}
                variant="ghost"
                aria-controls="airport-context"
                aria-expanded={panel === 'objects'}
                onClick={() => (panel === 'objects' ? closePanel() : setPanel('objects'))}
              >
                {copy('Objects', 'Объекты')}
              </Button>
              <PopoverRoot>
                <PopoverTrigger asChild>
                  <Button variant="ghost">{copy('Layers', 'Слои')}</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <fieldset className="airport-layer-options">
                    <legend>{copy('Layers', 'Слои')}</legend>
                    {Object.keys(layers).map((kind) => (
                      <label key={kind}>
                        <input
                          type="checkbox"
                          checked={layers[kind as keyof AirportLayers]}
                          onChange={(event) =>
                            setLayers((previous) => ({ ...previous, [kind]: event.target.checked }))
                          }
                        />
                        {kindNames[kind as keyof AirportLayers][locale]}
                      </label>
                    ))}
                  </fieldset>
                </PopoverContent>
              </PopoverRoot>
            </div>
            <div className="airport-zoom">
              <Button
                variant="ghost"
                aria-label={copy('Zoom out', 'Уменьшить модель')}
                disabled={viewerStatus !== 'ready' || !model}
                onClick={() => viewer.current?.zoom(1 / 1.25)}
              >
                −
              </Button>
              <Button
                variant="ghost"
                aria-label={copy('Zoom in', 'Увеличить модель')}
                disabled={viewerStatus !== 'ready' || !model}
                onClick={() => viewer.current?.zoom(1.25)}
              >
                +
              </Button>
              <Button
                variant="ghost"
                disabled={viewerStatus !== 'ready' || !model}
                onClick={() => viewer.current?.reset()}
              >
                {copy('Reset', 'Сбросить')}
              </Button>
            </div>
          </div>
          {panel && (
            <aside
              id="airport-context"
              className="airport-context"
              data-instant={keyboard || undefined}
              ref={panelElement}
              aria-label={
                panel === 'history'
                  ? copy('Your flights', 'Ваши перелёты')
                  : panel === 'objects'
                    ? copy('Objects', 'Объекты')
                    : copy('Selected object', 'Выбранный объект')
              }
              onScroll={(event) => {
                if (panel === 'history') historyScroll.current = event.currentTarget.scrollTop
              }}
            >
              <div className="airport-panel-header">
                <h2 tabIndex={-1}>
                  {panel === 'history'
                    ? copy('Your flights', 'Ваши перелёты')
                    : panel === 'objects'
                      ? copy('Objects', 'Объекты')
                      : feature
                        ? featureName(feature, locale)
                        : copy('Object', 'Объект')}
                </h2>
                <Button
                  variant="ghost"
                  aria-label={copy('Close panel', 'Закрыть панель')}
                  onClick={closePanel}
                >
                  ×
                </Button>
              </div>
              {panel === 'history' && (
                <>
                  {(inheritedScope !== null || invalidScope) && (
                    <div className="airport-scope">
                      <Button
                        variant="ghost"
                        aria-pressed={historyScope === 'inherited'}
                        onClick={() => setHistoryScope('inherited')}
                      >
                        {copy('Overview selection', 'Выборка Обзора')}
                      </Button>
                      <Button
                        variant="ghost"
                        aria-pressed={historyScope === 'all'}
                        onClick={() => setHistoryScope('all')}
                      >
                        {copy('All history', 'Вся история')}
                      </Button>
                    </div>
                  )}
                  {invalidScope && historyScope === 'inherited' ? (
                    <p role="alert">
                      {copy('Invalid history selection.', 'Некорректная выборка истории.')}
                    </p>
                  ) : (
                    <>
                      {history.loading && !history.data && (
                        <p role="status">{copy('Loading flights…', 'Загружаем перелёты…')}</p>
                      )}
                      {history.updating && (
                        <p role="status">{copy('Updating selection…', 'Выборка обновляется…')}</p>
                      )}
                      {history.error && (
                        <div role="alert">
                          <p>
                            {copy('History could not refresh.', 'Не удалось обновить историю.')}
                          </p>
                          <Button onClick={() => void history.refresh()}>
                            {copy('Try again', 'Повторить')}
                          </Button>
                        </div>
                      )}
                      {history.data && (
                        <>
                          <p className="airport-history-total">
                            {formatNumber(locale, history.data.total ?? 0)}{' '}
                            <span>{flightNoun}</span>
                          </p>
                          {history.data.derivedState !== 'ready' && (
                            <p role="status">
                              {copy(
                                'Country evidence is updating.',
                                'Сведения о странах обновляются.',
                              )}
                            </p>
                          )}
                          {history.data.items.length === 0 && (
                            <p>
                              {copy(
                                'No flights in this selection.',
                                'В этой выборке перелётов нет.',
                              )}
                            </p>
                          )}
                          <ol className="airport-flight-list">
                            {history.data.items.map((item) => (
                              <li key={item.id}>
                                <span className="airport-flight-route">
                                  {item.origin} — {item.destination}
                                </span>
                                <time dateTime={item.date}>
                                  {formatDateOnly(locale, item.date)}
                                </time>
                                <span>
                                  {[item.airline, item.flightNumber].filter(Boolean).join(' ')}
                                </span>
                                {item.state === 'awaiting' && (
                                  <span>
                                    {copy('Awaiting confirmation', 'Ожидает подтверждения')}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ol>
                          {history.data.nextCursor && (
                            <Button
                              loading={history.loading}
                              loadingLabel={copy('Loading…', 'Загружаем…')}
                              onClick={() => void history.more()}
                            >
                              {copy('More flights', 'Ещё перелёты')}
                            </Button>
                          )}
                        </>
                      )}
                      {history.updating && (
                        <Button onClick={() => void history.refresh()}>
                          {copy('Refresh history', 'Обновить историю')}
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
              {panel === 'objects' && (
                <>
                  {!model ? (
                    <>
                      <p role="status">
                        {copy(
                          'Load the model to view objects.',
                          'Загрузите модель для просмотра объектов.',
                        )}
                      </p>
                      <Button onClick={loadModel}>
                        {copy('Load objects', 'Загрузить объекты')}
                      </Button>
                    </>
                  ) : (
                    <ul className="airport-object-list">
                      {objectFeatures.map((item) => (
                        <li key={item.id}>
                          <Button variant="ghost" static onClick={() => selectFeature(item.id)}>
                            {featureName(item, locale)}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {panel === 'detail' && feature && (
                <>
                  <p className="airport-feature-kind">{kindNames[feature.kind][locale]}</p>
                  <dl className="airport-properties">
                    {feature.type === 'building' && (
                      <>
                        <div>
                          <dt>{copy('Height', 'Высота')}</dt>
                          <dd>{measurement(feature.height, locale)}</dd>
                        </div>
                        {feature.minHeight.metres > 0 && (
                          <div>
                            <dt>{copy('Base height', 'Высота основания')}</dt>
                            <dd>{measurement(feature.minHeight, locale)}</dd>
                          </div>
                        )}
                      </>
                    )}
                    {feature.type === 'line' && (
                      <>
                        <div>
                          <dt>{copy('Width', 'Ширина')}</dt>
                          <dd>{measurement(feature.width, locale)}</dd>
                        </div>
                        {feature.length && (
                          <div>
                            <dt>{copy('Length', 'Длина')}</dt>
                            <dd>{measurement(feature.length, locale)}</dd>
                          </div>
                        )}
                      </>
                    )}
                    {feature.surface && (
                      <div>
                        <dt>{copy('Surface', 'Покрытие')}</dt>
                        <dd>{feature.surface}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="airport-object-actions">
                    <Button
                      disabled={viewerStatus !== 'ready'}
                      onClick={() => viewer.current?.focusFeature(feature.id)}
                    >
                      {copy('Focus object', 'Приблизить')}
                    </Button>
                    {historyWasOpen && (
                      <Button variant="ghost" onClick={() => setPanel('history')}>
                        {copy('Back to flights', 'К перелётам')}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setPanel('objects')}>
                      {copy('All objects', 'Все объекты')}
                    </Button>
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
        {desiredCompare && !comparing && (
          <div className="airport-compare-status" role="status">
            <p>
              {!reference
                ? copy('Choose an available airport.', 'Выберите доступный аэропорт.')
                : compareError
                  ? copy('The comparison could not load.', 'Не удалось загрузить сравнение.')
                  : copy('Loading comparison…', 'Загружаем сравнение…')}
            </p>
            {compareError && (
              <Button
                onClick={() => {
                  setCompareError(false)
                  setCompareAttempt((value) => value + 1)
                }}
              >
                {copy('Try again', 'Повторить')}
              </Button>
            )}
            <Button variant="ghost" onClick={closeCompare}>
              {copy('Cancel', 'Отмена')}
            </Button>
          </div>
        )}
        {comparing && plans && (
          <div className="airport-comparison-mode">
            <AirportComparison
              plans={plans.pair}
              locale={locale}
              names={[
                entry.name,
                catalog.find((item) => item.iata === plans.reference)?.name ?? plans.reference,
              ]}
            />
            <div className="airport-comparison-sources">
              {[entry, catalog.find((item) => item.iata === plans.reference)!].map(
                (item, index) => {
                  const source = plans.sources[index]!
                  const captured = source.osmTimestamp ?? source.fetchedAt
                  const plan = plans.pair[index]!
                  const runways = [
                    ...new Set(
                      plan.features.flatMap((feature) =>
                        (feature.type === 'line' || feature.type === 'surface') &&
                        feature.kind === 'runway'
                          ? (feature.directions ?? (feature.ref ? [feature.ref] : []))
                          : [],
                      ),
                    ),
                  ]
                  return (
                    <div key={item.iata}>
                      <span>
                        {item.iata} ·{' '}
                        {captured
                          ? formatInstantDate(locale, captured, 'medium', 'UTC')
                          : copy('Snapshot date unknown', 'Дата снимка неизвестна')}
                      </span>
                      <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                        {copy('OpenStreetMap source', 'Источник OpenStreetMap')}
                      </a>
                      <span className="sr-only">
                        {copy('Runways', 'ВПП')} {runways.join(', ')}
                      </span>
                    </div>
                  )
                },
              )}
            </div>
          </div>
        )}
      </div>
      <footer className="airport-credits">
        {timestamp && (
          <span>
            {copy('Snapshot', 'Снимок')} · {formatInstantDate(locale, timestamp, 'medium', 'UTC')}
          </span>
        )}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap contributors · ODbL
        </a>
        <a href={entry.source}>{copy('Source data', 'Исходные данные')}</a>
      </footer>
    </section>
  )
}
