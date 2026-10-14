'use client'

import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { StageRows } from '../../charts/stage-rows'
import type { StageProps } from '../../charts/stage-scale'
import './ranking-bars.css'

type RankingBarsProps<T> = StageProps<T> & {
  name: (point: ChartPoint<T>) => string
  mono?: boolean
}

export function RankingBars<T>(props: RankingBarsProps<T>) {
  if (props.span === 'sheet') return <StageRows {...props} />
  const { points, value, selectedKey, appliedKeys, name } = props
  const max = Math.max(0, ...points.map(value))
  return (
    <KuukiChart
      points={points}
      height={points.length * 72}
      ariaLabel={props.ariaLabel}
      ariaDescription={props.ariaDescription}
      inView={props.inView}
      onPick={props.onPick}
      actions={props.actions}
      tip={props.tip}
      selected={(point) => point.key === selectedKey}
      applied={(point) => !!appliedKeys?.includes(point.key)}
      tapPicks
    >
      {(mark, { width }) => (
        <g className="ov3-ranking-bars">
          {points.map((point, index) => {
            const amount = value(point)
            const y = index * 72
            const room = Math.max(0, width - 36)
            const length = max > 0 ? (amount / max) * room : 0
            return (
              <g key={point.key} {...mark(point)}>
                <rect x={0} y={y} width={width} height={72} fill="transparent" />
                <text className="ov3-ranking-place" x={0} y={y + 18}>
                  {points.findIndex((row) => value(row) === amount) + 1}
                </text>
                <foreignObject x={32} y={y} width={Math.max(0, width - 112)} height={40}>
                  <div className="ov3-ranking-name">
                    {appliedKeys?.includes(point.key) ? '✓ ' : ''}
                    {name(point)}
                  </div>
                </foreignObject>
                <text className="ov3-ranking-count" x={width} y={y + 18} textAnchor="end">
                  {props.format?.(point) ?? amount}
                </text>
                <rect
                  className="ov3-ranking-bar"
                  x={32}
                  y={y + 44}
                  width={length}
                  height={16}
                  rx={3}
                />
              </g>
            )
          })}
        </g>
      )}
    </KuukiChart>
  )
}
