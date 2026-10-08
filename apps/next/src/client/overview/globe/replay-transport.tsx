'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const drag = useRef<{ origin: number; value: number } | null>(null)
  const change = (index: number, phase: 'preview' | 'commit') => {
    const next = candidates[index]?.startMs
    if (next === undefined) return
    if (drag.current) drag.current.value = next
    setCursor({ timeline, draft: phase === 'preview' ? next : null })
    seek(next, phase)
  }
  const finish = useCallback((phase: 'commit' | 'cancel') => {
    const current = drag.current
    if (!current) return
    drag.current = null
    setCursor({ timeline, draft: null })
    seek(phase === 'cancel' ? current.origin : current.value, phase)
  }, [timeline, seek])
  const index = Math.max(0, candidates.findIndex(item => item.startMs === value))
  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target)) { finish('cancel'); setExpanded(false) }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [expanded, finish])
  if (reduced || !timeline.length) return null
  return <div ref={host} className="replay-transport" data-expanded={expanded} onPointerDown={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); finish('cancel'); setExpanded(false); label.current?.focus() } }}>
    <Button className="replay-play" aria-label={paused ? locale === 'ru' ? 'Продолжить повтор' : 'Play replay' : locale === 'ru' ? 'Приостановить повтор' : 'Pause replay'}
      onClick={() => setPaused(!paused)}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</Button>
    <Button ref={label} className="replay-month" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{format(value)}</Button>
    <div className="replay-scrubber">
      <input type="range" min={0} max={Math.max(0, candidates.length - 1)} step={1} value={index}
        aria-label={locale === 'ru' ? 'Месяц повтора' : 'Replay month'} aria-valuetext={candidates[index]?.month ?? ''}
        onPointerDown={event => { drag.current = { origin: timeMs, value }; event.currentTarget.setPointerCapture?.(event.pointerId); seek(value, 'preview') }}
        onChange={event => change(Number(event.currentTarget.value), drag.current ? 'preview' : 'commit')}
        onPointerUp={() => finish('commit')} onPointerCancel={() => finish('cancel')} onBlur={() => finish('cancel')}
        onKeyDown={event => {
          const keys: Record<string, number> = { ArrowRight: index + 1, ArrowUp: index + 1, ArrowLeft: index - 1, ArrowDown: index - 1, Home: 0, End: candidates.length - 1 }
          if (event.key in keys) { event.preventDefault(); change(Math.max(0, Math.min(candidates.length - 1, keys[event.key])), 'commit') }
        }} />
      <div className="replay-years" aria-hidden="true">{yearTicks(timeline, durationMs).map(item => <span key={item.year} style={{ left: `${Math.max(0, candidates.findIndex(candidate => candidate.month === item.month)) / Math.max(1, candidates.length - 1) * 100}%` }}>{item.year}</span>)}</div>
    </div>
  </div>
}
