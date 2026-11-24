import { useState } from 'react'
import './split-flap.css'

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

export function SplitFlap({
  value,
  entering,
  delay = 0,
  label,
  className,
}: {
  value: string
  entering: boolean
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
