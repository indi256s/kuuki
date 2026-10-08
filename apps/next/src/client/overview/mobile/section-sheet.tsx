'use client'

import type { SectionId } from '@kuuki/shared/overview/prefs'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Sheet } from '../../ui/sheet'
import { Button } from '../../ui/button'
import { Menu, MenuItem } from '../../ui/menu'
import { SECTIONS } from '../sections/registry'
import { Narrator } from '../narrator/narrator'
import { useOverview } from '../store/overview-context'
import { formatNumber } from '../../../lib/format'
import { t } from '../copy'
import './mobile.css'

type Props = {
  openId: SectionId | null; order: SectionId[]; onNavigate: (id: SectionId) => void; onClose: () => void
  onMove: (id: SectionId, index: number) => void; onHide: (id: SectionId) => void
  onCloseAutoFocus: (event: Event) => void
}
export function SectionSheet({ openId, order, onNavigate, onClose, onMove, onHide, onCloseAutoFocus }: Props) {
  const { locale } = useOverview()
  const index = openId ? order.indexOf(openId) : -1
  const entry = openId && index >= 0 ? SECTIONS[openId] : null
  const title = entry ? t(entry.title, locale) : ''
  const previous = order[index - 1], next = order[index + 1]
  const position = formatNumber(locale, index + 1), count = formatNumber(locale, order.length)
  const label = (id: SectionId | undefined, direction: 'previous' | 'next') => t(direction === 'previous'
    ? { en: `Previous${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`, ru: `Предыдущий${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}` }
    : { en: `Next${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}`, ru: `Следующий${id ? `: ${t(SECTIONS[id].title, locale)}` : ''}` }, locale)
  return <Sheet open={!!entry} onOpenChange={open => { if (!open) onClose() }} className="ov3-section-sheet"
    onCloseAutoFocus={onCloseAutoFocus} closeLabel={t({ en: 'Close', ru: 'Закрыть' }, locale)}
    title={<span className="ov3-sheet-heading"><span>{title}</span><span className="ov3-sheet-position">{t({ en: `${position} of ${count}`, ru: `${position} из ${count}` }, locale)}</span>
      {entry && openId ? <Menu align="end" trigger={<Button variant="ghost" dense aria-label={t({ en: `${title} options`, ru: `Настройки: ${title}` }, locale)}><MoreHorizontal size={18} aria-hidden="true" /></Button>}>
        <MenuItem disabled={index === 0} onSelect={() => onMove(openId, index - 1)}>{t({ en: 'Move up', ru: 'Выше' }, locale)}</MenuItem>
        <MenuItem disabled={index === order.length - 1} onSelect={() => onMove(openId, index + 1)}>{t({ en: 'Move down', ru: 'Ниже' }, locale)}</MenuItem>
        <MenuItem onSelect={() => onHide(openId)}>{t({ en: 'Hide', ru: 'Скрыть' }, locale)}</MenuItem>
      </Menu> : null}</span>}
    footer={entry ? <div className="ov3-sheet-navigation">
      <Button variant="ghost" disabled={!previous} onClick={() => previous && onNavigate(previous)} aria-label={label(previous, 'previous')}><ChevronLeft size={18} aria-hidden="true" />{previous ? t(SECTIONS[previous].title, locale) : t({ en: 'Previous', ru: 'Предыдущий' }, locale)}</Button>
      <Button variant="ghost" disabled={!next} onClick={() => next && onNavigate(next)} aria-label={label(next, 'next')}>{next ? t(SECTIONS[next].title, locale) : t({ en: 'Next', ru: 'Следующий' }, locale)}<ChevronRight size={18} aria-hidden="true" /></Button>
    </div> : null}>
    {entry && openId ? <><div className="ov3-sheet-pager" aria-hidden="true">{order.map(id => <span key={id} data-active={id === openId} />)}</div><entry.Section span="sheet" /><Narrator slot={openId} /></> : null}
  </Sheet>
}
