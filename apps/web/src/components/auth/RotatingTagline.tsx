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

  useEffect(() => {
    const timer = setInterval(() => {
      // Quick exit to the left
      setPhase('exit')
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length)
        setPhase('enter')
        // Snap to visible
        setTimeout(() => setPhase('visible'), 50)
      }, 200)
    }, interval)

    return () => clearInterval(timer)
  }, [items.length, interval])

  return (
    <div className="space-y-2.5">
      {/* Rotating text - horizontal slide synced with progress */}
      <div className="relative h-5 overflow-hidden w-full">
        <p
          className={cn(
            "absolute inset-0 flex items-center transition-all ease-out whitespace-nowrap",
            className,
            phase === 'visible' && "translate-x-0 opacity-100 duration-200",
            phase === 'exit' && "-translate-x-8 opacity-0 duration-150",
            phase === 'enter' && "translate-x-4 opacity-0 duration-0"
          )}
        >
          {items[currentIndex]}
        </p>
      </div>

      {/* Progress bar indicator */}
      <div className="flex gap-1">
        {items.map((_, i) => (
          <div
            key={i}
            className="h-0.5 rounded-full overflow-hidden flex-1 max-w-8 bg-neutral-200 dark:bg-white/10"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                i === currentIndex
                  ? "bg-primary/70 w-full"
                  : i < currentIndex
                    ? "bg-primary/30 w-full"
                    : "bg-transparent w-0"
              )}
              style={i === currentIndex ? {
                animation: `progress-fill ${interval}ms linear`
              } : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
