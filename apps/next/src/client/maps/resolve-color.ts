let context: CanvasRenderingContext2D | null | undefined

// oxlint-disable-next-line kuuki/design-tokens -- MapLibre needs a literal transparent colour when no token resolves
const TRANSPARENT = 'rgba(0,0,0,0)'

function paint(value: string): string | null {
  if (context === undefined)
    context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const read = (seed: string) => {
    context!.clearRect(0, 0, 1, 1)
    context!.fillStyle = seed
    context!.fillStyle = value
    context!.fillRect(0, 0, 1, 1)
    return context!.getImageData(0, 0, 1, 1).data
  }
  // oxlint-disable kuuki/design-tokens -- canvas probe seeds, not UI colours
  const a = read('#000000'),
    b = read('#ffffff')
  // oxlint-enable kuuki/design-tokens
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) return null
  // oxlint-disable-next-line kuuki/design-tokens -- serialises the canvas-resolved colour into MapLibre's legacy syntax
  return `rgba(${a[0]},${a[1]},${a[2]},${+(a[3] / 255).toFixed(3)})`
}

export function resolveColor(value: string): string {
  const land = getComputedStyle(document.documentElement).getPropertyValue('--map-land').trim()
  return paint(value) ?? (land ? paint(land) : null) ?? TRANSPARENT
}
