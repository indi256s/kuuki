'use client'

import { X } from '@keyline-icons/react'
import type { ReactElement, ReactNode } from 'react'
import type { Locale } from '../../lib/format'
import './ui.css'
import './filter-toolbar.css'

// Adapted from Arc "chip-group" (uiarc.dev, MIT, see ARC-LICENSE.txt): the wrapping chip row and its group semantics.
// Dropped: the selectable toggle chips, the "+N more" fold, arrow-key roving, the spring/width morph and the `motion` package.
// Added: FacetChip, a filter chip that names its facet, shows up to two values then "+N", opens its picker and can be removed.
// It reuses the `ui-chip` look from ui.css (the same classes as chip.tsx) because it must hand its body button to a picker as the trigger.

/** First `max` values for display and how many were left out. */
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
  /** Facet name, for example "Airline". */
  facet: string
  /** Selected value labels, in display order. */
  values: readonly string[]
  onRemove: () => void
  /** Accessible name of the remove button, for example "Remove Airline filter". */
  removeLabel: string
  /** Called when the chip body is pressed. Not needed when `children` is a render prop that owns the trigger. */
  onOpen?: () => void
  /** Values shown before "+N". */
  maxValues?: number
  locale?: Locale
  /**
   * The picker. A function receives the chip body button and returns the picker wrapped around it as its trigger
   * (a `MultiSelect` takes it as `trigger`). Plain nodes render after the chip, for a picker opened through `onOpen`.
   */
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

/** A wrapping row of chips with a group name. */
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
