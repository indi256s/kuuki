'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Maximize } from '@keyline-icons/react'
import type { Locale } from '../../../lib/format'
import { BUCKET_LABELS, BUCKET_TOKENS } from '../../../lib/map-buckets'
import { Button } from '../../ui/button'
import { Dialog } from '../../ui/dialog'
import { S, t } from '../copy'
import './globe.css'

export type GlobeCardProps = {
  locale: Locale
  legendLabel: string
  /** The same globe component receives fullscreen to configure its future scroll zoom. */
  children: (mode: { fullscreen: boolean; active: boolean }) => ReactNode
  onFullscreenChange?: (open: boolean) => void
  topLeft?: ReactNode | ((fullscreen: boolean) => ReactNode)
  topRight?: ReactNode
  bottomLeft?: ReactNode
  bottomRight?: ReactNode
}

export function GlobeCard({
  locale,
  legendLabel,
  children,
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  onFullscreenChange,
}: GlobeCardProps) {
  const [open, setOpen] = useState(false)
  const changeOpen = (next: boolean) => {
    setOpen(next)
    onFullscreenChange?.(next)
  }
  const openerRef = useRef<HTMLButtonElement>(null)
  const fullscreenLabel = locale === 'ru' ? 'На весь экран' : 'Fullscreen'
  const title = locale === 'ru' ? 'Глобус' : 'Globe'
  const legend = bottomRight ?? (
    <div className="globe-legend">
      <span>{legendLabel}</span>
      <ul aria-label={legendLabel}>
        {BUCKET_LABELS[locale].map((label, index) => (
          <li key={label}>
            <span aria-hidden="true" style={{ background: `var(${BUCKET_TOKENS[index + 1]})` }} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
  const surface = (fullscreen: boolean, opener?: ReactNode) => {
    const filters = typeof topLeft === 'function' ? topLeft(fullscreen) : topLeft
    return (
      <div className={`globe-card${fullscreen ? ' globe-card-fullscreen' : ''}`}>
        <div className="globe-card-content">
          {children({ fullscreen, active: fullscreen || !open })}
        </div>
        {filters && (
          <div
            onPointerDown={(event) => event.stopPropagation()}
            className="globe-corner globe-top-left"
          >
            {filters}
          </div>
        )}
        <div
          onPointerDown={(event) => event.stopPropagation()}
          className="globe-corner globe-top-right"
        >
          {topRight}
          {opener}
        </div>
        <div className="globe-bottom">
          {bottomLeft && (
            <div onPointerDown={(event) => event.stopPropagation()} className="globe-bottom-left">
              {bottomLeft}
            </div>
          )}
          <div onPointerDown={(event) => event.stopPropagation()} className="globe-bottom-right">
            {legend}
          </div>
        </div>
      </div>
    )
  }
  return (
    <>
      {surface(
        false,
        <Button
          ref={openerRef}
          className="globe-fullscreen"
          aria-label={fullscreenLabel}
          onClick={() => changeOpen(true)}
        >
          <Maximize size={16} strokeWidth={2} aria-hidden="true" />
          <span className="globe-fullscreen-label">{fullscreenLabel}</span>
        </Button>,
      )}
      <Dialog
        open={open}
        onOpenChange={changeOpen}
        title={title}
        closeLabel={t(S.close, locale)}
        className="globe-dialog"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          openerRef.current?.focus()
        }}
      >
        {surface(true)}
      </Dialog>
    </>
  )
}
