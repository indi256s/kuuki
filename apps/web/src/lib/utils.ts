import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns appropriate foreground color ('white' or 'black') for a given
 * hex background color, based on relative luminance (WCAG contrast).
 * Returns 'white' for dark backgrounds, 'black' for light backgrounds.
 */
export function getContrastColor(hexColor: string | null | undefined): string {
  if (!hexColor || !hexColor.startsWith('#')) return 'black'
  const hex = hexColor.replace('#', '')
  if (hex.length < 6) return 'black'
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  // sRGB to linear
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return luminance > 0.4 ? 'black' : 'white'
}
