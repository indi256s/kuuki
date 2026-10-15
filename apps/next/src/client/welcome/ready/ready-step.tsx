'use client'

import { ArrowRight } from '@keyline-icons/react'
import { useMemo, useState } from 'react'
import { pickWelcomeLine, statsLine } from '../../overview/narrator/welcome'
import { Button } from '../../ui/button'
import type { SavedSummary, StepProps } from '../types'
import { COPY } from './copy'
import './ready.css'

export function ReadyStep({
  locale,
  ownerId,
  headingRef,
  summary,
  onOpen,
}: StepProps & {
  summary: SavedSummary
  /** "Open my journal": records onboarding as done, then dissolves. Rejects when recording fails. */
  onOpen: () => Promise<void>
}) {
  const t = (entry: { en: string; ru: string }) => entry[locale]
  const [phase, setPhase] = useState<'idle' | 'opening' | 'failed'>('idle')
  const line = useMemo(
    () => pickWelcomeLine({ flights: summary.flights, seed: ownerId, locale }),
    [summary.flights, ownerId, locale],
  )
  const stats = useMemo(
    () => statsLine({ flights: summary.flights, leftOut: summary.leftOut, locale }),
    [summary.flights, summary.leftOut, locale],
  )

  const open = async () => {
    setPhase('opening')
    try {
      await onOpen()
    } catch {
      setPhase('failed')
    }
  }

  return (
    <div className="ready-step">
      <div className="ready-text">
        <p className="ready-eyebrow">{t(COPY.eyebrow)}</p>
        <h1 ref={headingRef} tabIndex={-1} className="ready-line">
          {line}
        </h1>
        <p className="ready-stats">{stats}</p>
      </div>
      <div className="ready-actions">
        {phase === 'failed' ? (
          <p className="ready-error" role="alert">
            {t(COPY.openFailed)}
          </p>
        ) : null}
        <Button
          variant="primary"
          className="auth-primary"
          loading={phase === 'opening'}
          loadingLabel={t(COPY.opening)}
          onClick={() => void open()}
        >
          {t(COPY.open)}
          <ArrowRight className="ready-arrow-icon" size={16} strokeWidth={2} aria-hidden="true" />
          <span className="ready-arrow-glyph" aria-hidden="true">
            {' →'}
          </span>
        </Button>
        {/* Mobile only: on desktop the passport's own caption says it under the spread. */}
        <p className="ready-caption">{t(COPY.caption)}</p>
      </div>
    </div>
  )
}
