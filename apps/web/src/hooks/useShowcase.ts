import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'kuuki-showcase-seen'

export function useShowcase() {
  const [hasSeen, setHasSeen] = useState<boolean | null>(null)

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setHasSeen(stored === 'true')
  }, [])

  const markAsSeen = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setHasSeen(true)
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setHasSeen(false)
  }, [])

  return {
    // null while loading from localStorage
    hasSeen,
    // Whether we should show the showcase (loaded and not seen)
    shouldShow: hasSeen === false,
    // Mark showcase as seen
    markAsSeen,
    // Reset for testing/debugging
    reset,
  }
}
