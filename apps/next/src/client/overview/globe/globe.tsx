'use client'

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { matches, routeKey } from '@kuuki/shared/overview/filter'
import { useOverview } from '../store/overview-context'
import { GlobeCard } from './globe-card'
import { SvgGlobe } from './svg-globe'
import { buildTimeline, monthAt, replayDurationMs } from './replay'
import { useReplay } from './use-replay'
import { ReplayTransport } from './replay-transport'
import type { MaplibreGlobeProps } from './maplibre-globe'

function GlobeSurface(props: Omit<MaplibreGlobeProps, 'onReady' | 'onError'>) {
  const [Renderer, setRenderer] = useState<ComponentType<MaplibreGlobeProps> | null>(null)
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false)
  const current = useRef(props.isCurrent)
  useEffect(() => { current.current = props.isCurrent }, [props.isCurrent])
  useEffect(() => {
    let retired = false, idle: number | undefined, timeout: number | undefined
    const stop = () => { retired = true; if (idle !== undefined) window.cancelIdleCallback(idle); window.clearTimeout(timeout) }
    window.addEventListener('kuuki:identity-reset', stop)
    try {
      const context = document.createElement('canvas').getContext('webgl2')
      if (context) {
        context.getExtension('WEBGL_lose_context')?.loseContext()
        const load = () => {
          if (retired || !current.current()) return
          void import('./maplibre-globe').then(module => {
            if (!retired && current.current()) setRenderer(() => module.MaplibreGlobe)
          }).catch(() => { if (!retired) setFailed(true) })
        }
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(load, { timeout: 2000 })
        else timeout = window.setTimeout(load, 200)
      }
    } catch { setFailed(true) }
    return () => { stop(); window.removeEventListener('kuuki:identity-reset', stop) }
  }, [])
  return <div className="globe-surface" data-webgl-ready={ready && !failed}>
    <SvgGlobe globe={props.globe} all={props.all} airports={props.airports} size={436} locale={props.locale} staticPlanes={props.reduced} maker={props.filter.makers?.length === 1 ? props.filter.makers[0] : undefined} />
    {Renderer && !failed && <div className="globe-webgl-layer"><Renderer {...props} onReady={() => setReady(true)} onError={() => setFailed(true)} /></div>}
  </div>
}

/** PAGE owns the filter bar; this consumer owns the one clock shared by card and Fullscreen. */
export function OverviewGlobe({ topLeft }: { topLeft?: ReactNode }) {
  const overview = useOverview()
  if (!overview.payload || !overview.scope || !overview.all) return null
  return <OwnedGlobe key={overview.ownerKey} topLeft={topLeft} />
}
function OwnedGlobe({ topLeft }: { topLeft?: ReactNode }) {
  const { payload, scope, all, filter, locale, replayPaused, setReplayPaused, bus, actions, isCurrent } = useOverview()
  const host = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [reduced, setReduced] = useState(true)
  const [loadTime] = useState(() => new Date())
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(query.matches)
    change(); query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  const items = scope!.replay
  const durationMs = replayDurationMs(scope!.figures.flights)
  const timeline = useMemo(() => buildTimeline(items, durationMs), [items, durationMs])
  const replay = useReplay(timeline, durationMs, replayPaused, reduced, fullscreen, host, isCurrent)
  const month = monthAt(timeline, replay.timeMs, durationMs)
  const nightDate = useMemo(() => {
    const date = month ? new Date(`${month}-15T00:00:00Z`) : new Date(loadTime)
    date.setUTCHours(loadTime.getUTCHours(), loadTime.getUTCMinutes(), loadTime.getUTCSeconds(), 0)
    return date
  }, [month, loadTime])
  const routeDistances = useMemo(() => {
    const distances = new Map<string, { km: number; weight: number; missing: boolean }>()
    for (const row of payload!.rows) {
      if (row.state === 'upcoming' || !matches(row, filter, payload!.refs)) continue
      const key = routeKey(row.origin, row.destination), value = distances.get(key) ?? { km: 0, weight: 0, missing: false }
      if (row.distanceKm === null || !Number.isFinite(row.distanceKm) || row.distanceKm < 0) value.missing = true
      else { value.km += row.distanceKm; value.weight += row.weight }
      distances.set(key, value)
    }
    return new Map([...distances].map(([key, value]) => [key, value.missing || !value.weight ? null : Math.round(value.km / value.weight)]))
  }, [payload, filter])
  return <div ref={host}><GlobeCard locale={locale} topLeft={topLeft} onFullscreenChange={setFullscreen}
    bottomLeft={<ReplayTransport key={`${payload!.etag}:${JSON.stringify(filter)}`} timeline={timeline} durationMs={durationMs} timeMs={replay.timeMs} paused={replayPaused}
      setPaused={setReplayPaused} seek={replay.seek} reduced={reduced} locale={locale} />}>
    {({ fullscreen, active }) => <GlobeSurface globe={scope!.globe} all={all!.globe} airports={payload!.refs.airports}
      filter={filter} locale={locale} fullscreen={fullscreen} active={active} reduced={reduced} bus={bus} isCurrent={isCurrent}
      onScope={key => actions.add('routes', key)} routeDistances={routeDistances} replay={replay} timeline={timeline}
      absoluteMs={replay.absoluteMs} nightDate={nightDate} />}
  </GlobeCard></div>
}
