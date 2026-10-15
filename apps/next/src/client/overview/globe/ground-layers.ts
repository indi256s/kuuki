// The globe's ground journeys: two sources, five layers and three icons, owned here so the flight globe only places
// them. Ground is not interactive (no cursor, hover or click) and draws in the same ink as the routes.
import type { ExpressionSpecification, GeoJSONSource, Map as LibreMap } from 'maplibre-gl'
import type { GlobeData } from '@kuuki/shared/overview/globe'
import { wrappedBounds } from '../../maps/geometry'

type Position = [number, number]
type Bounds = [[number, number], [number, number]]

const GROUND_SOURCE = 'globe-ground'
const CITY_SOURCE = 'globe-ground-cities'
export const GROUND_CASING = 'globe-ground-casing'
export const GROUND_LINE = 'globe-ground-line'
const RAIL_TIES = 'globe-ground-rail-ties'
const ROAD_DOTS = 'globe-ground-road-dots'
const CITY_SQUARES = 'globe-ground-city-squares'
const TIE_IMAGE = 'globe-rail-tie'
const DOT_IMAGE = 'globe-road-dot'
const CITY_IMAGE = 'globe-city-square'
// Below this zoom ground is the plain line; ties and dots only read once a leg is long enough on screen.
const GROUND_DETAIL_MINZOOM = 4
const GROUND_LINE_WIDTH = 1.5
// Planned journeys stay in the same encoding at a lower weight, in every scope.
export const plannedOpacity: ExpressionSpecification = ['case', ['get', 'planned'], 0.35, 1]
const round = { 'line-cap': 'round', 'line-join': 'round' } as const

/** A run crossing the antimeridian breaks there, so MapLibre draws the short way and not around the world. */
export function splitAtSeam(run: Position[]): Position[][] {
  const lines: Position[][] = [[run[0]]]
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1],
      b = run[i]
    if (Math.abs(b[0] - a[0]) > 180) {
      const seam = a[0] > 0 ? 180 : -180
      const unwrapped = b[0] + (seam > 0 ? 360 : -360)
      const latitude = a[1] + ((seam - a[0]) / (unwrapped - a[0])) * (b[1] - a[1])
      lines.at(-1)!.push([seam, latitude])
      lines.push([[-seam, latitude]])
    }
    lines.at(-1)!.push(b)
  }
  return lines
}

/** Lines per run and one square per distinct place; a place is planned only when every journey through it is. */
export function groundData(journeys: GlobeData['ground']) {
  const cities = new Map<string, { position: Position; planned: boolean }>()
  const runs = journeys.flatMap((journey) =>
    journey.runs.flatMap((run) => {
      for (const position of run) {
        const key = position.join(',')
        const seen = cities.get(key)
        cities.set(key, { position, planned: (seen?.planned ?? true) && journey.planned })
      }
      if (run.length < 2) return []
      const lines = splitAtSeam(run)
      return [
        {
          type: 'Feature' as const,
          properties: { mode: journey.mode, planned: journey.planned },
          geometry:
            lines.length === 1
              ? { type: 'LineString' as const, coordinates: lines[0] }
              : { type: 'MultiLineString' as const, coordinates: lines },
        },
      ]
    }),
  )
  return {
    ground: { type: 'FeatureCollection' as const, features: runs },
    cities: {
      type: 'FeatureCollection' as const,
      features: [...cities.values()].map(({ position, planned }) => ({
        type: 'Feature' as const,
        properties: { planned },
        geometry: { type: 'Point' as const, coordinates: position },
      })),
    },
  }
}
export type GroundData = ReturnType<typeof groundData>

/** The smallest longitude span holding every point, across the seam; null for one place (the centroid frames it). */
export function groundBounds(points: Position[]): Bounds | null {
  const bounds = wrappedBounds([{ type: 'LineString', coordinates: points }])
  if (!bounds) return null
  return bounds[1][0] - bounds[0][0] < 0.01 && bounds[1][1] - bounds[0][1] < 0.01 ? null : bounds
}

