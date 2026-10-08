import { geoCircle } from 'd3-geo'

export function nightPolygon(date: Date): GeoJSON.Polygon {
  const start = new Date(date); start.setUTCMonth(0, 1); start.setUTCHours(0, 0, 0, 0)
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000) + 1
  const declination = -23.44 * Math.cos(2 * Math.PI / 365 * (day + 10))
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const antisolarLongitude = ((-15 * hours + 180) % 360 + 360) % 360 - 180
  return geoCircle().center([antisolarLongitude, -declination]).radius(90).precision(2)()
}
