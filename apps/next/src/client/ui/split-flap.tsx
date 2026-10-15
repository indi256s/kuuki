import { useState } from 'react'
import './split-flap.css'

// Split-flap text: one flipping tile per character. Used by Journal "Next up" for the day count; sizes and colours come from --split-flap-* properties on the caller's class.

/** One tile. It flips in when `entering`, then only when its character changes after mount (e.g. a day change seen while open). */
function Flap({
  digit,
  index,
  entering,
  delay,
}: {
  digit: string
  index: number
  entering: boolean
  delay: number
}) {
  const [shown, setShown] = useState(digit)
  const [flips, setFlips] = useState(entering ? 1 : 0)
  if (shown !== digit) {
    setShown(digit)
    setFlips(flips + 1)
  }
  return (
    <span className="split-flap-cell">
      <span
        key={flips}
        className="split-flap-digit"
        data-flip={flips > 0 || undefined}
        style={{ animationDelay: `${delay + index * 40}ms` }}
      >
        {digit}
      </span>
    </span>
  )
}

/** Screen readers get `label` (default `value`) once; the tiles are hidden. Keyed from the aligned end so 9 → 10 keeps the ones digit. */
export function SplitFlap({
  value,
  entering,
  delay = 0,
  label,
  className,
}: {
  value: string
  entering: boolean
  /** Milliseconds added to every digit's flip delay. */
  delay?: number
  label?: string
  className?: string
}) {
  return (
    <span className={className ? `split-flap ${className}` : 'split-flap'}>
      <span className="sr-only">{label ?? value}</span>
      <span className="split-flap-row" aria-hidden="true">
        {[...value].map((digit, index, all) => (
          <Flap
            key={all.length - index}
            digit={digit}
            index={index}
            entering={entering}
            delay={delay}
          />
        ))}
      </span>
    </span>
  )
}
