'use client'

import { useState } from 'react'
import type { RankRow } from '@kuuki/shared/overview/rankings'
import { airlineColor } from '../../../../lib/airline'
import { sum } from '../../charts/apportion'
import {
  ArcDotRing,
  DotMark,
  dotRingSize,
  type DotRingPlan,
  type DotRingSegment,
} from '../../charts/arc-dot-ring'
import { slotCue, useComparisonSlots } from '../../charts/comparison-slots'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, flights, moreAirlinesLabel, number, percent } from './display'
import './airline-ring.css'

const TOP = 5,
  REST = '__more',
  UNKNOWN = '__unknown'

/** The ring's segments in order: the top five airlines, the rest of the known ones together, then flights without an airline. */
export function airlineSegments(rows: readonly RankRow[], unknown: number) {
  const top = rows.slice(0, TOP),
    rest = rows.slice(TOP),
    restCount = sum(rest.map((row) => row.count)),
    counts = [...top.map((row) => row.count), restCount, unknown]
  return { top, restAirlines: rest.length, restCount, unknown, counts, total: sum(counts) }
}
export type AirlineSegments = ReturnType<typeof airlineSegments>

type Datum = { count: number; share: number }

export function AirlineRing({
  span,
  plan,
  segments: { top, restAirlines, restCount, unknown, total },
  seedOrder,
  selectedKey,
  appliedKeys,
  name,
  ariaLabel,
  onPick,
  onFilter,
}: {
  span: Span
  plan: DotRingPlan
  segments: AirlineSegments
  /** The whole journal's airlines in rank order: slots follow these, not the current cohort. */
  seedOrder: readonly string[]
  selectedKey: string | null
  appliedKeys: readonly string[]
  name: (key: string) => string
  ariaLabel: string
  onPick: (key: string) => void
  onFilter: (key: string) => void
}) {
  const { locale, ownerKey } = useOverview()
  const [linked, setLinked] = useState<string | null>(null)
  const stops = top.map((row) => row.key),
    size = dotRingSize(plan.span)
  const slots = useComparisonSlots({
    analysis: 'airlines-cues',
    ownerId: ownerKey,
    visibleKeys: stops,
    seedOrder,
  })
  const describe = (label: string, count: number) =>
    `${label} · ${flights(locale, count)} · ${percent(total ? count / total : 0)}`
  const every: (DotRingSegment<Datum> & { label: string })[] = [
    ...top.map((row) => {
      const cue = slotCue(slots.get(row.key) ?? 0)
      return {
        point: {
          key: row.key,
          datum: { count: row.count, share: total ? row.count / total : 0 },
          label: describe(name(row.key), row.count),
        },
        count: row.count,
        kind: 'marked' as const,
        color: airlineColor(row.key),
        marker: cue.marker,
        label: name(row.key),
      }
    }),
    {
      point: {
        key: REST,
        datum: { count: restCount, share: total ? restCount / total : 0 },
        label: describe(moreAirlinesLabel(locale, restAirlines), restCount),
      },
      count: restCount,
      kind: 'rest' as const,
      color: 'var(--brand-neutral)',
      marker: 'circle' as const,
      label: moreAirlinesLabel(locale, restAirlines),
    },
    {
      point: {
        key: UNKNOWN,
        datum: { count: unknown, share: total ? unknown / total : 0 },
        label: describe(copy(locale, 'Unknown', 'Не указана'), unknown),
      },
      count: unknown,
      kind: 'unknown' as const,
      color: 'var(--cat-maker-unknown)',
      marker: 'circle' as const,
      label: copy(locale, 'Unknown', 'Не указана'),
    },
  ]
  // The ring skips empty segments (the plan keeps their place); the host and the legend list only the ones with flights.
  const present = every.filter((segment) => segment.count > 0)
  const picked = top.find((row) => row.key === selectedKey)
  const centre = picked
    ? { value: percent(total ? picked.count / total : 0), label: name(picked.key) }
    : null
  const pickable = (key: string) => stops.includes(key)
  return (
    <div className="ov3-airline-ring" data-span={span}>
      <div className="ov3-airline-ring-chart">
        <LazyChart height={size} label={ariaLabel}>
          {(inView) => (
            <KuukiChart
              points={present.map((segment) => segment.point)}
              height={size}
              fit={() => size}
              inView={inView}
              ariaLabel={ariaLabel}
              keyStops={stops}
              tapPicks
              selected={(point) => point.key === selectedKey}
              applied={(point) => appliedKeys.includes(point.key)}
              onPick={(point) => {
                if (pickable(point.key)) onPick(point.key)
              }}
              actions={(point) =>
                pickable(point.key)
                  ? [
                      {
                        label: copy(locale, `Only ${point.key}`, `Только ${point.key}`),
                        run: () => onFilter(point.key),
                      },
                    ]
                  : []
              }
              tip={(items) => <span>{items[0].label}</span>}
            >
              {(mark) => (
                <ArcDotRing
                  segments={every}
                  plan={plan}
                  mark={(point) => {
                    // Wedge and legend row light up together; neither picks until clicked.
                    const props = mark(point)
                    return {
                      ...props,
                      onPointerEnter: (event) => {
                        props.onPointerEnter?.(event)
                        setLinked(point.key)
                      },
                      onPointerLeave: (event) => {
                        props.onPointerLeave?.(event)
                        setLinked(null)
                      },
                      onFocus: (event) => {
                        props.onFocus?.(event)
                        setLinked(point.key)
                      },
                      onBlur: () => setLinked(null),
                    }
                  }}
                  highlightKey={linked}
                  centre={centre}
                />
              )}
            </KuukiChart>
          )}
        </LazyChart>
      </div>
      {/* A pointer shortcut to the wedges, which carry the keyboard and screen-reader model; the table lists the same numbers. */}
      <ul className="ov3-airline-legend" aria-hidden="true">
        {present.map((segment) => {
          const key = segment.point.key,
            active = appliedKeys.includes(key),
            current = key === selectedKey
          return (
            <li
              key={key}
              data-pick={pickable(key) || undefined}
              data-linked={linked === key || undefined}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'touch') setLinked(key)
              }}
              onPointerLeave={() => setLinked(null)}
              onClick={() => {
                if (pickable(key)) onPick(key)
              }}
            >
              <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
                <DotMark
                  kind={segment.kind}
                  marker={segment.marker}
                  color={segment.color}
                  r={4.6}
                />
                {current ? <circle r={7} fill="none" stroke="var(--text)" strokeWidth={2} /> : null}
              </svg>
              <span className="ov3-airline-legend-name">
                {active ? '✓ ' : ''}
                {segment.label}
              </span>
              <span className="ov3-airline-legend-count">{number(locale, segment.count)}</span>
              <span className="ov3-airline-legend-share">
                {percent(total ? segment.count / total : 0)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
