'use client'

import type { CSSProperties } from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { ChevronLeft, ChevronRight, MoreHorizontal, X } from 'lucide-react'
import { isEmptyFilter } from '@kuuki/shared/overview/filter'
import { Sheet } from '../../ui/sheet'
import { Button } from '../../ui/button'
import { Menu, MenuItem } from '../../ui/menu'
import { SECTIONS } from '../sections/registry'
import { Narrator } from '../narrator/narrator'
import { useOverview } from '../store/overview-context'
import { formatNumber } from '../../../lib/format'
import { t } from '../copy'
import { referenceLabels } from '../labels'
import { scopeTitle } from '../page/scope-title'
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
  const { locale, scope, filter, actions, isCurrent } = useOverview()
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
          {entry && openId ? (
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
          ) : null}
        </span>
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
          {/* A filter picked inside a chapter changes every chapter; the sheet covers the page's filter bar, so it says so here and can undo it. */}
          <div className="ov3-sheet-scope" role="status">
            {isEmptyFilter(filter) ? null : (
              <>
                <span className="ov3-sheet-scope-label">
                  {t({ en: 'Filtered', ru: 'Фильтр' }, locale)}
                  <b>{scopeTitle(filter, referenceLabels(locale), locale).slice(3)}</b>
                </span>
                <Button
                  variant="ghost"
                  className="ov3-sheet-scope-clear"
                  onClick={() => {
                    if (isCurrent()) actions.clear()
                  }}
                >
                  <X size={16} aria-hidden="true" />
                  {t({ en: 'Show all', ru: 'Показать все' }, locale)}
                </Button>
              </>
            )}
          </div>
          {/* Every chapter is a snap slide; only the open one and its neighbours render content, the rest keep their width. */}
          <div ref={track} className="ov3-sheet-track">
            {order.map((id, at) => {
              const { Section, gate } = SECTIONS[id]
              return (
                <div key={id} className="ov3-sheet-slide" inert={id !== openId}>
                  {Math.abs(at - index) <= 1 || id === openId ? (
                    <>
                      <Section span="sheet" />
                      {scope && gate(scope)?.status !== 'below' ? <Narrator slot={id} /> : null}
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
