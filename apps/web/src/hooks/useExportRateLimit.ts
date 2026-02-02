/**
 * Export Rate Limit Hook
 *
 * Tracks export usage in localStorage with daily reset.
 * Hard limit: 5 exports per day to prevent abuse.
 */

import { useState, useEffect, useCallback } from 'react'

const DAILY_LIMIT = 5
const STORAGE_KEY = 'kuuki-export-count'

interface StoredData {
  date: string
  count: number
}

interface ExportRateLimit {
  /** Whether the user can still export today */
  canExport: boolean
  /** Number of exports remaining today */
  remaining: number
  /** Record a new export (call after successful export) */
  recordExport: () => void
  /** Reset the counter (for testing) */
  reset: () => void
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Read stored data from localStorage
 */
function readStoredData(): StoredData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as StoredData
  } catch {
    return null
  }
}

/**
 * Write data to localStorage
 */
function writeStoredData(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Get current export count for today
 */
function getCurrentCount(): number {
  const data = readStoredData()
  const today = getTodayDate()

  // If no data or different day, count is 0
  if (!data || data.date !== today) {
    return 0
  }

  return data.count
}

/**
 * Hook for managing export rate limits
 */
export function useExportRateLimit(): ExportRateLimit {
  const [count, setCount] = useState(() => getCurrentCount())

  // Sync with localStorage on mount and when storage changes
  useEffect(() => {
    const syncCount = () => {
      setCount(getCurrentCount())
    }

    // Listen for storage events (cross-tab sync)
    window.addEventListener('storage', syncCount)

    return () => {
      window.removeEventListener('storage', syncCount)
    }
  }, [])

  const recordExport = useCallback(() => {
    const today = getTodayDate()
    const currentData = readStoredData()

    let newCount: number
    if (!currentData || currentData.date !== today) {
      // New day, start fresh
      newCount = 1
    } else {
      // Same day, increment
      newCount = currentData.count + 1
    }

    writeStoredData({ date: today, count: newCount })
    setCount(newCount)
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setCount(0)
  }, [])

  return {
    canExport: count < DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - count),
    recordExport,
    reset,
  }
}
