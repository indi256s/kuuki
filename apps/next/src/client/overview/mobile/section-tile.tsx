'use client'

import { useId, type MouseEventHandler, type PointerEventHandler, type ReactNode, type Ref } from 'react'
import { ChevronRight } from 'lucide-react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { SECTIONS } from '../sections/registry'
import { useOverview } from '../store/overview-context'
import { t } from '../copy'
import './mobile.css'

type Props = {
  id: SectionId; span: 'half' | 'full'; onOpen: (id: SectionId, opener: HTMLButtonElement) => void; children: ReactNode
  drag: { ref: Ref<HTMLButtonElement>; onPointerDown: PointerEventHandler<HTMLElement>; onClickCapture: MouseEventHandler<HTMLElement>; active: boolean }
}
export function SectionTile({ id, span, onOpen, children, drag: { ref, onPointerDown, onClickCapture, active } }: Props) {
  const { locale } = useOverview()
  const title = t(SECTIONS[id].title, locale)
  // The name stays the short title; the preview the tile shows ("14,535 km · Longest · DOH → AKL") is its description.
  const preview = useId()
  return <button ref={ref} type="button" className="ov3-section ov3-tile" data-section={id} data-section-tile={id}
    data-tile-span={span} data-dragging={active || undefined} aria-label={title} aria-describedby={preview}
    onPointerDown={event => { if (event.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches) onPointerDown?.(event) }}
    onClickCapture={onClickCapture} onClick={event => onOpen(id, event.currentTarget)}>
    <span className="ov3-tile-heading"><h2>{title}</h2><ChevronRight size={18} aria-hidden="true" /></span>
    <span id={preview} className="ov3-tile-preview">{children}</span>
  </button>
}
