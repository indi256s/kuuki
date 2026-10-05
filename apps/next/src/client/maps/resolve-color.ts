let context: CanvasRenderingContext2D | null | undefined

// Used when neither the requested value nor `--map-land` can be resolved: fully transparent, valid for MapLibre.
// eslint-disable-next-line no-restricted-syntax -- MapLibre needs a literal transparent colour when no token resolves
const TRANSPARENT = 'rgba(0,0,0,0)'

function paint(value: string): string | null {
  if (context === undefined) context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const read = (seed: string) => {
    context!.clearRect(0, 0, 1, 1)
    context!.fillStyle = seed
    context!.fillStyle = value
    context!.fillRect(0, 0, 1, 1)
    return context!.getImageData(0, 0, 1, 1).data
  }
  // eslint-disable-next-line no-restricted-syntax -- canvas probe seeds, not UI colours
  const a = read('#000000'), b = read('#ffffff')
  // An unparseable value leaves the seed color, so the two reads would differ.
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) return null
  // eslint-disable-next-line no-restricted-syntax -- serialises the canvas-resolved colour into MapLibre's legacy syntax
  return `rgba(${a[0]},${a[1]},${a[2]},${+(a[3] / 255).toFixed(3)})`
}

/**
 * MapLibre only parses legacy color syntax, but tokens may be `color-mix(in oklch, ...)`.
 * Painting the value onto a 1px canvas lets the browser resolve it to plain `rgba()`.
 * Never returns unparsed CSS (MapLibre would throw): on failure it falls back to the resolved
 * `--map-land` token, then to transparent.
 */
export function resolveColor(value: string): string {
  const land = getComputedStyle(document.documentElement).getPropertyValue('--map-land').trim()
  return paint(value) ?? (land ? paint(land) : null) ?? TRANSPARENT
}
