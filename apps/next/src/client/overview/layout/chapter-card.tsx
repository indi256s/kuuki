'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Filter } from '@keyline-icons/react'
import { Button } from '../../ui/button'
import { Disclosure } from '../../ui/disclosure'
import { EmptyState } from '../../ui/empty-state'
import { SlotText } from '../../ui/slot-text'
import { Skeleton } from '../../ui/skeleton'
import { S, t } from '../copy'
import { useOverview } from '../store/overview-context'
import { TableView, type ChartTable } from '../charts/table-view'
import { useChapter } from './chapter-context'
import './chapter-card.css'

export type ChapterCardDetails = {
  heading: string
  columns?: { value: string; label: string }[]
  coverage?: ReactNode
  more?: { summary: string; content: ReactNode }[]
  extra?: ReactNode
}
export type ChapterCardProps = {
  state: 'ready' | 'loading' | 'empty'
  /** The aria-hidden iso figure, already sized by the chapter. */
  figure: ReactNode
  /** A transparent button over the figure stage (44px or more on both sides). */
  figureButton?: { label: string; onPress(): void }
  hero: {
    value: string
    unit?: string
    caption: ReactNode
    /** The "Only …" offer; null or absent while the reading is the headline. */
    only?: { label: string; onPress(): void } | null
    /** The value in the mono face (codes). */
    mono?: boolean
  }
  /** Roll the value on change: pass `picked` from `useReading`. Without it a changed value swaps at once. */
  rollValue?: boolean
  /** `table` is the plot's data; its "View as table" disclosure sits in Details, since the stage has a fixed height. */
  chart: { caption: string; toggle?: ReactNode; plot: ReactNode; table?: ChartTable }
  details?: ChapterCardDetails
  empty?: { title: string; line: string; action: ReactNode }
}

/**
 * One chapter's layout, the same bands in the mobile sheet and the desktop card (the span comes from ChapterContext):
 * figure stage, hero, chart stage, details. The bands have fixed boxes (chapter-card.css), so a swipe lines two chapters up
 * and loading, empty and ready never move what is below them.
 */
export function ChapterCard({
  state,
  figure,
  figureButton,
  hero,
  rollValue,
  chart,
  details,
  empty,
}: ChapterCardProps) {
  const { span } = useChapter()
  const { locale } = useOverview()
  const loading = state === 'loading',
    blank = state === 'empty'
  const label = t(S.loading, locale)
  // Applying "Only …" removes its own button, which would drop focus to <body>. Hand it to the picked mark (the applied row) instead.
  const card = useRef<HTMLDivElement>(null)
  const pressedAt = useRef(0)
  const hasOnly = !!hero.only
  useEffect(() => {
    if (hasOnly || Date.now() - pressedAt.current > 2000) return
    pressedAt.current = 0
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement
      if (active && active !== document.body) return
      card.current
        ?.querySelector<HTMLElement>('[data-picked], .ov3-card-figure-button')
        ?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [hasOnly])
  // The value rolls only on a pick. A change that is not a pick (a filter, a reset) starts a new SlotText, which renders its first value still.
  const [roll, setRoll] = useState({ value: hero.value, epoch: 0 })
  let epoch = roll.epoch
  if (roll.value !== hero.value) {
    epoch = rollValue ? roll.epoch : roll.epoch + 1
    setRoll({ value: hero.value, epoch })
  }
  return (
    <div ref={card} className="ov3-card" data-span={span} data-state={state}>
      <div className="ov3-card-top">
        <div className="ov3-card-figure">
          {loading ? (
            <div className="ov3-card-figure-box">
              <Skeleton height="100%" label={label} />
            </div>
          ) : (
            <div className="ov3-card-figure-box" aria-hidden="true">
              {figure}
            </div>
          )}
          {figureButton && state === 'ready' ? (
            <button
              type="button"
              className="ov3-card-figure-button"
              aria-label={figureButton.label}
              onClick={figureButton.onPress}
            />
          ) : null}
        </div>
        {blank ? (
          span === 'sheet' && empty ? (
            <CardEmpty {...empty} />
          ) : (
            <div className="ov3-card-hero" aria-hidden="true" />
          )
        ) : loading ? (
          <div className="ov3-card-hero">
            <Skeleton height="100%" label={label} />
          </div>
        ) : (
          <div className="ov3-card-hero" aria-live="polite">
            <div
              className="ov3-card-value"
              data-mono={hero.mono || undefined}
              data-only={hero.only ? '' : undefined}
            >
              <span className="ov3-card-value-text">
                <SlotText key={epoch} value={hero.value} />
              </span>
              {hero.unit ? <span className="ov3-card-unit">{hero.unit}</span> : null}
            </div>
            <div className="ov3-card-caption">{hero.caption}</div>
            {hero.only ? (
              <div className="ov3-card-only">
                <Button
                  dense
                  variant="secondary"
                  icon={<Filter size={14} aria-hidden="true" />}
                  onClick={() => {
                    pressedAt.current = Date.now()
                    hero.only?.onPress()
                  }}
                >
                  {hero.only.label}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      {blank ? (
        span === 'full' && empty ? (
          <CardEmpty {...empty} />
        ) : null
      ) : (
        <div className="ov3-card-chart">
          <div className="ov3-card-chart-header">
            <span className="ov3-card-chart-caption">
              <span className="ov3-card-chart-caption-text">{chart.caption}</span>
            </span>
            {chart.toggle}
          </div>
          <div className="ov3-card-plot">
            {loading ? <Skeleton height="100%" label={label} /> : chart.plot}
          </div>
        </div>
      )}
      {details && state === 'ready' ? (
        <div className="ov3-card-details">
          {span === 'sheet' ? (
            <Disclosure summary={<span className="ov3-card-heading">{details.heading}</span>}>
              <DetailsBody details={details} table={chart.table} />
            </Disclosure>
          ) : (
            <>
              <h3 className="ov3-card-heading">{details.heading}</h3>
              <DetailsBody details={details} table={chart.table} />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CardEmpty({ title, line, action }: NonNullable<ChapterCardProps['empty']>) {
  return (
    <div className="ov3-card-empty">
      <EmptyState title={title} description={line} action={action} />
    </div>
  )
}

function DetailsBody({ details, table }: { details: ChapterCardDetails; table?: ChartTable }) {
  const { locale } = useOverview()
  const { columns, coverage, more, extra } = details
  return (
    <div className="ov3-card-details-body">
      {columns?.length ? (
        <dl className="ov3-card-columns">
          {columns.map(({ value, label }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {coverage ? <p className="ov3-card-coverage">{coverage}</p> : null}
      {extra}
      {table ? (
        <TableView
          table={table}
          summary={t({ en: `Table: ${table.caption}`, ru: `Таблица: ${table.caption}` }, locale)}
        />
      ) : null}
      {more?.map(({ summary, content }) => (
        <Disclosure key={summary} summary={<span className="ov3-card-more">{summary}</span>}>
          {content}
        </Disclosure>
      ))}
    </div>
  )
}
