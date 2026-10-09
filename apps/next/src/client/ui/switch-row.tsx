'use client'

import { useId, type ReactNode } from 'react'
import './ui.css'

export type SwitchRowProps = {
  label: ReactNode
  description?: ReactNode
  /** What the current state means in plain words, shown as visible text (e.g. «Другие видят ваш профиль»). */
  consequence?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Visible explanation shown when disabled. */
  disabledReason?: ReactNode
}

export function SwitchRow({
  label,
  description,
  consequence,
  checked,
  onCheckedChange,
  disabled,
  disabledReason,
}: SwitchRowProps) {
  const id = useId()
  const blocked = Boolean(disabled || disabledReason)
  const describedBy =
    [
      description ? `${id}-d` : null,
      consequence ? `${id}-c` : null,
      blocked && disabledReason ? `${id}-r` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined
  return (
    <div className="ui-switch-row">
      <div className="ui-switch-text">
        <span id={`${id}-l`} className="ui-switch-label">
          {label}
        </span>
        {description ? (
          <p id={`${id}-d`} className="ui-switch-description">
            {description}
          </p>
        ) : null}
        {consequence ? (
          <p id={`${id}-c`} className="ui-switch-consequence">
            {consequence}
          </p>
        ) : null}
        {blocked && disabledReason ? (
          <p id={`${id}-r`} className="ui-switch-reason">
            {disabledReason}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        className="ui-switch"
        aria-checked={checked}
        aria-disabled={blocked ? true : undefined}
        aria-labelledby={`${id}-l`}
        aria-describedby={describedBy}
        onClick={() => {
          if (!blocked) onCheckedChange(!checked)
        }}
      >
        <span className="ui-switch-track" aria-hidden="true">
          <span className="ui-switch-knob" />
        </span>
      </button>
    </div>
  )
}
