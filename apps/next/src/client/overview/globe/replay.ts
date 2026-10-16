import { calendarDay, type ReplayItem } from '@kuuki/shared/overview/next'

export type TimelineItem = ReplayItem & { startMs: number; month: string }
export type ReplayPlane = { item: TimelineItem; launchMs: number; key: string }
export const PLANE_MS = 4000

export function replayDurationMs(n: number): number {
  return Math.max(12000, Math.min(120000, 10000 + 12000 * Math.log2(Math.max(1, n) / 10)))
}
const monthStart = (month: string) => calendarDay(`${month}-01`)!
function nextMonth(month: string): number {
  const date = new Date(monthStart(month))
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.getTime()
}
export function timelineBounds(timeline: TimelineItem[]) {
  return timeline.length
    ? { from: monthStart(timeline[0].month), to: nextMonth(timeline.at(-1)!.month) }
    : null
}
export function buildTimeline(items: ReplayItem[], durationMs: number): TimelineItem[] {
  const dated = items
    .flatMap((item) => {
      const date = item.date.length === 7 ? `${item.date}-01` : item.date
      const time = calendarDay(date)
      return time === null ? [] : [{ item, time }]
    })
    .sort((a, b) => a.time - b.time || a.item.key.localeCompare(b.item.key))
  if (!dated.length) return []
  const from = monthStart(dated[0].item.date.slice(0, 7)),
    to = nextMonth(dated.at(-1)!.item.date.slice(0, 7))
  return dated.map(({ item, time }) => ({
    ...item,
    month: item.date.slice(0, 7),
    startMs: ((time - from) / (to - from)) * durationMs,
  }))
}
export function monthAt(timeline: TimelineItem[], t: number, durationMs: number): string | null {
  const bounds = timelineBounds(timeline)
  return bounds
    ? new Date(
        bounds.from +
          Math.max(0, Math.min(1 - Number.EPSILON, t / durationMs)) * (bounds.to - bounds.from),
      )
        .toISOString()
        .slice(0, 7)
    : null
}
export function monthCandidates(
  timeline: TimelineItem[],
  durationMs: number,
): Array<{ month: string; startMs: number }> {
  const bounds = timelineBounds(timeline)
  if (!bounds) return []
  const months = []
  for (let time = bounds.from; time < bounds.to;) {
    const month = new Date(time).toISOString().slice(0, 7)
    months.push({ month, startMs: ((time - bounds.from) / (bounds.to - bounds.from)) * durationMs })
    time = nextMonth(month)
  }
  return months
}
export function yearTicks(timeline: TimelineItem[], durationMs: number) {
  return monthCandidates(timeline, durationMs)
    .filter((item, index) => index === 0 || item.month.endsWith('-01'))
    .map((item) => ({ ...item, year: item.month.slice(0, 4) }))
}

/** Keeps the year labels that fit a scrubber `width` px wide, by where they actually land: the first label hangs right of its tick, the
 * last hangs left, the rest centre. The first always stays and the last does unless the span is too short for both; a label between
 * them stays only if it clears its neighbours by `gap`. Unmeasured (width 0) keeps just the ends, never a pile-up. */
export function fitYearTicks<T extends { at: number }>(
  ticks: T[],
  width: number,
  label: number,
  gap: number,
): T[] {
  if (ticks.length < 2) return ticks
  const first = ticks[0]!,
    last = ticks.at(-1)!
  if (width <= 0) return [first, last]
  // The last label's left edge bounds everything before it.
  const limit = last.at * width - label - gap
  const kept = [first]
  let right = first.at * width + label
  for (const tick of ticks.slice(1, -1)) {
    const x = tick.at * width
    if (x - label / 2 >= right + gap && x + label / 2 <= limit) {
      kept.push(tick)
      right = x + label / 2
    }
  }
  // Only a span too short for two labels drops the last one.
  return right <= limit ? [...kept, last] : kept
}

/** Launch admission happens once per event; rejected extras never appear later. */
export function createReplaySchedule(timeline: TimelineItem[], durationMs: number) {
  let cursor = -1,
    loop = 0,
    nextCycle = 0,
    nextIndex = 0
  let planes: ReplayPlane[] = [],
    arcs = new Set<string>()
  const reset = (time: number) => {
    cursor = time
    loop = nextCycle = Math.floor(time / durationMs)
    const position = time % durationMs
    planes = []
    arcs = new Set(timeline.filter((item) => item.startMs < position).map((item) => item.key))
    nextIndex = timeline.findIndex((item) => item.startMs >= position)
    if (nextIndex < 0) {
      nextIndex = 0
      nextCycle++
    }
  }
  return {
    seek(time: number) {
      reset(time)
    },
    advance(time: number, skipIdle = false) {
      if (time < cursor) reset(time)
      if (
        skipIdle &&
        timeline.length &&
        !planes.some((plane) => plane.launchMs + PLANE_MS > time)
      ) {
        time = Math.max(time, nextCycle * durationMs + timeline[nextIndex].startMs)
      }
      let copied = false
      while (timeline.length) {
        const item = timeline[nextIndex],
          launchMs = nextCycle * durationMs + item.startMs
        if (launchMs > time) break
        if (nextCycle !== loop) {
          arcs = new Set()
          loop = nextCycle
          copied = true
        }
        planes = planes.filter((plane) => plane.launchMs + PLANE_MS > launchMs)
        if (!copied) {
          arcs = new Set(arcs)
          copied = true
        }
        arcs.add(item.key)
        if (planes.length < 12) planes.push({ item, launchMs, key: `${nextCycle}:${item.key}` })
        nextIndex++
        if (nextIndex === timeline.length) {
          nextIndex = 0
          nextCycle++
        }
      }
      const lastLoop = Math.floor(time / durationMs)
      if (lastLoop !== loop) {
        arcs = new Set()
        loop = lastLoop
      }
      planes = planes.filter((plane) => plane.launchMs + PLANE_MS > time)
      cursor = time
      return { planes: [...planes], arcs, timeMs: time % durationMs, absoluteMs: time }
    },
  }
}
