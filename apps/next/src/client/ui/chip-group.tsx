'use client'

import { X } from '@keyline-icons/react'
import type { ReactElement, ReactNode } from 'react'
import type { Locale } from '../../lib/format'
import './ui.css'
import './filter-toolbar.css'

export function summarizeValues(
  values: readonly string[],
  max = 2,
): { shown: string[]; more: number } {
  return { shown: values.slice(0, max), more: Math.max(0, values.length - max) }
}

const more = {
  en: (count: number) => `, and ${count} more`,
  ru: (count: number) => `, ещё ${count}`,
}

export type FacetChipProps = {
  facet: string
  values: readonly string[]
  onRemove: () => void
  removeLabel: string
  onOpen?: () => void
  maxValues?: number
  locale?: Locale
  children?: ReactNode | ((body: ReactElement) => ReactNode)
}

export function FacetChip({
  facet,
  values,
  onRemove,
  removeLabel,
  onOpen,
  maxValues = 2,
  locale = 'en',
  children,
}: FacetChipProps) {
  const { shown, more: rest } = summarizeValues(values, maxValues)
  const body = (
    <button type="button" className="ui-chip-body" onClick={onOpen}>
      <span className="ui-chip-label">
        <span className="ui-facet-name">{facet}</span>
        {shown.length ? (
          <>
            {' '}
            <span className="ui-facet-values">
              {shown.join(', ')}
              {rest ? (
                <>
                  <span aria-hidden="true"> +{rest}</span>
                  <span className="sr-only">{more[locale](rest)}</span>
                </>
              ) : null}
            </span>
          </>
        ) : null}
      </span>
    </button>
  )
  const picker = typeof children === 'function' ? children(body) : null
  return (
    <>
      <span className="ui-chip">
        {picker ?? body}
        <button
          type="button"
          className="ui-chip-remove"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </span>
      {typeof children === 'function' ? null : children}
    </>
  )
}

export function ChipGroup({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={`ui-chip-group ${className}`.trim()}>
      {children}
    </div>
  )
}
