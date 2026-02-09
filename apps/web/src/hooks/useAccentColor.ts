import { useState, useCallback, useEffect } from 'react'

// Must match AccentPicker colors
// Each color includes foreground for proper contrast on buttons
export const ACCENT_COLORS_LIST = [
  { name: 'blue', bg: '#4EA7F5', fg: '#ffffff', label: 'Blue' },
  { name: 'cyan', bg: '#26B5CE', fg: '#0a2e35', label: 'Cyan' },
  { name: 'teal', bg: '#2EB88A', fg: '#0a2e1f', label: 'Teal' },
  { name: 'yellow', bg: '#EBCB4B', fg: '#3d3314', label: 'Yellow' },
  { name: 'orange', bg: '#F3904F', fg: '#ffffff', label: 'Orange' },
  { name: 'coral', bg: '#F76B6E', fg: '#ffffff', label: 'Coral' },
  { name: 'red', bg: '#E54D5A', fg: '#ffffff', label: 'Red' },
  { name: 'purple', bg: '#AF7AF2', fg: '#ffffff', label: 'Purple' },
] as const

const ACCENT_COLORS = Object.fromEntries(
  ACCENT_COLORS_LIST.map(c => [c.name, { bg: c.bg, fg: c.fg }])
) as Record<string, { bg: string, fg: string }>

export type AccentColorName = (typeof ACCENT_COLORS_LIST)[number]['name']

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
