import assert from 'node:assert/strict'
import { routeGeometry, wrappedBounds } from '../apps/next/src/client/maps/geometry'
import type { ProjectedRoute } from '../apps/next/src/client/maps/types'

const route = (from: [number, number] | null, to: [number, number] | null): ProjectedRoute => ({
  origin: 'AAA', destination: 'BBB', originCountry: null, destinationCountry: null,
  count: 1, lastDate: '2026-01-01', from, to,
})

assert.equal(routeGeometry(route(null, [1, 2])), null)
assert.equal(routeGeometry(route([0, 0], [0, 0])), null)
assert.equal(routeGeometry(route([0, 0], [180, 0])), null)
assert.equal(routeGeometry(route([200, 0], [1, 1])), null)
const pacific = routeGeometry(route([178, -18], [-157, 21]))
assert.ok(pacific)
assert.equal(pacific.type, 'MultiLineString')
const bounds = wrappedBounds([pacific])
assert.ok(bounds)
assert.ok(bounds[1][0] - bounds[0][0] < 100, 'Pacific fit must use the short wrapped span')
const polar = routeGeometry(route([-73.8, 40.7], [37.6, 55.7]))
assert.ok(polar)
for (const point of polar.type === 'LineString' ? polar.coordinates : polar.coordinates.flat()) {
  assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]))
}
console.log('map geometry cases passed')
