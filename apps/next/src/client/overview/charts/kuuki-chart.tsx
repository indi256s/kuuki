'use client'

import { useMemo, useRef, type ReactNode } from 'react'
import type { ChartBuildContext, ChartPoint, ChartPositionScaleOptions, ChartSpec, ChartValue, DomChartDefinition, InitializedMark, MarkScene, SceneNode } from '@tanstack/charts'
import { RendererChart } from '@tanstack/charts/react/tooltip'
import { motion } from '@tanstack/charts/motion'
import { tooltip } from '@tanstack/charts/tooltip'
import { portal } from '@tanstack/charts/tooltip/portal'
import { Button } from '../../ui/button'
import { DEFAULT_PALETTE, type ChartPalette } from './palettes'
import { TableView, type ChartTable } from './table-view'
import './chart-theme.css'

export type TipAction = { label: string; run: () => void }
export type KuukiChartProps<T, X extends ChartValue = ChartValue, Y extends ChartValue = ChartValue> = {
  definition: DomChartDefinition<T, X, Y>
  height: number
  ariaLabel: string
  ariaDescription?: string
  palette?: ChartPalette
  inView: boolean
  onPick?: (point: ChartPoint<T, X, Y>) => void
  tip?: (points: readonly ChartPoint<T, X, Y>[]) => ReactNode
  actions?: (point: ChartPoint<T, X, Y>) => readonly TipAction[]
  table: ChartTable
}

function resolveSpec(spec: ChartSpec, inView: boolean): ChartSpec {
  const states = <S extends NonNullable<InitializedMark['states']>>(value: S | undefined): S | undefined => value && ({
    ...value,
    definitions: value.definitions.map(state => ({
      ...state,
      transition: !inView ? { type: 'tween', duration: 0, respectReducedMotion: true } : state.transition && { ...state.transition, respectReducedMotion: true },
    })),
  })
  const nodes = (value: readonly SceneNode[]): readonly SceneNode[] => value.map(node => node.kind !== 'group' ? node : {
    ...node,
    children: nodes(node.children),
    ...(node.states ? { states: states(node.states) } : {}),
    ...(node.focus?.candidates ? { focus: { ...node.focus, candidates: nodes(node.focus.candidates) } } : {}),
  })
  // Composition and layout can emit timings that are absent from initialization.
  const scene = (value: MarkScene): MarkScene => ({
    ...value,
    nodes: nodes(value.nodes),
    ...(!inView && value.focusGuides ? { focusGuides: value.focusGuides.map(guide => ({ ...guide, motion: false as const })) } : {}),
  })
  const output = (value: Pick<InitializedMark, 'render' | 'states' | 'postDomain'>) => ({
    render: (context: Parameters<InitializedMark['render']>[0]) => scene(value.render(context)),
    states: states(value.states),
    ...(value.postDomain ? { postDomain: (rendered: MarkScene) => scene(value.postDomain!(rendered)) } : {}),
  })
  return {
    ...spec,
    // Local timings override chart defaults, including motion: false.
    marks: spec.marks.map(mark => ({
      ...mark,
      ...(!inView ? { motion: false as const } : {}),
      initialize: context => {
        const initialized = mark.initialize(context)
        return {
          ...initialized,
          ...(!inView ? { motion: false as const } : {}),
          ...output(initialized),
          ...(initialized.resolveLayout ? { resolveLayout: (context: Parameters<NonNullable<typeof initialized.resolveLayout>>[0]) => {
            const layout = initialized.resolveLayout!(context)
            return { ...layout, ...output({ ...layout, states: layout.states ?? initialized.states, postDomain: layout.postDomain ?? initialized.postDomain }) }
          } } : {}),
        }
      },
    })),
    ...(!inView ? { scales: Object.fromEntries(Object.entries(spec.scales).map(([id, scale]): [string, ChartPositionScaleOptions | null] => [id, !scale || scale.axis === false ? scale : {
      ...scale,
      axis: {
        ...scale.axis,
        motion: false,
        ticks: scale.axis?.ticks === false ? false : { ...scale.axis?.ticks, motion: false },
        tickLabels: scale.axis?.tickLabels === false ? false : { ...scale.axis?.tickLabels, motion: false },
        label: typeof scale.axis?.label === 'object' ? { ...scale.axis.label, motion: false } : scale.axis?.label,
      },
    }])) } : {}),
  }
}

function isChartSelectionInput(target: EventTarget, host: HTMLElement): boolean {
  return target instanceof Element && !target.closest('.kc-tooltip, .ts-chart__interactive-legend') && Boolean(host.querySelector('.ts-chart-surface')?.contains(target))
}

export function KuukiChart<T, X extends ChartValue = ChartValue, Y extends ChartValue = ChartValue>({ definition, height, ariaLabel, ariaDescription, palette = DEFAULT_PALETTE, inView, onPick, tip, actions, table }: KuukiChartProps<T, X, Y>) {
  const modality = useRef('mouse')
  const renderer = useMemo(() => motion<T, X, Y>({ initial: false }), [])
  const resolved = useMemo<DomChartDefinition<T, X, Y>>(() => ({
    ...definition,
    ...('chart' in definition
      ? { chart: (context: ChartBuildContext) => resolveSpec(definition.chart(context), inView) }
      : resolveSpec(definition, inView)),
    motion: inView ? definition.motion : false as const,
    tooltip: {
      ...(definition.tooltip && 'use' in definition.tooltip ? definition.tooltip : {}),
      use: tooltip,
      portal,
      sticky: true,
      // Dismissed controls must stop accepting actions immediately.
      motion: false as const,
      className: 'kc-tooltip',
    },
  }), [definition, inView])
  return <div className="kc" style={palette} onPointerDownCapture={event => { if (isChartSelectionInput(event.target, event.currentTarget)) modality.current = event.pointerType }} onKeyDownCapture={event => {
    if ((event.key === 'Enter' || event.key === ' ') && isChartSelectionInput(event.target, event.currentTarget)) modality.current = 'keyboard'
  }}>
    <RendererChart<T, X, Y>
      definition={resolved}
      renderer={renderer}
      height={height}
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
      onSelect={point => { if (point && modality.current !== 'touch') onPick?.(point) }}
      renderTooltipBody={({ points, primaryPoint, pinned, dismiss, defaultBody }) => <div style={palette} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation() }}>
        {tip ? tip(points) : defaultBody}
        {pinned && modality.current === 'touch' && primaryPoint && <div className="kc-tip-actions">
          {actions?.(primaryPoint).map((action, index) => <Button key={index} onClick={event => { event.stopPropagation(); dismiss(); action.run() }}>{action.label}</Button>)}
        </div>}
      </div>}
    />
    <TableView table={table} />
  </div>
}
