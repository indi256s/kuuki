import { useState, useCallback, useEffect } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'kuuki-theme-mode'
const DEFAULT_MODE: ThemeMode = 'dark'

// Meta theme-color values for mobile browser chrome
const THEME_COLORS = {
  light: '#FAFAFA', // oklch(0.985 0.002 240) converted to hex
  dark: '#08090A',  // oklch(0.21 0.005 260) converted to hex
} as const

/**
 * Detect system color scheme preference
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Get stored theme mode from localStorage
 */
function getStoredThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
      return stored as ThemeMode
    }
  } catch {
    // localStorage might be unavailable (incognito, privacy settings)
  }
  return DEFAULT_MODE
}

/**
 * Resolve theme mode to actual theme
 * 'system' -> detects OS preference
 * 'light'/'dark' -> returns as-is
 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

/**
 * Apply theme to document element
 * Adds/removes 'dark' class on <html>
 */
function applyTheme(theme: ResolvedTheme) {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

/**
 * Update meta theme-color for mobile browser chrome
 */
function updateThemeColor(theme: ResolvedTheme) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[theme])
  }
}

/**
 * Hook for managing theme with localStorage persistence and system detection.
 * Returns both user preference (themeMode) and actual applied theme (resolvedTheme).
 */
export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredThemeMode())
  )

  // Listen to system preference changes when mode is 'system'
  useEffect(() => {
    if (themeMode !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      const newTheme = getSystemTheme()
      setResolvedTheme(newTheme)
      applyTheme(newTheme)
      updateThemeColor(newTheme)
    }

    // Modern browsers support addEventListener on MediaQueryList
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  // Apply theme on mount
  useEffect(() => {
    applyTheme(resolvedTheme)
    updateThemeColor(resolvedTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setThemeMode = useCallback((mode: ThemeMode) => {
    const newTheme = resolveTheme(mode)

    setThemeModeState(mode)
    setResolvedTheme(newTheme)
    applyTheme(newTheme)
    updateThemeColor(newTheme)

    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // localStorage might be unavailable
    }
  }, [])

  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
  }
}

/**
 * Initialize theme before React render (call once in main.tsx)
 * Prevents flash of wrong theme on page load
 */
export function initializeTheme() {
  const mode = getStoredThemeMode()
  const theme = resolveTheme(mode)
  applyTheme(theme)
  updateThemeColor(theme)
}
