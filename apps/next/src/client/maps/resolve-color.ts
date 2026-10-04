let context: CanvasRenderingContext2D | null | undefined

/**
 * MapLibre only parses legacy color syntax, but tokens may be `color-mix(in oklch, ...)`.
 * Painting the value onto a 1px canvas lets the browser resolve it to plain `rgba()`.
 * Returns the input unchanged if the browser cannot parse it.
 */
export function resolveColor(value: string): string {
  if (context === undefined) context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!context) return value
  const read = (seed: string) => {
    context!.clearRect(0, 0, 1, 1)
    context!.fillStyle = seed
    context!.fillStyle = value
    context!.fillRect(0, 0, 1, 1)
    return context!.getImageData(0, 0, 1, 1).data
  }
  const a = read('#000000'), b = read('#ffffff')
  // An unparseable value leaves the seed color, so the two reads would differ.
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) return value
  return `rgba(${a[0]},${a[1]},${a[2]},${+(a[3] / 255).toFixed(3)})`
}
