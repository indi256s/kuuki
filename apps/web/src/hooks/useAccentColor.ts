import { useState, useCallback, useEffect } from 'react'

// Must match AccentPicker colors
// Each color includes foreground for proper contrast on buttons
const ACCENT_COLORS = {
  blue: { bg: '#4EA7F5', fg: '#ffffff' },
  cyan: { bg: '#26B5CE', fg: '#0a2e35' },      // Light bg needs dark text
  teal: { bg: '#2EB88A', fg: '#0a2e1f' },      // Light bg needs dark text
  yellow: { bg: '#EBCB4B', fg: '#3d3314' },    // Light bg needs dark text
  orange: { bg: '#F3904F', fg: '#ffffff' },
  coral: { bg: '#F76B6E', fg: '#ffffff' },
  red: { bg: '#E54D5A', fg: '#ffffff' },
  purple: { bg: '#AF7AF2', fg: '#ffffff' },
} as const

export type AccentColorName = keyof typeof ACCENT_COLORS

const STORAGE_KEY = 'kuuki-accent-color'
const DEFAULT_COLOR: AccentColorName = 'red'

/**
 * Apply accent color to CSS custom properties
 * Sets both background and foreground for proper button contrast
 */
function applyAccentColor(colorName: AccentColorName) {
  const color = ACCENT_COLORS[colorName]
  if (color) {
    document.documentElement.style.setProperty('--primary', color.bg)
    document.documentElement.style.setProperty('--primary-foreground', color.fg)
    document.documentElement.style.setProperty('--ring', color.bg)
  }
}

/**
 * Get stored accent color from localStorage
 */
function getStoredColor(): AccentColorName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in ACCENT_COLORS) {
      return stored as AccentColorName
    }
  } catch {
    // localStorage might be unavailable
  }
  return DEFAULT_COLOR
}

/**
 * Hook for managing accent color with localStorage persistence.
 * Automatically applies CSS variables on mount and when color changes.
 */
export function useAccentColor() {
  const [accentColor, setAccentColorState] = useState<AccentColorName>(getStoredColor)

  // Apply color on mount
  useEffect(() => {
    applyAccentColor(accentColor)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setAccentColor = useCallback((color: AccentColorName) => {
    setAccentColorState(color)
    applyAccentColor(color)
    try {
      localStorage.setItem(STORAGE_KEY, color)
    } catch {
      // localStorage might be unavailable
    }
  }, [])

  return {
    accentColor,
    setAccentColor,
  }
}

/**
 * Initialize accent color on app start (call once in App.tsx or main.tsx)
 */
export function initializeAccentColor() {
  const color = getStoredColor()
  applyAccentColor(color)
}
