import { create } from 'zustand'

/**
 * Error deduplication store.
 *
 * Prevents the same error from being shown multiple times in quick succession.
 * Uses a 3-second deduplication window - if the same error message is triggered
 * within this window, it won't show a new toast.
 */

const DEDUP_WINDOW_MS = 3000 // 3 seconds

interface ErrorEntry {
  message: string
  timestamp: number
}

interface ErrorStore {
  recentErrors: ErrorEntry[]

  /**
   * Check if an error with this message was shown recently.
   */
  isDuplicate: (message: string) => boolean

  /**
   * Track an error that's being shown.
   */
  addError: (message: string) => void

  /**
   * Clean up old entries (called periodically).
   */
  cleanup: () => void
}

export const useErrorStore = create<ErrorStore>((set, get) => ({
  recentErrors: [],

  isDuplicate: (message: string): boolean => {
    const now = Date.now()
    const { recentErrors } = get()

    // Check if same message exists within window
    return recentErrors.some(
      (entry) =>
        entry.message === message && now - entry.timestamp < DEDUP_WINDOW_MS
    )
  },

  addError: (message: string) => {
    const now = Date.now()

    set((state) => ({
      recentErrors: [
        // Filter out expired entries while adding new one
        ...state.recentErrors.filter(
          (entry) => now - entry.timestamp < DEDUP_WINDOW_MS
        ),
        { message, timestamp: now },
      ],
    }))

    // Schedule cleanup after window expires
    setTimeout(() => get().cleanup(), DEDUP_WINDOW_MS + 100)
  },

  cleanup: () => {
    const now = Date.now()
    set((state) => ({
      recentErrors: state.recentErrors.filter(
        (entry) => now - entry.timestamp < DEDUP_WINDOW_MS
      ),
    }))
  },
}))
