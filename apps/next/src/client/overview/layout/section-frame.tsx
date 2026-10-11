'use client'

import { useId, type ReactNode, type PointerEventHandler, type Ref } from 'react'
import { GripVertical, MoreHorizontal } from '@keyline-icons/react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { Button } from '../../ui/button'
import { Menu, MenuItem } from '../../ui/menu'
import { useOverview } from '../store/overview-context'
import { t } from '../copy'
import './layout.css'

type Props = {
  id: SectionId
  title: string
  hint?: ReactNode
  controls?: ReactNode
  index: number
  count: number
  onMove: (id: SectionId, index: number) => void
  onHide: (id: SectionId) => void
  narrator: ReactNode
  children: ReactNode
  drag?: { ref: Ref<HTMLElement>; onPointerDown: PointerEventHandler<HTMLElement>; active: boolean }
}
export function SectionFrame({
  id,
  title,
  hint,
  controls,
  index,
  count,
  onMove,
  onHide,
  narrator,
  children,
  drag,
}: Props) {
  const { locale } = useOverview()
  const heading = useId()
  return (
    <section
      ref={drag?.ref}
      className="ov3-section ov3-frame"
      data-section={id}
      data-dragging={drag?.active || undefined}
      aria-labelledby={heading}
    >
      <header className="ov3-section-header" onPointerDown={drag?.onPointerDown}>
        <GripVertical className="ov3-grip" size={18} strokeWidth={2} aria-hidden="true" />
        <div className="ov3-section-title">
          <h2 id={heading}>{title}</h2>
          {hint ? <p>{hint}</p> : null}
        </div>
        {controls ? <div data-reorder-control>{controls}</div> : null}
        <Menu
          align="end"
          trigger={
            <Button
              variant="ghost"
              className="ov3-options"
              data-section-options={id}
              aria-label={t({ en: `${title} options`, ru: `Настройки: ${title}` }, locale)}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </Button>
          }
        >
          <MenuItem disabled={index === 0} onSelect={() => onMove(id, index - 1)}>
            {t({ en: 'Move up', ru: 'Выше' }, locale)}
          </MenuItem>
          <MenuItem disabled={index === count - 1} onSelect={() => onMove(id, index + 1)}>
            {t({ en: 'Move down', ru: 'Ниже' }, locale)}
          </MenuItem>
          <MenuItem onSelect={() => onHide(id)}>{t({ en: 'Hide', ru: 'Скрыть' }, locale)}</MenuItem>
        </Menu>
      </header>
      {children}
      {narrator ? <div className="ov3-section-narrator">{narrator}</div> : null}
    </section>
  )
}
