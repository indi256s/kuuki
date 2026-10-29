import type { BoundsM } from '../../../lib/airport-models/model'

export type DrawingPanel = { width: number; height: number; boundsM: BoundsM }

/** Panel sizes exclude labels/padding: both airports receive exactly this scale. */
export function comparisonScale(panels: readonly DrawingPanel[]) {
  if (!panels.length || panels.some((panel) => panel.width <= 0 || panel.height <= 0)) return 0
  return Math.min(
    ...panels.flatMap(({ width, height, boundsM }) => [
      width / Math.max(1, boundsM[2] - boundsM[0]),
      height / Math.max(1, boundsM[3] - boundsM[1]),
    ]),
  )
}

export function planTransform(panel: DrawingPanel, pixelsPerMetre: number) {
  const [west, south, east, north] = panel.boundsM
  return `translate(${panel.width / 2} ${panel.height / 2}) scale(${pixelsPerMetre} ${-pixelsPerMetre}) translate(${-(west + east) / 2} ${-(south + north) / 2})`
}

export function scaleBar(pixelsPerMetre: number, width: number) {
  if (pixelsPerMetre <= 0 || width <= 0) return { metres: 0, pixels: 0 }
  const maximum = Math.min(140, width * 0.4) / pixelsPerMetre
  const power = 10 ** Math.floor(Math.log10(maximum))
  const metres =
    [5, 2, 1].map((value) => value * power).find((value) => value <= maximum) ?? power / 2
  return { metres, pixels: metres * pixelsPerMetre }
}
