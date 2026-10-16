'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PlayPauseIcon } from '../../ui/icon-morph'
import { Button } from '../../ui/button'
import type { Locale } from '../../../lib/format'
import { fitYearTicks, monthAt, monthCandidates, yearTicks, type TimelineItem } from './replay'

/** One mono year label at 12px, and the space kept between neighbours. */
const YEAR_LABEL = 30,
  YEAR_GAP = 12

export function ReplayTransport({
  timeline,
  durationMs,
  timeMs,
  getFrame,
  paused,
  started,
  setPaused,
  seek,
  reduced,
  locale,
}: {
  timeline: TimelineItem[]
  durationMs: number
  timeMs: number
  getFrame?: () => { timeMs: number }
  paused: boolean
  /** Before the first Play the map is still and the transport is one labelled Play button. */
  started: boolean
  setPaused: (paused: boolean) => void
  seek: (time: number, phase: 'preview' | 'commit' | 'cancel') => void
  reduced: boolean
  locale: Locale
}) {
  const [expanded, setExpanded] = useState(false)
  const [cursor, setCursor] = useState({ timeline, draft: null as number | null })
  const draft = cursor.timeline === timeline ? cursor.draft : null
  const host = useRef<HTMLDivElement>(null),
    label = useRef<HTMLButtonElement>(null),
    play = useRef<HTMLButtonElement>(null)
  // Play replaces itself with the full transport; focus moves to its Pause so the keyboard stays in place.
  const handoff = useRef(false)
  useEffect(() => {
    if (started && handoff.current) {
      handoff.current = false
      play.current?.focus()
    }
  }, [started])
  const candidates = useMemo(() => monthCandidates(timeline, durationMs), [timeline, durationMs])
  const month = monthAt(timeline, timeMs, durationMs)
  const value =
    draft ?? candidates.find((item) => item.month === month)?.startMs ?? candidates[0]?.startMs ?? 0
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    [locale],
  )
  const monthLabel = useMemo(() => {
    const item = candidates.find((item) => item.startMs === value)
    return item
      ? formatter.format(new Date(`${item.month}-01T00:00:00Z`)).toLocaleUpperCase(locale)
      : '—'
  }, [candidates, value, formatter, locale])
  // Every month name reserves its width in the button, so the label never resizes and the bottom row never rewraps.
  const monthAlternatives = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) =>
        formatter.format(new Date(Date.UTC(2000, month, 1))).toLocaleUpperCase(locale),
      ),
    [formatter, locale],
  )
  const drag = useRef<{ origin: number; value: number } | null>(null)
  const change = (index: number, phase: 'preview' | 'commit') => {
    const next = candidates[index]?.startMs
    if (next === undefined) return
    if (drag.current) drag.current.value = next
    setCursor({ timeline, draft: phase === 'preview' ? next : null })
    seek(next, phase)
  }
  const finish = useCallback(
    (phase: 'commit' | 'cancel') => {
      const current = drag.current
      if (!current) return
      drag.current = null
      setCursor({ timeline, draft: null })
      seek(phase === 'cancel' ? current.origin : current.value, phase)
    },
    [timeline, seek],
  )
  const index = Math.max(
    0,
    candidates.findIndex((item) => item.startMs === value),
  )
  // Year labels thin out by where they land on the scrubber; see fitYearTicks.
  const years = useRef<HTMLDivElement>(null)
  const [yearsWidth, setYearsWidth] = useState(0)
  useEffect(() => {
    const node = years.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setYearsWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
    // The scale only mounts after the first Play, so `started` must re-run this.
  }, [reduced, started, timeline.length])
  const ticks = useMemo(
    () =>
      fitYearTicks(
        yearTicks(timeline, durationMs).map((item) => ({
          ...item,
          at:
            Math.max(
              0,
              candidates.findIndex((candidate) => candidate.month === item.month),
            ) / Math.max(1, candidates.length - 1),
        })),
        yearsWidth,
        YEAR_LABEL,
        YEAR_GAP,
      ),
    [timeline, durationMs, candidates, yearsWidth],
  )
  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target)) {
        finish('cancel')
        setExpanded(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [expanded, finish])
  if (reduced || !timeline.length) return null
  if (!started)
    return (
      <div className="replay-transport" data-still="">
        <Button
          className="replay-start"
          dense
          aria-label={
            locale === 'ru' ? 'Воспроизвести маршруты по месяцам' : 'Replay routes month by month'
          }
          onClick={() => {
            handoff.current = true
            setPaused(false)
          }}
        >
          <PlayPauseIcon state={false} size={16} />
          {locale === 'ru' ? 'Воспроизвести' : 'Replay'}
        </Button>
      </div>
    )
  return (
    <div
      ref={host}
      className="replay-transport"
      data-expanded={expanded}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          finish('cancel')
          setExpanded(false)
          label.current?.focus()
        }
      }}
    >
      <Button
        ref={play}
        className="replay-play"
        dense
        aria-label={
          paused
            ? locale === 'ru'
              ? 'Продолжить повтор'
              : 'Play replay'
            : locale === 'ru'
              ? 'Приостановить повтор'
              : 'Pause replay'
        }
        onClick={() => setPaused(!paused)}
      >
        <PlayPauseIcon state={!paused} size={16} />
      </Button>
      <Button
        ref={label}
        className="replay-month"
        dense
        morphText
        instantText
        textAlternatives={monthAlternatives}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {monthLabel}
      </Button>
      <div className="replay-scrubber">
        <input
          type="range"
          min={0}
          max={Math.max(0, candidates.length - 1)}
          step={1}
          value={index}
          aria-label={locale === 'ru' ? 'Месяц повтора' : 'Replay month'}
          aria-valuetext={candidates[index]?.month ?? ''}
          onPointerDown={(event) => {
            drag.current = { origin: getFrame?.().timeMs ?? timeMs, value }
            event.currentTarget.setPointerCapture?.(event.pointerId)
            seek(value, 'preview')
          }}
          onChange={(event) =>
            change(Number(event.currentTarget.value), drag.current ? 'preview' : 'commit')
          }
          onPointerUp={() => finish('commit')}
          onPointerCancel={() => finish('cancel')}
          onBlur={() => finish('cancel')}
          onKeyDown={(event) => {
            const keys: Record<string, number> = {
              ArrowRight: index + 1,
              ArrowUp: index + 1,
              ArrowLeft: index - 1,
              ArrowDown: index - 1,
              Home: 0,
              End: candidates.length - 1,
            }
            if (event.key in keys) {
              event.preventDefault()
              change(Math.max(0, Math.min(candidates.length - 1, keys[event.key])), 'commit')
            }
          }}
        />
        <div ref={years} className="replay-years" aria-hidden="true">
          {ticks.map((item) => (
            <span key={item.year} style={{ left: `${item.at * 100}%` }}>
              {item.year}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
