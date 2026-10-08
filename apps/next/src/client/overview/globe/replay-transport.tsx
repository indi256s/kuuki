'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { Chart } from '@tanstack/charts/react'
import type { StaticChartDefinition } from '@tanstack/charts'
import { handleX, type HandleXChange } from '@tanstack/charts/interaction/handle'
import { controlledSignal } from '@tanstack/charts/interaction/signal'
import { Pause, Play } from 'lucide-react'
import { Button } from '../../ui/button'
import type { Locale } from '../../../lib/format'
import { monthAt, monthCandidates, yearTicks, type TimelineItem } from './replay'

export function ReplayTransport({ timeline, durationMs, timeMs, paused, setPaused, seek, reduced, locale }: {
  timeline: TimelineItem[]; durationMs: number; timeMs: number; paused: boolean; setPaused: (paused: boolean) => void
  seek: (time: number, phase: 'preview' | 'commit' | 'cancel') => void; reduced: boolean; locale: Locale
}) {
  const [expanded, setExpanded] = useState(false)
  const [cursor, setCursor] = useState({ timeline, draft: null as number | null })
  const draft = cursor.timeline === timeline ? cursor.draft : null
  const host = useRef<HTMLDivElement>(null), label = useRef<HTMLButtonElement>(null)
  const candidates = useMemo(() => monthCandidates(timeline, durationMs), [timeline, durationMs])
  const month = monthAt(timeline, timeMs, durationMs)
  const value = draft ?? candidates.find(item => item.month === month)?.startMs ?? candidates[0]?.startMs ?? 0
  const format = (time: number) => {
    const item = candidates.find(item => item.startMs === time)
    return item ? new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${item.month}-01T00:00:00Z`)).toLocaleUpperCase(locale) : '—'
  }
  const definition = useMemo<StaticChartDefinition<unknown, number, number, 'dom'>>(() => ({
    margin: { top: 10, bottom: 20, left: 12, right: 12 }, motion: false, marks: [],
    scales: { x: { scale: scaleLinear().domain([0, Math.max(1, candidates.at(-1)?.startMs ?? 1)]),
      axis: { line: false, ticks: { values: yearTicks(timeline, durationMs).map(item => item.startMs),
        format: (time: number) => candidates.find(item => item.startMs === time)?.month.slice(0, 4) ?? '' } } }, y: null },
    controls: candidates.length ? [handleX({ id: 'replay-month', values: candidates.map(item => item.startMs),
      value: controlledSignal<number, HandleXChange<number>>(value, (next, { reason }) => {
        setCursor({ timeline, draft: reason.type === 'preview' ? next : null })
        seek(reason.type === 'cancel' ? reason.origin : next, reason.type)
      }), cross: { edge: 'top' }, hitSize: 44, ariaLabel: locale === 'ru' ? 'Месяц повтора' : 'Replay month',
      format: time => candidates.find(item => item.startMs === time)?.month ?? '' })] : [],
  }), [candidates, value, timeline, durationMs, locale, seek])
  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [expanded])
  if (reduced || !timeline.length) return null
  return <div ref={host} className="replay-transport" data-expanded={expanded} onPointerDown={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setExpanded(false); label.current?.focus() } }}>
    <Button dense aria-label={paused ? locale === 'ru' ? 'Продолжить повтор' : 'Play replay' : locale === 'ru' ? 'Приостановить повтор' : 'Pause replay'}
      onClick={() => setPaused(!paused)}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</Button>
    <Button ref={label} dense className="replay-month" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{format(value)}</Button>
    <div className="replay-scrubber"><Chart definition={definition} height={58} initialWidth={300} ariaLabel={locale === 'ru' ? 'Хронология перелётов' : 'Flight timeline'} /></div>
  </div>
}
