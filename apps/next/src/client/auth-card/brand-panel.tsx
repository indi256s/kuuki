import type { ReactNode } from 'react'
import { Wordmark } from './wordmark'
import './auth-card.css'

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
