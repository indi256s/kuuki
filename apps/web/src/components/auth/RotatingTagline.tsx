import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface RotatingTaglineProps {
  items: string[]
  interval?: number
  className?: string
}

export function RotatingTagline({ items, interval = 8000, className }: RotatingTaglineProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setIsExiting(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length)
        setIsExiting(false)
      }, 300)
    }, interval)

    return () => clearInterval(timer)
  }, [items.length, interval])

  return (
    <div className="space-y-2">
      {/* Rotating text */}
      <div className="relative h-5 overflow-hidden">
        <p
          className={cn(
            "transition-all duration-300 ease-out",
            className,
            isExiting ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
          )}
        >
          {items[currentIndex]}
        </p>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5">
        {items.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              i === currentIndex
                ? "bg-primary/60 w-2"
                : "bg-neutral-300 dark:bg-white/20 w-1"
            )}
          />
        ))}
      </div>
    </div>
  )
}
