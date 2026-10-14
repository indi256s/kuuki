import type { SVGProps } from 'react'
import { KuukiChart, type ChartPoint, type KuukiChartProps } from './kuuki-chart'
import './arc-waffle.css'

// Adapted from Arc Waffle, MIT; notice: ../../ui/ARC-LICENSE.txt.
// Fetched https://uiarc.dev/r/waffle-chart.json on 2026-10-14.
// Upstream waffle-chart.tsx SHA256: f1538515ae585da3d69e87421841593fa1297d98f73d826104b4771949f021b0.
// Retain the bottom-up grid and largest-remainder allocation. Use 100 bounded cells,
// category tokens and exact legend values; KuukiChart owns selection and actions.
// No category hiding, neighbour dimming, motion runtime or per-flight cell claims.
const CELLS = 100

type WaffleProps<T> = Pick<
  KuukiChartProps<T>,
  'points' | 'inView' | 'height' | 'ariaLabel' | 'onPick' | 'actions' | 'tip'
> & {
  value: (point: ChartPoint<T>) => number
  name: (point: ChartPoint<T>) => string
  format: (point: ChartPoint<T>) => string
  fill: (point: ChartPoint<T>) => string
  outline: (point: ChartPoint<T>) => boolean
  selectedKey: string | null
  appliedKeys: readonly string[]
  note: string
}

/** Whole cells approximate shares; the legend retains every category, even below one cell. */
export function ArcWaffle<T>(props: WaffleProps<T>) {
  const total = props.points.reduce((sum, point) => sum + props.value(point), 0)
  const exact = props.points.map((point) => (total > 0 ? (props.value(point) / total) * CELLS : 0))
  const counts = exact.map(Math.floor)
  const order = exact
    .map((value, index) => ({ index, rest: value - counts[index] }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index)
  const remaining = total > 0 ? CELLS - counts.reduce((sum, count) => sum + count, 0) : 0
  for (let i = 0; i < remaining; i++) counts[order[i].index]++
  const applied = (point: ChartPoint<T>) => props.appliedKeys.includes(point.key)
  return (
    <KuukiChart
      points={props.points}
      height={props.height}
      ariaLabel={props.ariaLabel}
      ariaDescription={props.note}
      inView={props.inView}
      onPick={props.onPick}
      actions={props.actions}
      tip={props.tip}
      selected={(point) => point.key === props.selectedKey}
      applied={applied}
      tapPicks
    >
      {(mark, size) => {
        const board = Math.min(210, size.width * 0.4)
        const pitch = board / 10
        const legendX = board + 24
        let slot = 0
        return (
          <g className="arc-waffle">
            {props.points.map((point, index) => {
              const outlined = props.outline(point)
              const color = props.fill(point)
              const cells = Array.from({ length: counts[index] }, () => slot++)
              const paint: SVGProps<SVGRectElement> = {
                fill: outlined ? 'none' : color,
                stroke: outlined ? color : undefined,
                strokeWidth: outlined ? 1 : undefined,
                'data-kc-outline': outlined || undefined,
              } as SVGProps<SVGRectElement>
              const y = index * 36
              return (
                <g key={point.key} {...mark(point)}>
                  {cells.map((cell) => {
                    const x = 2 + Math.floor(cell / 10) * pitch
                    const y = 2 + (9 - (cell % 10)) * pitch
                    return (
                      <g key={cell}>
                        <rect x={x} y={y} width={pitch - 4} height={pitch - 4} rx={3} {...paint} />
                        {outlined && pitch - 4 >= 14 ? (
                          <text
                            x={x + (pitch - 4) / 2}
                            y={y + (pitch - 4) / 2 + 4}
                            textAnchor="middle"
                            fontSize={12}
                            data-sans
                            aria-hidden="true"
                          >
                            ?
                          </text>
                        ) : null}
                      </g>
                    )
                  })}
                  <rect
                    x={legendX}
                    y={y}
                    width={size.width - legendX}
                    height={36}
                    fill="transparent"
                  />
                  <rect x={legendX + 2} y={y + 12} width={12} height={12} rx={3} {...paint} />
                  {outlined ? (
                    <text x={legendX + 8} y={y + 22} textAnchor="middle" fontSize={12} data-sans>
                      ?
                    </text>
                  ) : null}
                  <foreignObject
                    x={legendX + 24}
                    y={y}
                    width={Math.max(0, size.width - legendX - 138)}
                    height={36}
                    pointerEvents="none"
                  >
                    <div className="arc-waffle-name">
                      {applied(point) ? '✓ ' : ''}
                      {props.name(point)}
                    </div>
                  </foreignObject>
                  <text
                    className="arc-waffle-value"
                    x={size.width - 2}
                    y={y + 22}
                    textAnchor="end"
                    fontSize={13}
                  >
                    {props.format(point)}
                  </text>
                </g>
              )
            })}
            <text x={2} y={size.height - 5} fontSize={13} className="arc-waffle-note">
              {props.note}
            </text>
          </g>
        )
      }}
    </KuukiChart>
  )
}
