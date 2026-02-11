import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses a color string to RGB [0-255]. Supports hex (#RGB, #RRGGBB),
 * oklch(), and named CSS colors via a hidden canvas fallback.
 */
function parseColorToRGB(color: string): [number, number, number] | null {
  // Hex
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]
    if (hex.length < 6) return null
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)]
  }
  // oklch / rgb / hsl / named colors — resolve via canvas
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#000'
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b]
    }
  }
  return null
}

/**
 * Returns 'white' or 'black' for best contrast against a background color.
 * Supports hex, oklch(), rgb(), and named CSS colors.
 */
export function getContrastColor(color: string | null | undefined): string {
  if (!color) return 'black'
  const rgb = parseColorToRGB(color)
  if (!rgb) return 'black'
  const [r, g, b] = rgb.map(c => c / 255)
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return luminance > 0.4 ? 'black' : 'white'
}
