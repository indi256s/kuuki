import type { CSSProperties } from 'react'

export type ChartPalette = CSSProperties & { [slot: `--ts-chart-${number}`]: string }

export const DEFAULT_PALETTE: ChartPalette = {
  '--ts-chart-1': 'var(--mark-1)',
  '--ts-chart-2': 'var(--mark-2)',
  '--ts-chart-3': 'var(--mark-3)',
  '--ts-chart-4': 'var(--mark-4)',
  '--ts-chart-5': 'var(--mark-ghost)',
}

export const MAKER_PALETTE: ChartPalette = {
  '--ts-chart-1': 'var(--cat-maker-airbus)',
  '--ts-chart-2': 'var(--cat-maker-boeing)',
  '--ts-chart-3': 'var(--cat-maker-embraer)',
  '--ts-chart-4': 'var(--cat-maker-atr)',
  '--ts-chart-5': 'var(--cat-maker-other)',
  '--ts-chart-6': 'var(--cat-maker-unknown)',
}
