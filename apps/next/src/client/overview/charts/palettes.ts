import type { CSSProperties } from 'react'

export type ChartPalette = CSSProperties & { [slot: `--kc-chart-${number}`]: string }

export const DEFAULT_PALETTE: ChartPalette = {
  '--kc-chart-1': 'var(--mark-1)',
  '--kc-chart-2': 'var(--mark-2)',
  '--kc-chart-3': 'var(--mark-3)',
  '--kc-chart-4': 'var(--mark-4)',
  '--kc-chart-5': 'var(--mark-ghost)',
}

export const MAKER_PALETTE: ChartPalette = {
  '--kc-chart-1': 'var(--cat-maker-airbus)',
  '--kc-chart-2': 'var(--cat-maker-boeing)',
  '--kc-chart-3': 'var(--cat-maker-embraer)',
  '--kc-chart-4': 'var(--cat-maker-atr)',
  '--kc-chart-5': 'var(--cat-maker-other)',
  '--kc-chart-6': 'var(--cat-maker-unknown)',
}
