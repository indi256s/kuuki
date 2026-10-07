import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The pinned, tile-less geography (scripts/map-build-geometry.py). Planar renderers join consecutive
// ring points with straight lines, so a jump between +180 and -180 draws a stripe across the world.
const asset = (name: string) => readFileSync(fileURLToPath(new URL(`../../../public/maps/${name}`, import.meta.url)), 'utf8')
type Ring = [number, number][]
type Countries = { features: { id: string; geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } }[] }

const countries = JSON.parse(asset('countries-110m-2.0.2.geojson')) as Countries
const rings = (feature: Countries['features'][number]) => feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.coordinates.flat()
const jumps = (ring: Ring) => ring.slice(1).filter((point, i) => Math.abs(point[0] - ring[i][0]) > 180).length

describe('pinned country geometry', () => {
  it('has no ring that jumps across the antimeridian, except the polar cap that closes along it', () => {
    const offenders = countries.features.flatMap(feature => rings(feature).filter(ring => jumps(ring) > 0).map(ring => ({ id: feature.id, jumps: jumps(ring) })))
    // Antarctica encircles the pole: its single seam edge is the bottom of the fill, not a stripe.
    expect(offenders).toEqual([{ id: 'AQ', jumps: 1 }])
  })

  it('keeps every ring closed', () => {
    for (const feature of countries.features) for (const ring of rings(feature)) expect(ring.at(-1), feature.id).toEqual(ring[0])
  })

  it('splits Fiji and Chukotka at the seam instead of joining them across the map', () => {
    const fiji = countries.features.find(feature => feature.id === 'FJ')!
    expect(rings(fiji).every(ring => ring.every(([lon]) => lon >= 170) || ring.every(([lon]) => lon <= -170))).toBe(true)
    const russia = countries.features.find(feature => feature.id === 'RU')!
    expect(rings(russia).some(ring => ring.every(([lon]) => lon < 0))).toBe(true)
  })

  it.each(['light', 'dark'])('draws no %s SVG preview path segment wider than half the world, except the polar cap', theme => {
    const svg = asset(`world-outline-110m-2.0.2-${theme}.svg`)
    const wide: number[] = []
    for (const [index, path] of [...svg.matchAll(/<path d="([^"]+)"/g)].entries()) {
      for (const sub of path[1].split('M').filter(Boolean)) {
        const xs = sub.replace(/Z$/, '').split('L').map(pair => Number(pair.split(',')[0]))
        if (xs.slice(1).some((x, i) => Math.abs(x - xs[i]) > 360)) wide.push(index)
      }
    }
    const order = countries.features.map(feature => feature.id)
    expect(wide.map(index => order[index])).toEqual(['AQ'])
  })

  it('places the Fiji preview dot in the Pacific, not at the mean of ±180', () => {
    const centers = JSON.parse(asset('country-centers-110m-2.0.2.json')) as Record<string, [number, number]>
    expect(centers.FJ[0]).toBeGreaterThan(700)
  })
})
