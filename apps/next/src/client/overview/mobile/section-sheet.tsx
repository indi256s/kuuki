'use client'

import { useRef, useState, type CSSProperties } from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { ChevronLeft, ChevronRight, MoreHorizontal, SlidersHorizontal } from '@keyline-icons/react'
import { Sheet } from '../../ui/sheet'
import { Button } from '../../ui/button'
import { Chip } from '../../ui/chip'
import { Menu, MenuItem } from '../../ui/menu'
import { SECTIONS } from '../sections/registry'
import { Narrator } from '../narrator/narrator'
import { useOverview } from '../store/overview-context'
import { formatNumber } from '../../../lib/format'
import { t } from '../copy'
import type { FilterFacet } from '../filters/chip-label'
import { useAppliedFacets } from '../filters/use-applied-facets'
import { FilterPanel } from '../filters/filter-panel'
import { ChapterContext, SHEET_ACTIVE, SHEET_IDLE } from '../layout/chapter-context'
import { useChapterTrack } from './chapter-motion'
import './mobile.css'

type Props = {
  openId: SectionId | null
  order: SectionId[]
  onNavigate: (id: SectionId) => void
  onClose: () => void
  onMove: (id: SectionId, index: number) => void
  onHide: (id: SectionId) => void
  onCloseAutoFocus: (event: Event) => void
}
export function SectionSheet({
  openId,
  order,
  onNavigate,
  onClose,
  onMove,
  onHide,
  onCloseAutoFocus,
}: Props) {
  const { locale, scope } = useOverview()
  const { track, heading, previousLabel, nextLabel, shown, go } = useChapterTrack({
    openId,
    order,
    onNavigate,
  })
  // Heading, labels and pager follow the chapter a release would land on; the menu acts on the open one.
  const index = shown ? order.indexOf(shown) : -1
  const entry = openId && shown && index >= 0 ? SECTIONS[shown] : null
  const openIndex = openId ? order.indexOf(openId) : -1
  const title = entry ? t(entry.title, locale) : ''
  const previous = order[index - 1],
    next = order[index + 1]
  const position = formatNumber(locale, index + 1),
    count = formatNumber(locale, order.length)
  const label = (id: SectionId | undefined, direction: 'previous' | 'next') =>
    t(
      direction === 'previous'
        ? {
            en: `Previous${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`,
            ru: `Предыдущий${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`,
          }
        : {
            en: `Next${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`,
            ru: `Следующий${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`,
          },
      locale,
    )
  return (
    <Sheet
      open={!!entry}
      initialDetent={1}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className="ov3-section-sheet"
      onCloseAutoFocus={onCloseAutoFocus}
      closeLabel={t({ en: 'Close', ru: 'Закрыть' }, locale)}
      title={
        <span className="ov3-sheet-heading">
          <span ref={heading} className="ov3-sheet-title">
            <span className="ov3-sheet-name">{title}</span>
            <span className="ov3-sheet-position">
              {t({ en: `${position} of ${count}`, ru: `${position} из ${count}` }, locale)}
            </span>
          </span>
        </span>
      }
      titleAction={
        entry && openId ? (
          <Menu
            align="end"
            trigger={
              <Button
                variant="ghost"
                className="ov3-options"
                aria-label={t({ en: `${title} options`, ru: `Настройки: ${title}` }, locale)}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </Button>
            }
          >
            <MenuItem disabled={openIndex === 0} onSelect={() => onMove(openId, openIndex - 1)}>
              {t({ en: 'Move up', ru: 'Выше' }, locale)}
            </MenuItem>
            <MenuItem
              disabled={openIndex === order.length - 1}
              onSelect={() => onMove(openId, openIndex + 1)}
            >
              {t({ en: 'Move down', ru: 'Ниже' }, locale)}
            </MenuItem>
            <MenuItem onSelect={() => onHide(openId)}>
              {t({ en: 'Hide', ru: 'Скрыть' }, locale)}
            </MenuItem>
          </Menu>
        ) : null
      }
      footer={
        entry ? (
          <div className="ov3-sheet-navigation">
            <Button
              variant="ghost"
              disabled={!previous}
              onClick={(event) => go(-1, { keyboard: event.detail === 0 })}
              aria-label={label(previous, 'previous')}
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span ref={previousLabel} className="ov3-sheet-nav-label">
                {previous
                  ? t(SECTIONS[previous].title, locale)
                  : t({ en: 'Previous', ru: 'Предыдущий' }, locale)}
              </span>
            </Button>
            <Button
              variant="ghost"
              disabled={!next}
              onClick={(event) => go(1, { keyboard: event.detail === 0 })}
              aria-label={label(next, 'next')}
            >
              <span ref={nextLabel} className="ov3-sheet-nav-label">
                {next
                  ? t(SECTIONS[next].title, locale)
                  : t({ en: 'Next', ru: 'Следующий' }, locale)}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </div>
        ) : null
      }
    >
      {entry && openId ? (
        <>
          <div
            className="ov3-sheet-pager"
            aria-hidden="true"
            style={{ '--count': order.length } as CSSProperties}
          >
            {order.map((id) => (
              <span key={id} />
            ))}
            <i
              className="ov3-sheet-pager-indicator"
              style={{ transform: `translateX(calc(${index} * (100% + 4px)))` }}
            />
          </div>
          <SheetFilterRow />
          {/* Every chapter is a snap slide; only the open one and its neighbours render content, the rest keep their width. */}
          <div ref={track} className="ov3-sheet-track">
            {order.map((id, at) => {
              const { Section } = SECTIONS[id]
              return (
                <div key={id} className="ov3-sheet-slide" inert={id !== openId}>
                  {Math.abs(at - index) <= 1 || id === openId ? (
                    <>
                      <ChapterContext.Provider value={id === openId ? SHEET_ACTIVE : SHEET_IDLE}>
                        <Section span="sheet" />
                        {scope ? <Narrator slot={id} /> : null}
                      </ChapterContext.Provider>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </Sheet>
  )
}

/**
 * The filter row in the sheet's chrome: always 44px, so a filter turning on moves nothing. Scope is global, so it does not follow the
 * slides. Unfiltered it is one "All flights" chip that opens the picker; filtered it lists the applied facets as the page's filter bar
 * does. Facets that do not fit scroll sideways (the bar collapses them into "+N"; a 44px row has no second line to measure).
 */
function SheetFilterRow() {
  const { locale, isCurrent } = useOverview()
  const facets = useAppliedFacets()
  const row = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState<{ anchor: HTMLElement; facet?: FilterFacet } | null>(null)
  const open = (anchor: HTMLElement | null | undefined, facet?: FilterFacet) => {
    if (anchor && isCurrent()) setPanel({ anchor, facet })
  }
  return (
    <>
      <div
        ref={row}
        className="ov3-sheet-filters"
        role="group"
        aria-label={t({ en: 'Overview filters', ru: 'Фильтры обзора' }, locale)}
      >
        {facets.length ? (
          facets.map(({ facet, label, swatch, removeLabel, remove }) => (
            <span key={facet} data-filter-chip={facet}>
              <Chip
                label={label}
                swatch={swatch}
                onOpen={() =>
                  open(
                    row.current?.querySelector<HTMLElement>(
                      `[data-filter-chip="${facet}"] .ui-chip-body`,
                    ),
                    facet,
                  )
                }
                onRemove={remove}
                removeLabel={removeLabel}
              />
            </span>
          ))
        ) : (
          <span className="ui-chip">
            <button
              type="button"
              className="ui-chip-body"
              onClick={(event) => open(event.currentTarget)}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span className="ui-chip-label">
                {t({ en: 'All flights', ru: 'Все перелёты' }, locale)}
              </span>
            </button>
          </span>
        )}
      </div>
      {panel ? (
        <FilterPanel
          key={panel.facet ?? 'all'}
          anchor={panel.anchor}
          initialFacet={panel.facet}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </>
  )
}
