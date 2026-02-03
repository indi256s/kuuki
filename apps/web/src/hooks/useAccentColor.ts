import { useState, useCallback, useEffect } from 'react'

// Must match AccentPicker colors
const ACCENT_COLORS = {
  blue: '#4EA7F5',
  cyan: '#26B5CE',
  teal: '#2EB88A',
  green: '#50C086',
  yellow: '#EBCB4B',
  orange: '#F3904F',
  coral: '#F76B6E',
  red: '#E54D5A',
  purple: '#AF7AF2',
} as const

export type AccentColorName = keyof typeof ACCENT_COLORS

const STORAGE_KEY = 'kuuki-accent-color'
const DEFAULT_COLOR: AccentColorName = 'coral'

/**
 * Apply accent color to CSS custom properties
 */
function applyAccentColor(colorName: AccentColorName) {
  const colorValue = ACCENT_COLORS[colorName]
  if (colorValue) {
    document.documentElement.style.setProperty('--primary', colorValue)
    document.documentElement.style.setProperty('--ring', colorValue)
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