/** Sources and the line layers; call where ground sits in the stack (under the flight layers). */
export function addGroundLines(map: LibreMap) {
  for (const id of [GROUND_SOURCE, CITY_SOURCE])
    map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: GROUND_CASING,
    type: 'line',
    source: GROUND_SOURCE,
    layout: round,
    // The same 5px halo the routes carry.
    paint: { 'line-width': GROUND_LINE_WIDTH + 5, 'line-blur': 2, 'line-opacity': plannedOpacity },
  })
  map.addLayer({
    id: GROUND_LINE,
    type: 'line',
    source: GROUND_SOURCE,
    layout: round,
    paint: { 'line-width': GROUND_LINE_WIDTH, 'line-opacity': plannedOpacity },
  })
  // icon-image is set once the image exists (paintGround), so no missing-image warning fires at creation.
  for (const [id, mode] of [
    [RAIL_TIES, 'rail'],
    [ROAD_DOTS, 'road'],
  ] as const)
    map.addLayer({
      id,
      type: 'symbol',
      source: GROUND_SOURCE,
      minzoom: GROUND_DETAIL_MINZOOM,
      filter: ['==', ['get', 'mode'], mode],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 12,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotation-alignment': 'map',
      },
      paint: { 'icon-opacity': plannedOpacity },
    })
}

/** The place squares; call where they sit in the stack (over the airport dots, under the labels). */
export function addGroundCities(map: LibreMap) {
  map.addLayer({
    id: CITY_SQUARES,
    type: 'symbol',
    source: CITY_SOURCE,
    layout: { 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    paint: { 'icon-opacity': plannedOpacity },
  })
}

export function setGroundData(map: LibreMap, data: GroundData) {
  ;(map.getSource(GROUND_SOURCE) as GeoJSONSource | undefined)?.setData(data.ground)
  ;(map.getSource(CITY_SOURCE) as GeoJSONSource | undefined)?.setData(data.cities)
}

/** Icons and line colours for the current theme. Icons are drawn at 2x: tie 1x6, dot 3 and city square 7 CSS px. */
export function paintGround(map: LibreMap, ink: string, casing: string) {
  if (!map.getLayer(GROUND_LINE)) return
  const icons: Array<[string, string, number, number, (c: CanvasRenderingContext2D) => void]> = [
    [
      TIE_IMAGE,
      RAIL_TIES,
      2,
      12,
      (c) => {
        c.fillStyle = ink
        c.fillRect(0, 0, 2, 12)
      },
    ],
    [
      DOT_IMAGE,
      ROAD_DOTS,
      6,
      6,
      (c) => {
        c.fillStyle = ink
        c.beginPath()
        c.arc(3, 3, 3, 0, Math.PI * 2)
        c.fill()
      },
    ],
    [
      CITY_IMAGE,
      CITY_SQUARES,
      14,
      14,
      (c) => {
        c.fillStyle = casing
        c.fillRect(0, 0, 14, 14)
        c.fillStyle = ink
        c.fillRect(3, 3, 8, 8)
      },
    ],
  ]
  for (const [id, layer, width, height, draw] of icons) {
    const surface = document.createElement('canvas')
    surface.width = width
    surface.height = height
    const pen = surface.getContext('2d')
    if (!pen) continue
    draw(pen)
    const image = pen.getImageData(0, 0, width, height)
    if (map.hasImage(id)) map.updateImage(id, image)
    else map.addImage(id, image, { pixelRatio: 2 })
    map.setLayoutProperty(layer, 'icon-image', id)
  }
  map.setPaintProperty(GROUND_LINE, 'line-color', ink)
  map.setPaintProperty(GROUND_CASING, 'line-color', casing)
}

export function removeGround(map: LibreMap) {
  for (const layer of [CITY_SQUARES, ROAD_DOTS, RAIL_TIES, GROUND_LINE, GROUND_CASING])
    if (map.getLayer(layer)) map.removeLayer(layer)
  for (const source of [GROUND_SOURCE, CITY_SOURCE])
    if (map.getSource(source)) map.removeSource(source)
  if (map.getStyle())
    for (const image of [TIE_IMAGE, DOT_IMAGE, CITY_IMAGE])
      if (map.hasImage(image)) map.removeImage(image)
}
