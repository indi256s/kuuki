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
            "text-center transition-all cursor-default select-none",
            // Linear-style snappy but smooth easing
            "[transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]",
            className,
            phase === 'visible' && "translate-y-0 opacity-100 blur-0 duration-700",
            phase === 'exit' && "-translate-y-2 opacity-0 blur-sm duration-300",
            phase === 'enter' && "translate-y-2 opacity-0 blur-sm duration-0"
          )}
        >
          {items[currentIndex]}
        </p>
      </div>
    </div>
  )
}
