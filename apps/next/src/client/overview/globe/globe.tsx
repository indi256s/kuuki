'use client'

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { matches, routeKey } from '@kuuki/shared/overview/filter'
import { useOverview } from '../store/overview-context'
import { GlobeCard, type GlobeCardProps } from './globe-card'
import { CountryTreemap } from './country-treemap'
import { S, t } from '../copy'
import { buildTimeline, replayDurationMs } from './replay'
import { useReplay } from './use-replay'
import { ReplayTransport } from './replay-transport'
import type { MaplibreGlobeProps } from './maplibre-globe'

function GlobeSurface(props: Omit<MaplibreGlobeProps, 'onReady' | 'onError'>) {
  const [Renderer, setRenderer] = useState<ComponentType<MaplibreGlobeProps> | null>(null)
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false)
  const current = useRef(props.isCurrent)
  useEffect(() => {
    current.current = props.isCurrent
  }, [props.isCurrent])
  useEffect(() => {
    let retired = false
    const stop = () => {
      retired = true
    }
    window.addEventListener('kuuki:identity-reset', stop)
    try {
      const context = document.createElement('canvas').getContext('webgl2')
      if (context) {
        context.getExtension('WEBGL_lose_context')?.loseContext()
        void import('./maplibre-globe')
          .then((module) => {
            if (!retired && current.current()) setRenderer(() => module.MaplibreGlobe)
          })
          .catch(() => {
            if (!retired && current.current()) setFailed(true)
          })
        // oxlint-disable-next-line react/set-state-in-effect -- WebGL support is only knowable in the browser
      } else setFailed(true)
    } catch {
      setFailed(true)
    }
    return () => {
      stop()
      window.removeEventListener('kuuki:identity-reset', stop)
    }
  }, [])
  return (
    <div className="globe-surface" data-webgl-ready={ready && !failed}>
      <div className="globe-viewport">
        {!ready || failed ? (
          <p className="globe-status" role="status">
            {t(failed ? S.globeUnavailable : S.globeLoading, props.locale)}
          </p>
        ) : null}
        {Renderer && !failed && (
          <div className="globe-webgl-layer">
            <Renderer {...props} onReady={() => setReady(true)} onError={() => setFailed(true)} />
          </div>
        )}
      </div>
    </div>
  )
}

/** PAGE owns the filter bar; this consumer owns the one clock shared by card and Fullscreen. */
type Props = Pick<GlobeCardProps, 'topLeft' | 'onFullscreenChange'>
export function OverviewGlobe({ topLeft, onFullscreenChange }: Props) {
  const overview = useOverview()
  if (!overview.payload || !overview.scope || !overview.all) return null
  return (
    <OwnedGlobe key={overview.ownerKey} topLeft={topLeft} onFullscreenChange={onFullscreenChange} />
  )
}
function OwnedGlobe({ topLeft, onFullscreenChange }: Props) {
  const {
    payload,
    scope,
    all,
    filter,
    locale,
    replayPaused,
    setReplayPaused,
    bus,
    actions,
    isCurrent,
  } = useOverview()
  useEffect(() => () => onFullscreenChange?.(false), [onFullscreenChange])
  const host = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [reduced, setReduced] = useState(true)
  const disclosure = useMemo(() => <CountryTreemap />, [])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(query.matches)
    change()
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  const items = scope!.replay
  const durationMs = replayDurationMs(scope!.figures.flights)
  const timeline = useMemo(() => buildTimeline(items, durationMs), [items, durationMs])
  const replay = useReplay(timeline, durationMs, replayPaused, reduced, fullscreen, host, isCurrent)
  const routeDistances = useMemo(() => {
    const distances = new Map<string, { km: number; weight: number; missing: boolean }>()
    for (const row of payload!.rows) {
      if (row.state === 'upcoming' || !matches(row, filter, payload!.refs)) continue
      const key = routeKey(row.origin, row.destination),
        value = distances.get(key) ?? { km: 0, weight: 0, missing: false }
      if (row.distanceKm === null || !Number.isFinite(row.distanceKm) || row.distanceKm < 0)
        value.missing = true
      else {
        value.km += row.distanceKm
        value.weight += row.weight
      }
      distances.set(key, value)
    }
    return new Map(
      [...distances].map(([key, value]) => [
        key,
        value.missing || !value.weight ? null : Math.round(value.km / value.weight),
      ]),
    )
  }, [payload, filter])
  const travelScope = scope!.figures.scope
  const legendLabel = t(
    payload!.ground.length === 0
      ? S.legend
      : travelScope === 'ground'
        ? S.legendGround
        : travelScope === 'flights'
          ? S.legendFlights
          : S.legendAll,
    locale,
  )
  return (
    <div ref={host}>
      <GlobeCard
        locale={locale}
        legendLabel={legendLabel}
        disclosure={disclosure}
        topLeft={topLeft}
        onFullscreenChange={(open) => {
          setFullscreen(open)
          onFullscreenChange?.(open)
        }}
        bottomLeft={
          travelScope === 'ground' ? undefined : (
            <ReplayTransport
              key={`${payload!.etag}:${JSON.stringify(filter)}`}
              timeline={timeline}
              durationMs={durationMs}
              timeMs={replay.timeMs}
              getFrame={replay.getFrame}
              paused={replayPaused}
              setPaused={(paused) => {
                setReplayPaused(paused)
                bus.setReplayStarted(!paused)
              }}
              seek={replay.seek}
              reduced={reduced}
              locale={locale}
            />
          )
        }
      >
        {({ fullscreen, active }) => (
          <GlobeSurface
            globe={scope!.globe}
            all={all!.globe}
            airports={payload!.refs.airports}
            filter={filter}
            travelScope={travelScope}
            locale={locale}
            fullscreen={fullscreen}
            active={active}
            reduced={reduced}
            bus={bus}
            isCurrent={isCurrent}
            onScope={(key) => actions.add('routes', key)}
            routeDistances={routeDistances}
            replay={replay}
            timeline={timeline}
          />
        )}
      </GlobeCard>
    </div>
  )
}
