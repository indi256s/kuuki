import { performance } from 'node:perf_hooks'
import { routeGeometry } from '../apps/next/src/client/maps/geometry'
import type { ProjectedRoute } from '../apps/next/src/client/maps/types'

// Synthetic distinct directed airport pairs; compares source/layer setup shape
// and serialized route geometry. GPU/worker/frame time needs a browser proof.
for (const count of [50, 500, 5000]) {
  const routes: ProjectedRoute[] = Array.from({ length: count }, (_, index) => {
    const longitude = -170 + (index * 37 % 340)
    const latitude = -70 + (index * 19 % 140)
    return { origin: `A${index}`, destination: `B${index}`,
      originCountry: null, destinationCountry: null, count: 1, lastDate: '2026-01-01',
      from: [longitude, latitude],
      to: [longitude + 25 > 180 ? longitude - 335 : longitude + 25, latitude + 10],
    }
  })
  const start = performance.now()
  const features = routes.map(route => ({ type: 'Feature', properties: { id: `${route.origin}-${route.destination}` }, geometry: routeGeometry(route) }))
    .filter(feature => feature.geometry)
  const geometryMs = performance.now() - start
  const batched = JSON.stringify({ type: 'FeatureCollection', features })
  const separate = features.map(feature => JSON.stringify({ type: 'FeatureCollection', features: [feature] }))
  console.log(JSON.stringify({ routes: count, valid: features.length, geometryMs: +geometryMs.toFixed(1),
    batchedBytes: Buffer.byteLength(batched), perRouteBytes: separate.reduce((sum, item) => sum + Buffer.byteLength(item), 0),
    batchedSources: 1, perRouteSources: features.length }))
}
