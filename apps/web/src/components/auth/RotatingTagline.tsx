import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface RotatingTaglineProps {
  items: string[]
  interval?: number
  className?: string
}

export function RotatingTagline({ items, interval = 6000, className }: RotatingTaglineProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<'visible' | 'exit' | 'enter'>('visible')

  // Each tick: exit (200ms), swap text and jump below, then slide back into view 50ms later.
  useEffect(() => {
    let swap: ReturnType<typeof setTimeout> | undefined
    let reveal: ReturnType<typeof setTimeout> | undefined
    const tick = setInterval(() => {
      setPhase('exit')
      swap = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length)
        setPhase('enter')
      }, 200)
      reveal = setTimeout(() => setPhase('visible'), 250)
    }, interval)

    return () => {
      clearInterval(tick)
      clearTimeout(swap)
      clearTimeout(reveal)
    }
  }, [interval, items.length])

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Rotating text - horizontal slide synced with progress */}
      <div className="relative min-h-[3rem] flex items-center justify-center w-full">
        <p
          className={cn(
            "text-center transition-all cursor-default select-none",
            // Linear-style snappy but smooth easing
            "[transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]",
            className,
            phase === 'visible' && "translate-y-0 opacity-100 blur-0 duration-500",
            phase === 'exit' && "-translate-y-2 opacity-0 blur-sm duration-200",
            phase === 'enter' && "translate-y-2 opacity-0 blur-sm duration-0"
          )}
        >
          {items[currentIndex]}
        </p>
      </div>
    </div>
  )
}
