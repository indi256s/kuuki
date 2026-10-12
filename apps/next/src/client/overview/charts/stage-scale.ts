import type { ChartPoint, KuukiChartProps } from './kuuki-chart'

export type StageSpan = 'sheet' | 'full'
/** What both stage charts take from the chapter: KuukiChart's interaction props plus the numbers to draw. */
export type StageProps<T> = Pick<
  KuukiChartProps<T>,
  'points' | 'onPick' | 'actions' | 'tip' | 'table' | 'ariaLabel' | 'ariaDescription' | 'inView'
> & {
  /** The number a mark is drawn from. Zero is a known zero (a stub); unknown values do not belong in `points`. */
  value: (point: ChartPoint<T>) => number
  /** The picked reading (`data-picked`, accent). */
  selectedKey?: string | null
  /** Keys the page is filtered by (the v1 contour; rows also get a "✓ " before the label). */
  appliedKeys?: readonly string[]
  /** Value text for a mark (the reading label of a column, the value column of a row). Default: the number. A known zero always reads "—". */
  format?: (point: ChartPoint<T>) => string
  span: StageSpan
}

export const DASH = '—'
const round = (value: number) => +value.toFixed(3)
export const num = round

export function stageMax<T>(points: readonly ChartPoint<T>[], value: (p: ChartPoint<T>) => number) {
  return points.reduce((max, point) => Math.max(max, value(point)), 0)
}

/** Length of a mark in px: a known zero is the stub, anything else is proportional but never thinner than `floor`. */
export function stageExtent(value: number, max: number, room: number, stub: number, floor: number) {
  if (!(value > 0) || !(max > 0)) return stub
  return Math.max(floor, Math.min(room, (room * value) / max))
}

export function stageText<T>(props: Pick<StageProps<T>, 'value' | 'format'>, point: ChartPoint<T>) {
  const value = props.value(point)
  return value > 0 ? (props.format?.(point) ?? String(value)) : DASH
}
