'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Maximize } from 'lucide-react'
import type { Locale } from '../../../lib/format'
import { BUCKET_LABELS, BUCKET_TOKENS } from '../../../lib/map-buckets'
import { Button } from '../../ui/button'
import { Dialog } from '../../ui/dialog'
import { S, t } from '../copy'
import './globe.css'

export type GlobeCardProps = {
  locale: Locale
  /** The same globe component receives fullscreen to configure its future scroll zoom. */
  children: (mode: { fullscreen: boolean }) => ReactNode
  topLeft?: ReactNode
  topRight?: ReactNode
  bottomLeft?: ReactNode
  bottomRight?: ReactNode
}

export function GlobeCard({ locale, children, topLeft, topRight, bottomLeft, bottomRight }: GlobeCardProps) {
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const fullscreenLabel = locale === 'ru' ? 'На весь экран' : 'Fullscreen'
  const title = locale === 'ru' ? 'Глобус' : 'Globe'
  const legend = bottomRight ?? <div className="globe-legend">
    <span>{t(S.legend, locale)}</span>
    <ul aria-label={t(S.legend, locale)}>{BUCKET_LABELS[locale].map((label, index) => <li key={label}>
      <span aria-hidden="true" style={{ background: `var(${BUCKET_TOKENS[index + 1]})` }} />{label}
    </li>)}</ul>
  </div>
  const surface = (fullscreen: boolean, opener?: ReactNode) => <div className={`globe-card${fullscreen ? ' globe-card-fullscreen' : ''}`}>
    <div className="globe-card-content">{children({ fullscreen })}</div>
    {topLeft && <div className="globe-corner globe-top-left">{topLeft}</div>}
    <div className="globe-corner globe-top-right">{topRight}{opener}</div>
    {bottomLeft && <div className="globe-corner globe-bottom-left">{bottomLeft}</div>}
    <div className="globe-corner globe-bottom-right">{legend}</div>
  </div>
  return <>
    {surface(false, <Button ref={openerRef} dense aria-label={fullscreenLabel} onClick={() => setOpen(true)}><Maximize size={16} strokeWidth={2} aria-hidden="true" /><span>{fullscreenLabel}</span></Button>)}
    <Dialog open={open} onOpenChange={setOpen} title={title} closeLabel={t(S.close, locale)} className="globe-dialog"
      onCloseAutoFocus={event => { event.preventDefault(); openerRef.current?.focus() }}>
      {surface(true)}
    </Dialog>
  </>
}
