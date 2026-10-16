'use client'

import type { SVGProps } from 'react'
import type { ChartPoint } from './kuuki-chart'
import { KuukiChart } from './kuuki-chart'
import { num, stageExtent, stageMax, stageText, type StageProps } from './stage-scale'
import './stage.css'

export type StageBand = { from: number; to: number; label?: string }
export type StageTick = { index: number; text: string }
export type StageColumnsProps<T> = StageProps<T> & {
  /** Bar width and pitch in px. Defaults: sheet 9 / 13, full 17 / 25. */
  barWidth?: number
  pitch?: number
  /** Axis labels, centred under their bar. */
  ticks: readonly StageTick[]
  /** Inset rects behind the bars over bar indices [from, to). */
  bands?: readonly StageBand[]
  /** Label the tallest bar (unless it is the picked one). */
  tallest?: boolean
  /** Mono reading label (times, codes). */
  mono?: boolean
}

const PLOT = { sheet: 152, full: 182 },
  AXIS = 24,
  /** Headroom above the tallest bar for its label. */
  HEAD = 22,
  RADIUS = 2,
  /** Band label metrics: 12px mono advance, 8px inset on each side, and the baseline a bar label must stay below. */
  BAND_CHAR = 7.5,
  BAND_PAD = 16,
  BAND_FLOOR = 36

// A column is drawn at its full height and scaled from the baseline, so a changed value morphs by transform only.
// The corner is elliptical (ry = r / scale) to look circular once scaled.
function column(x: number, base: number, width: number, full: number, height: number) {
  const r = Math.min(RADIUS, height / 2, width / 2),
    ry = (r * full) / height,
    top = base - full
  return `M${num(x)} ${base}V${num(top + ry)}A${r} ${num(ry)} 0 0 1 ${num(x + r)} ${top}H${num(x + width - r)}A${r} ${num(ry)} 0 0 1 ${num(x + width)} ${num(top + ry)}V${base}Z`
}

export function StageColumns<T>(props: StageColumnsProps<T>) {
  const { points, span } = props
  const baseBar = props.barWidth ?? (span === 'full' ? 17 : 9),
    basePitch = props.pitch ?? (span === 'full' ? 25 : 13),
    natural = points.length ? (points.length - 1) * basePitch + baseBar : 0
  return (
    <KuukiChart
      points={points}
      height={PLOT[span] + AXIS}
      ariaLabel={props.ariaLabel}
      ariaDescription={props.ariaDescription}
      inView={props.inView}
      onPick={props.onPick}
      actions={props.actions}
      tip={props.tip}
      selected={(point) => point.key === props.selectedKey}
      applied={props.appliedKeys ? (point) => props.appliedKeys!.includes(point.key) : undefined}
      tapPicks
      // A host wider than the bars' natural width is filled: bar and gap grow together. A narrower one scrolls.
      fit={(available) => Math.max(natural, available)}
    >
      {(mark, size) => {
        const k = natural > 0 ? size.width / natural : 1
        return <Stage {...props} mark={mark} bar={baseBar * k} pitch={basePitch * k} />
      }}
    </KuukiChart>
  )
}

