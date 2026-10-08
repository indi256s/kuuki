import { geoCircle, geoEquirectangular, geoStream } from 'd3-geo'

export function nightPolygon(date: Date): GeoJSON.MultiPolygon {
  const start = new Date(date); start.setUTCMonth(0, 1); start.setUTCHours(0, 0, 0, 0)
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000) + 1
  const declination = -23.44 * Math.cos(2 * Math.PI / 365 * (day + 10))
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const antisolarLongitude = ((-15 * hours + 180) % 360 + 360) % 360 - 180
  const hemisphere = geoCircle().center([antisolarLongitude, -declination]).radius(90).precision(2)()
  const polygons: GeoJSON.Position[][][] = []
  let ring: GeoJSON.Position[] = []
  // Clip at ±180° before MapLibre triangulates the hemisphere in planar coordinates.
  const projection = geoEquirectangular().translate([0, 0]).scale(180 / Math.PI).precision(0)
  geoStream(hemisphere, projection.stream({
    point: (x, y) => { ring.push([x, -y]) },
    lineStart: () => { ring = [] },
    lineEnd: () => { ring.push(ring[0]); polygons.push([ring]) },
    polygonStart: () => {}, polygonEnd: () => {}, sphere: () => {},
  }))
  return { type: 'MultiPolygon', coordinates: polygons }
}
