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
    <div className="flex flex-col items-center gap-3">
      {/* Rotating text - horizontal slide synced with progress */}
      <div className="relative min-h-[3rem] flex items-center justify-center w-full">
        <p
          className={cn(
            "text-center transition-all ease-out",
            className,
            phase === 'visible' && "translate-x-0 opacity-100 duration-200",
            phase === 'exit' && "-translate-x-8 opacity-0 duration-150",
            phase === 'enter' && "translate-x-4 opacity-0 duration-0"
          )}
        >
          {items[currentIndex]}
        </p>
      </div>

      {/* Progress indicator - refined dots with glow */}
      <div className="flex items-center justify-center gap-2">
        {items.map((_, i) => {
          const isActive = i === currentIndex
          const isPast = i < currentIndex

          return (
            <div
              key={i}
              className="relative"
            >
              {/* Glow layer for active dot */}
              {isActive && (
                <div
                  className="absolute inset-0 rounded-full bg-primary/40 blur-sm scale-150"
                  style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
                />
              )}

              {/* Dot */}
              <div
                className={cn(
                  "relative w-1.5 h-1.5 rounded-full transition-all duration-300",
                  // Snappy cubic-bezier for that "Linear" feel
                  "[transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]",
                  isActive && "bg-primary scale-125",
                  isPast && "bg-primary/50",
                  !isActive && !isPast && "bg-white/[0.08] dark:bg-white/[0.08]"
                )}
              />

              {/* Progress ring for active dot */}
              {isActive && (
                <svg
                  className="absolute -inset-0.5 w-[calc(100%+4px)] h-[calc(100%+4px)]"
                  viewBox="0 0 12 12"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-primary/30"
                  />
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="text-primary"
                    strokeDasharray="31.4"
                    strokeDashoffset="31.4"
                    style={{
                      animation: `progress-ring ${interval}ms linear forwards`,
                      transformOrigin: 'center',
                      transform: 'rotate(-90deg)'
                    }}
                  />
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