function Stage<T>(
  props: StageColumnsProps<T> & {
    mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>
    /** Bar width and pitch after stretching to the host. */
    bar: number
    pitch: number
  },
) {
  const { points, value, selectedKey, appliedKeys, span, ticks, bands, tallest, mono, mark } = props
  const { bar, pitch } = props,
    plot = PLOT[span],
    room = plot - HEAD,
    width = points.length ? (points.length - 1) * pitch + bar : 0,
    max = stageMax(points, value),
    inset = (pitch - bar) / 2,
    left = (index: number) => index * pitch,
    // The hit cell of a bar runs from the middle of the gap before it to the middle of the gap after it.
    cell = (index: number) => Math.min(width, Math.max(0, left(index) - inset)),
    heightOf = (point: ChartPoint<T>) => stageExtent(value(point), max, room, 2, 3)
  const applied = (point: ChartPoint<T>) => !!appliedKeys?.includes(point.key)
  const picked = points.find((point) => point.key === selectedKey)
  const peak = max > 0 ? points.find((point) => value(point) === max) : undefined
  // Labels near either end stay inside the chart instead of centring past it.
  const label = (
    point: ChartPoint<T>,
    className: string,
    gap: number,
    text = stageText(props, point),
  ) => {
    const centre = left(points.indexOf(point)) + bar / 2
    return (
      <text
        key={point.key}
        className={className}
        data-mono={(className === 'stage-reading' && mono) || undefined}
        x={centre < 24 ? centre - bar / 2 : centre > width - 24 ? centre + bar / 2 : centre}
        y={plot - heightOf(point) - gap}
        textAnchor={centre < 24 ? 'start' : centre > width - 24 ? 'end' : 'middle'}
      >
        {applied(point) && className !== 'stage-applied' ? `✓ ${text}` : text}
      </text>
    )
  }
  // The tallest and the picked bar carry their ✓ in their label; every other applied bar gets a bare ✓ over it.
  const labelled = new Set([picked, tallest && peak !== picked ? peak : undefined])
  // A band label sits in the headroom at the band's start, else its end, else nowhere: never over a bar's label.
  const bandLabel = (band: StageBand) => {
    if (!band.label) return null
    const reach = band.label.length * BAND_CHAR + BAND_PAD,
      start = cell(band.from),
      end = cell(band.to),
      clear = (from: number, to: number) =>
        points.every((point, index) => {
          if (!labelled.has(point) && !applied(point)) return true
          if (plot - heightOf(point) - 4 > BAND_FLOOR) return true
          const chars = labelled.has(point)
              ? stageText(props, point).length + (applied(point) ? 2 : 0)
              : 1,
            centre = left(index) + bar / 2,
            half = chars * 4 + 2
          return centre + half < from || centre - half > to
        })
    if (end - start < reach) return null
    if (clear(start, start + reach)) return { x: start + BAND_PAD / 2, anchor: 'start' as const }
    if (clear(end - reach, end)) return { x: end - BAND_PAD / 2, anchor: 'end' as const }
    return null
  }
  return (
    <g className="stage" data-span={span}>
      <g aria-hidden="true" pointerEvents="none">
        {bands?.map((band) => {
          const x = cell(band.from),
            placed = bandLabel(band)
          return (
            <g key={`${band.from}-${band.to}`}>
              <rect
                className="stage-band"
                x={x}
                width={Math.max(0, cell(band.to) - x)}
                height={plot}
                rx={6}
              />
              {placed ? (
                <text className="stage-band-label" x={placed.x} y={18} textAnchor={placed.anchor}>
                  {band.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </g>
      {points.map((point, index) => {
        const amount = value(point),
          height = heightOf(point),
          d = column(left(index), plot, bar, room, height)
        return (
          <g key={point.key} {...mark(point)} data-zero={!(amount > 0) || undefined}>
            <rect
              x={cell(index)}
              y={0}
              width={cell(index + 1) - cell(index)}
              height={plot + AXIS}
              fill="transparent"
            />
            <g className="stage-bar" style={{ transform: `scaleY(${num(height / room)})` }}>
              <path d={d} />
              {amount > 0 ? <path className="stage-peak" d={d} /> : null}
            </g>
          </g>
        )
      })}
      <g aria-hidden="true" pointerEvents="none">
        {tallest && peak && peak !== picked ? label(peak, 'stage-tallest', 4) : null}
        {picked ? label(picked, 'stage-reading', 5) : null}
        {points.map((point) =>
          applied(point) && !labelled.has(point) ? label(point, 'stage-applied', 4, '✓') : null,
        )}
        {ticks.map((tick) =>
          points[tick.index] ? (
            <text
              key={tick.index}
              className="stage-tick"
              data-picked={points[tick.index].key === selectedKey || undefined}
              x={left(tick.index) + bar / 2}
              y={plot + 16}
              textAnchor="middle"
            >
              {tick.text}
            </text>
          ) : null,
        )}
      </g>
    </g>
  )
}
