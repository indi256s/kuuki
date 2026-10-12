'use client'

import type { ReactNode } from 'react'
import { KuukiChart, type ChartPoint } from './kuuki-chart'
import { num, stageExtent, stageMax, stageText, type StageProps } from './stage-scale'
import './stage.css'

export type StageRowsProps<T> = StageProps<T> & {
  /** The row's visible name (`point.label` is the longer spoken one). */
  name?: (point: ChartPoint<T>) => string
  /** Mono name, for codes. */
  mono?: boolean
  /** 16px leading slot, e.g. a maker swatch. */
  swatch?: (point: ChartPoint<T>) => ReactNode
  /** Width reserved for the value column. Default 48. */
  valueWidth?: number
}

const PITCH = 24,
  LABEL = 160,
  BAR_X = 172,
  BAR_H = 8,
  GAP = 8

// A bar is drawn at its full length and scaled from its start, so a changed value morphs by transform only.
// The ends are elliptical (rx = r / scale) to look round once scaled.
function pill(x: number, y: number, length: number, width: number) {
  const r = Math.min(BAR_H / 2, width / 2),
    rx = (r * length) / width,
    right = x + length,
    bottom = y + BAR_H
  return `M${num(x + rx)} ${y}H${num(right - rx)}A${num(rx)} ${r} 0 0 1 ${right} ${y + r}V${bottom - r}A${num(rx)} ${r} 0 0 1 ${num(right - rx)} ${bottom}H${num(x + rx)}A${num(rx)} ${r} 0 0 1 ${x} ${bottom - r}V${y + r}A${num(rx)} ${r} 0 0 1 ${num(x + rx)} ${y}Z`
}

export function StageRows<T>(props: StageRowsProps<T>) {
  const { points, value, selectedKey, appliedKeys, span, name, mono, swatch } = props
  const valueWidth = props.valueWidth ?? 48,
    max = stageMax(points, value)
  const applied = (point: ChartPoint<T>) => !!appliedKeys?.includes(point.key)
  return (
    <KuukiChart
      points={points}
      height={points.length * PITCH}
      ariaLabel={props.ariaLabel}
      ariaDescription={props.ariaDescription}
      inView={props.inView}
      onPick={props.onPick}
      actions={props.actions}
      tip={props.tip}
      table={props.table}
      selected={(point) => point.key === selectedKey}
      applied={appliedKeys ? applied : undefined}
      tapPicks
    >
      {(mark, size) => {
        const room = Math.max(0, size.width - BAR_X - valueWidth - GAP)
        return (
          <g className="stage" data-span={span}>
            {points.map((point, index) => {
              const amount = value(point),
                y = index * PITCH,
                width = stageExtent(amount, max, room, 4, 5),
                length = Math.max(room, width),
                d = pill(BAR_X, y + (PITCH - BAR_H) / 2, length, width)
              return (
                <g key={point.key} {...mark(point)} data-zero={!(amount > 0) || undefined}>
                  <rect x={0} y={y} width={size.width} height={PITCH} fill="transparent" />
                  <foreignObject x={0} y={y} width={LABEL} height={PITCH} pointerEvents="none">
                    <div className="stage-label" data-mono={mono || undefined}>
                      {swatch ? <span className="stage-swatch">{swatch(point)}</span> : null}
                      <span className="stage-name">
                        {applied(point) ? '✓ ' : ''}
                        {name?.(point) ?? point.label}
                      </span>
                    </div>
                  </foreignObject>
                  <g
                    className="stage-bar"
                    data-axis="x"
                    style={{ transform: `scaleX(${num(width / length)})` }}
                  >
                    <path d={d} />
                    {amount > 0 ? <path className="stage-peak" d={d} /> : null}
                  </g>
                  <text className="stage-value" x={size.width} y={y + 16} textAnchor="end">
                    {stageText(props, point)}
                  </text>
                </g>
              )
            })}
          </g>
        )
      }}
    </KuukiChart>
  )
}
