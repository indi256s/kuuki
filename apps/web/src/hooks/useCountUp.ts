import { useState, useEffect } from 'react'

/**
 * Animates a number from 0 to target value with ease-out cubic easing.
 * Creates a satisfying "counting up" effect for displaying numbers.
 *
 * @param target - The final number to count up to
 * @param duration - Animation duration in milliseconds (default: 800ms)
 * @returns The current animated count value
 *
 * @example
 * const animatedCount = useCountUp(42, 800)
 * // Returns 0 initially, then smoothly animates to 42
 */
export function useCountUp(target: number, duration = 800): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Skip animation if target is 0 or negative
    if (target <= 0) {
      setCount(target)
      return
    }

    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setCount(target)
      return
    }

    const start = performance.now()
    let animationFrame: number

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic for natural deceleration at the end
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        // Ensure we hit the exact target at the end
        setCount(target)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [target, duration])

  return count
}
