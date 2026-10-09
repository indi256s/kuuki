'use client'

import type { SectionId } from '@kuuki/shared/overview/prefs'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Sheet } from '../../ui/sheet'
import { Button } from '../../ui/button'
import { Menu, MenuItem } from '../../ui/menu'
import { FeedbackText } from '../../ui/feedback-text'
import { SECTIONS } from '../sections/registry'
import { Narrator } from '../narrator/narrator'
import { useOverview } from '../store/overview-context'
import { formatNumber } from '../../../lib/format'
import { t } from '../copy'
import { useChapterMotion } from './chapter-motion'
import './mobile.css'

type Props = {
  openId: SectionId | null; order: SectionId[]; onNavigate: (id: SectionId) => void; onClose: () => void
  onMove: (id: SectionId, index: number) => void; onHide: (id: SectionId) => void
  onCloseAutoFocus: (event: Event) => void
}
export function SectionSheet({ openId, order, onNavigate, onClose, onMove, onHide, onCloseAutoFocus }: Props) {
  const { locale, scope } = useOverview()
  const { stage, go, swipe, instant } = useChapterMotion({ openId, order, onNavigate })
  const index = openId ? order.indexOf(openId) : -1
  const entry = openId && index >= 0 ? SECTIONS[openId] : null
  const title = entry ? t(entry.title, locale) : ''
  const previous = order[index - 1], next = order[index + 1]
  const position = formatNumber(locale, index + 1), count = formatNumber(locale, order.length)
  // Closing empties the heading; that must not morph out, and keyboard changes swap instantly.
  const still = instant || !entry
  const label = (id: SectionId | undefined, direction: 'previous' | 'next') => t(direction === 'previous'
    ? { en: `Previous${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`, ru: `Предыдущий${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}` }
    : { en: `Next${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`, ru: `Следующий${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}` }, locale)
  return <Sheet open={!!entry} onOpenChange={open => { if (!open) onClose() }} className="ov3-section-sheet"
    onCloseAutoFocus={onCloseAutoFocus} closeLabel={t({ en: 'Close', ru: 'Закрыть' }, locale)}
    title={<span className="ov3-sheet-heading"><span className="ov3-sheet-name"><FeedbackText locale={locale} disabled={still}>{title}</FeedbackText></span><span className="ov3-sheet-position"><FeedbackText locale={locale} disabled={still}>{t({ en: `${position} of ${count}`, ru: `${position} из ${count}` }, locale)}</FeedbackText></span>
      {entry && openId ? <Menu align="end" trigger={<Button variant="ghost" className="ov3-options" aria-label={t({ en: `${title} options`, ru: `Настройки: ${title}` }, locale)}><MoreHorizontal size={18} aria-hidden="true" /></Button>}>
        <MenuItem disabled={index === 0} onSelect={() => onMove(openId, index - 1)}>{t({ en: 'Move up', ru: 'Выше' }, locale)}</MenuItem>
        <MenuItem disabled={index === order.length - 1} onSelect={() => onMove(openId, index + 1)}>{t({ en: 'Move down', ru: 'Ниже' }, locale)}</MenuItem>
        <MenuItem onSelect={() => onHide(openId)}>{t({ en: 'Hide', ru: 'Скрыть' }, locale)}</MenuItem>
      </Menu> : null}</span>}
    footer={entry ? <div className="ov3-sheet-navigation">
      <Button variant="ghost" disabled={!previous} onClick={event => go(-1, { keyboard: event.detail === 0 })} aria-label={label(previous, 'previous')}><ChevronLeft size={18} aria-hidden="true" /><span className="ov3-sheet-nav-label"><FeedbackText locale={locale} fast disabled={still}>{previous ? t(SECTIONS[previous].title, locale) : t({ en: 'Previous', ru: 'Предыдущий' }, locale)}</FeedbackText></span></Button>
      <Button variant="ghost" disabled={!next} onClick={event => go(1, { keyboard: event.detail === 0 })} aria-label={label(next, 'next')}><span className="ov3-sheet-nav-label"><FeedbackText locale={locale} fast disabled={still}>{next ? t(SECTIONS[next].title, locale) : t({ en: 'Next', ru: 'Следующий' }, locale)}</FeedbackText></span><ChevronRight size={18} aria-hidden="true" /></Button>
    </div> : null}>
    {entry && openId ? <><div className="ov3-sheet-pager" aria-hidden="true">{order.map(id => <span key={id} data-active={id === openId} />)}</div><div key={openId} ref={stage} className="ov3-sheet-stage" {...swipe}><entry.Section span="sheet" />{scope && entry.gate(scope)?.status !== 'below' ? <Narrator slot={openId} /> : null}</div></> : null}
  </Sheet>
}
