import type { ChartPoint, KuukiChartProps } from './kuuki-chart'

export type StageSpan = 'sheet' | 'full'
export type StageProps<T> = Pick<
  KuukiChartProps<T>,
  'points' | 'onPick' | 'actions' | 'tip' | 'ariaLabel' | 'ariaDescription' | 'inView'
> & {
  value: (point: ChartPoint<T>) => number
  selectedKey?: string | null
  appliedKeys?: readonly string[]
  format?: (point: ChartPoint<T>) => string
  span: StageSpan
}

export const DASH = '—'
const round = (value: number) => +value.toFixed(3)
export const num = round

export function stageMax<T>(points: readonly ChartPoint<T>[], value: (p: ChartPoint<T>) => number) {
  return points.reduce((max, point) => Math.max(max, value(point)), 0)
}

export function stageExtent(value: number, max: number, room: number, stub: number, floor: number) {
  if (!(value > 0) || !(max > 0)) return stub
  return Math.max(floor, Math.min(room, (room * value) / max))
}

export function stageText<T>(props: Pick<StageProps<T>, 'value' | 'format'>, point: ChartPoint<T>) {
  const value = props.value(point)
  return value > 0 ? (props.format?.(point) ?? String(value)) : DASH
}
