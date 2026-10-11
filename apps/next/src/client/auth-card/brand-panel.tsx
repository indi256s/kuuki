import type { ReactNode } from 'react'
import { Wordmark } from './wordmark'
import './auth-card.css'

/**
 * The card's brand side: the left panel on desktop, the band above the sheet on mobile.
 * `field` is the decorative layer behind the wordmark (the turning Concorde and the くうき watermark); it is hidden from
 * assistive tech and never takes pointer input.
 */
export function BrandPanel({ field }: { field?: ReactNode }) {
  return (
    <div className="auth-brand">
      {field ? (
        <div className="auth-brand-field" aria-hidden="true">
          {field}
        </div>
      ) : null}
      <Wordmark className="auth-brand-wordmark" />
    </div>
  )
}
