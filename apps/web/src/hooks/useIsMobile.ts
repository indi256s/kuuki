import { useState, useEffect } from 'react'

/**
 * Hook to detect if viewport is below a breakpoint (mobile).
 *
 * Uses CSS matchMedia for efficient viewport detection without
 * causing hydration mismatches. The hook returns undefined during SSR
 * and the correct value after hydration.
 *
 * @param breakpoint - Tailwind breakpoint name ('sm' = 640px, 'md' = 768px, 'lg' = 1024px)
 * @returns boolean indicating if viewport is below the breakpoint, or undefined during SSR
 */
const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
}

export function useIsMobile(breakpoint: 'sm' | 'md' | 'lg' = 'sm'): boolean {

  const [isMobile, setIsMobile] = useState(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return true
    return window.innerWidth < breakpoints[breakpoint]
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoints[breakpoint] - 1}px)`)

    // Set initial value
    setIsMobile(mediaQuery.matches)

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [breakpoint])

  return isMobile
}
